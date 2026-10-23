import http.client
import json
import traceback
from urllib.error import URLError

import pytest

from torob.journey.llm.client import BoxAPIClient, OutputLimitParameter
from torob.journey.llm.config import LLMConfig
from torob.journey.llm.errors import ErrorCode, LLMError
from torob.journey.llm.transport import HTTPResult

KEY = "test-credential"
PARAMETER = OutputLimitParameter.MAX_TOKENS


def completion_body(content="اتصال برقرار است."):
    return json.dumps(
        {"choices": [{"message": {"role": "assistant", "content": content}}]},
        ensure_ascii=False,
    ).encode("utf-8")


class StubTransport:
    def __init__(self, response=None, error=None):
        self.response = response if response is not None else HTTPResult(200, completion_body())
        self.error = error
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if self.error is not None:
            raise self.error
        return self.response


def client(transport, **config):
    return BoxAPIClient(LLMConfig(KEY, "vendor/model", **config), transport=transport)


@pytest.mark.parametrize("parameter", list(OutputLimitParameter))
def test_one_successful_text_completion_and_explicit_output_limit(parameter):
    transport = StubTransport()
    result = client(transport).complete("سلام", output_limit_parameter=parameter)
    assert result.text == "اتصال برقرار است."
    assert "اتصال" not in repr(result)
    assert len(transport.calls) == 1
    url, request = transport.calls[0]
    assert url == "https://ai.boxapi.ir/ai/v1/chat/completions"
    assert request["api_key"] == KEY
    assert request["timeout_seconds"] == 15
    assert request["max_response_bytes"] == 65_536
    assert json.loads(request["body"]) == {
        "model": "vendor/model",
        "messages": [{"role": "user", "content": "سلام"}],
        parameter.value: 64,
    }


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (401, ErrorCode.AUTHENTICATION),
        (403, ErrorCode.MODEL_ACCESS),
        (404, ErrorCode.MODEL_ACCESS),
        (429, ErrorCode.RATE_LIMIT),
        (408, ErrorCode.TIMEOUT),
        (504, ErrorCode.TIMEOUT),
        (400, ErrorCode.REQUEST_REJECTED),
        (402, ErrorCode.BILLING_REQUIRED),
        (422, ErrorCode.REQUEST_REJECTED),
        (500, ErrorCode.PROVIDER_UNAVAILABLE),
        (503, ErrorCode.PROVIDER_UNAVAILABLE),
        (302, ErrorCode.REDIRECT_REFUSED),
        (307, ErrorCode.REDIRECT_REFUSED),
        (201, ErrorCode.REQUEST_REJECTED),
    ],
)
def test_http_failures_never_echo_upstream_or_retry(status, code):
    transport = StubTransport(HTTPResult(status, f"Authorization: Bearer {KEY}".encode()))
    with pytest.raises(LLMError) as error:
        client(transport).complete("سلام", output_limit_parameter=PARAMETER)
    assert error.value.code == code
    assert KEY not in str(error.value.as_dict()) + repr(error.value)
    assert error.value.__context__ is None
    assert len(transport.calls) == 1


@pytest.mark.parametrize(
    "code", ["model_not_found", "model_not_available", "invalid_model", "model_access_denied"]
)
def test_model_access_code_without_using_raw_message(code):
    body = json.dumps({"error": {"code": code, "message": KEY}}).encode()
    with pytest.raises(LLMError) as error:
        client(StubTransport(HTTPResult(400, body))).complete(
            "سلام", output_limit_parameter=PARAMETER
        )
    assert error.value.code == ErrorCode.MODEL_ACCESS
    assert KEY not in str(error.value.as_dict())


@pytest.mark.parametrize(
    ("upstream_error", "code"),
    [
        (TimeoutError(KEY), ErrorCode.TIMEOUT),
        (URLError(TimeoutError(KEY)), ErrorCode.TIMEOUT),
        (URLError(KEY), ErrorCode.TRANSPORT),
        (OSError(KEY), ErrorCode.TRANSPORT),
        (RuntimeError(KEY), ErrorCode.TRANSPORT),
        (http.client.IncompleteRead(KEY.encode()), ErrorCode.MALFORMED_RESPONSE),
        (http.client.BadStatusLine(KEY), ErrorCode.MALFORMED_RESPONSE),
        (LLMError(ErrorCode.RESPONSE_TOO_LARGE), ErrorCode.RESPONSE_TOO_LARGE),
    ],
)
def test_transport_errors_drop_sensitive_exception_context(upstream_error, code):
    transport = StubTransport(error=upstream_error)
    with pytest.raises(LLMError) as error:
        client(transport).complete("سلام", output_limit_parameter=PARAMETER)
    assert error.value.code == code
    assert error.value.__context__ is None and error.value.__cause__ is None
    diagnostic = "".join(traceback.format_exception(error.value))
    # Source lines may contain the test constant's name, never its secret value.
    assert KEY not in diagnostic + str(error.value.as_dict())
    assert len(transport.calls) == 1


@pytest.mark.parametrize(
    "body",
    [
        b"not json",
        b"\xff",
        b"null",
        b"[]",
        b"{}",
        b'{"choices": []}',
        b'{"choices": null}',
        b'{"choices": [null]}',
        b'{"choices": [{"message": null}]}',
        b'{"error": {"message": "test-credential"}}',
        completion_body(None),
        completion_body(" "),
        completion_body([{"text": "hello"}]),
        b'{"choices": [{"message": {"role": "user", "content": "hi"}}]}',
        b'{"choices": [{"message": {"role": "assistant", "content": "hi",'
        b'"tool_calls": [{"id": "ignored"}]}}]}',
        b'{"choices": [{"message": {}}, {"message": {}}]}',
        b"[" * 1100 + b"]" * 1100,
    ],
)
def test_malformed_responses(body):
    with pytest.raises(LLMError) as error:
        client(StubTransport(HTTPResult(200, body))).complete(
            "سلام", output_limit_parameter=PARAMETER
        )
    assert error.value.code == ErrorCode.MALFORMED_RESPONSE
    assert error.value.__context__ is None


def test_response_limit_also_enforced_for_injected_transport():
    with pytest.raises(LLMError) as error:
        client(StubTransport(HTTPResult(200, b"x" * 65)), max_response_bytes=64).complete(
            "سلام", output_limit_parameter=PARAMETER
        )
    assert error.value.code == ErrorCode.RESPONSE_TOO_LARGE


def test_secret_echo_is_redacted_and_representations_are_safe():
    response = HTTPResult(200, completion_body(f"Bearer {KEY}"))
    connection = client(StubTransport(response))
    result = connection.complete("سلام", output_limit_parameter=PARAMETER)
    assert result.text == "Bearer [REDACTED]"
    assert KEY not in repr(result) + repr(response) + repr(connection)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"text": ""},
        {"text": " "},
        {"text": None},
        {"text": "x" * 4001},
        {"text": "\ud800"},
        {"max_output_tokens": 0},
        {"max_output_tokens": 257},
        {"max_output_tokens": True},
        {"output_limit_parameter": "max_tokens"},
    ],
)
def test_invalid_requests_never_call_transport(kwargs):
    transport = StubTransport()
    with pytest.raises(LLMError) as error:
        client(transport).complete(
            **({"text": "سلام", "output_limit_parameter": PARAMETER} | kwargs)
        )
    assert error.value.code == ErrorCode.INVALID_REQUEST
    assert transport.calls == []
