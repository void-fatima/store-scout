"""Injectable synchronous text client, independent of shopping and HTTP routes."""

import http.client
import json
from dataclasses import dataclass, field
from enum import StrEnum
from urllib.error import URLError

from .config import LLMConfig
from .errors import ErrorCode, LLMError
from .transport import HTTPResult, HTTPSTransport, Transport


class OutputLimitParameter(StrEnum):
    """Operator must verify support for the selected model; never auto-switch."""

    MAX_TOKENS = "max_tokens"
    MAX_COMPLETION_TOKENS = "max_completion_tokens"


@dataclass(frozen=True)
class Completion:
    text: str = field(repr=False)
    finish_reason: str | None = field(default=None, repr=False)


class BoxAPIClient:
    def __init__(
        self,
        config: LLMConfig,
        *,
        transport: Transport | None = None,
        max_output_tokens_limit: int = 256,
    ):
        if type(max_output_tokens_limit) is not int or not 16 <= max_output_tokens_limit <= 2048:
            raise LLMError(ErrorCode.INVALID_CONFIGURATION)
        self._config = config
        self._transport = transport if transport is not None else HTTPSTransport()
        self._max_output_tokens_limit = max_output_tokens_limit

    def complete(
        self,
        text: str,
        *,
        output_limit_parameter: OutputLimitParameter,
        max_output_tokens: int = 64,
        system_text: str | None = None,
    ) -> Completion:
        """One user message, one POST. No tools, structured output, fallback or retry."""
        if (
            not isinstance(text, str)
            or not text.strip()
            or len(text) > 4000
            or not isinstance(output_limit_parameter, OutputLimitParameter)
            or type(max_output_tokens) is not int
            or not 16 <= max_output_tokens <= self._max_output_tokens_limit
            or (
                system_text is not None
                and (
                    not isinstance(system_text, str)
                    or not system_text.strip()
                    or len(system_text) > 6000
                )
            )
        ):
            raise LLMError(ErrorCode.INVALID_REQUEST)
        try:
            body = json.dumps(
                {
                    "model": self._config.model,
                    "messages": (
                        ([{"role": "system", "content": system_text}] if system_text else [])
                        + [{"role": "user", "content": text}]
                    ),
                    output_limit_parameter.value: max_output_tokens,
                },
                ensure_ascii=False,
            ).encode("utf-8")
        except UnicodeError:
            body = None
        if body is None:
            raise LLMError(ErrorCode.INVALID_REQUEST)

        # Raise outside handlers: raw exception contexts can contain credentials.
        failure = None
        try:
            response = self._transport.post(
                f"{self._config.base_url}/chat/completions",
                api_key=self._config.api_key,
                body=body,
                timeout_seconds=self._config.timeout_seconds,
                max_response_bytes=self._config.max_response_bytes,
            )
        except LLMError as exc:
            failure = exc.code
        except TimeoutError:
            failure = ErrorCode.TIMEOUT
        except URLError as exc:
            failure = (
                ErrorCode.TIMEOUT if isinstance(exc.reason, TimeoutError) else ErrorCode.TRANSPORT
            )
        except http.client.HTTPException:
            failure = ErrorCode.MALFORMED_RESPONSE
        except Exception:
            failure = ErrorCode.TRANSPORT
        if failure is not None:
            raise LLMError(failure)
        return self._parse(response)

    def _parse(self, response: HTTPResult) -> Completion:
        if (
            not isinstance(response, HTTPResult)
            or type(response.status) is not int
            or not isinstance(response.body, bytes)
        ):
            raise LLMError(ErrorCode.MALFORMED_RESPONSE)
        if len(response.body) > self._config.max_response_bytes:
            raise LLMError(ErrorCode.RESPONSE_TOO_LARGE)
        failure = _status_error(response.status)
        if failure is not None and response.status != 400:
            raise LLMError(failure)
        payload = _json_object(response.body)
        if response.status == 400:
            error = payload.get("error") if payload else None
            # Only exact codes are inspected; never echo messages or infer from prose.
            code = error.get("code") if isinstance(error, dict) else None
            if isinstance(code, str) and code in {
                "model_not_found",
                "model_not_available",
                "invalid_model",
                "model_access_denied",
            }:
                failure = ErrorCode.MODEL_ACCESS
            raise LLMError(failure)
        if payload is None or "error" in payload:
            raise LLMError(ErrorCode.MALFORMED_RESPONSE)
        choices = payload.get("choices")
        if not isinstance(choices, list) or len(choices) != 1 or not isinstance(choices[0], dict):
            raise LLMError(ErrorCode.MALFORMED_RESPONSE)
        message = choices[0].get("message")
        reason = choices[0].get("finish_reason")
        if reason == "length":
            raise LLMError(ErrorCode.INCOMPLETE_RESPONSE)
        if reason is not None and reason != "stop":
            raise LLMError(ErrorCode.MALFORMED_RESPONSE)
        if (
            not isinstance(message, dict)
            or message.get("role") != "assistant"
            or not isinstance(message.get("content"), str)
            or not message["content"].strip()
            or message.get("tool_calls")
            or message.get("function_call")
        ):
            raise LLMError(ErrorCode.MALFORMED_RESPONSE)
        # Even a provider accidentally echoing the credential must not expose it.
        return Completion(message["content"].replace(self._config.api_key, "[REDACTED]"), reason)


def _json_object(body: bytes) -> dict | None:
    try:
        payload = json.loads(body.decode("utf-8"))
        return payload if isinstance(payload, dict) else None
    except (ValueError, UnicodeError, RecursionError):
        return None


def _status_error(status: int) -> ErrorCode | None:
    if status == 200:
        return None
    if status == 401:
        return ErrorCode.AUTHENTICATION
    if status in {403, 404}:
        return ErrorCode.MODEL_ACCESS
    if status == 429:
        return ErrorCode.RATE_LIMIT
    if status in {408, 504}:
        return ErrorCode.TIMEOUT
    if status == 402:
        return ErrorCode.BILLING_REQUIRED
    if 300 <= status < 400:
        return ErrorCode.REDIRECT_REFUSED
    if 500 <= status <= 599:
        return ErrorCode.PROVIDER_UNAVAILABLE
    return ErrorCode.REQUEST_REJECTED
