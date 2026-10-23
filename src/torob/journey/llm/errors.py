"""Allowlisted diagnostics: never retain upstream messages, bodies or exceptions."""

from enum import StrEnum


class ErrorCode(StrEnum):
    MISSING_API_KEY = "missing_api_key"
    MISSING_MODEL = "missing_model"
    INVALID_CONFIGURATION = "invalid_configuration"
    INVALID_REQUEST = "invalid_request"
    AUTHENTICATION = "authentication"
    MODEL_ACCESS = "model_access"
    RATE_LIMIT = "rate_limit"
    TIMEOUT = "timeout"
    MALFORMED_RESPONSE = "malformed_response"
    INCOMPLETE_RESPONSE = "incomplete_response"
    RESPONSE_TOO_LARGE = "response_too_large"
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    REQUEST_REJECTED = "request_rejected"
    BILLING_REQUIRED = "billing_required"
    REDIRECT_REFUSED = "redirect_refused"
    TRANSPORT = "transport_error"


_MESSAGES = {
    ErrorCode.MISSING_API_KEY: "Set STORE_SCOUT_LLM_API_KEY on the server.",
    ErrorCode.MISSING_MODEL: "Set an account-accessible STORE_SCOUT_LLM_MODEL explicitly.",
    ErrorCode.INVALID_CONFIGURATION: "Check LLM credentials, HTTPS base URL and resource limits.",
    ErrorCode.INVALID_REQUEST: "Check text and the selected model's output-limit parameter.",
    ErrorCode.AUTHENTICATION: "Provider authentication failed; check the local API key.",
    ErrorCode.MODEL_ACCESS: "Model or endpoint unavailable; check model access and base URL.",
    ErrorCode.RATE_LIMIT: "Provider rate limit reached; no retry was attempted.",
    ErrorCode.TIMEOUT: "Provider request timed out; no retry was attempted.",
    ErrorCode.MALFORMED_RESPONSE: "Provider did not return a valid text completion.",
    ErrorCode.INCOMPLETE_RESPONSE: "Provider output was truncated; no retry was attempted.",
    ErrorCode.RESPONSE_TOO_LARGE: "Provider response exceeded the configured byte limit.",
    ErrorCode.PROVIDER_UNAVAILABLE: "Provider is unavailable; no retry was attempted.",
    ErrorCode.REQUEST_REJECTED: "Provider rejected the request; check model parameter support.",
    ErrorCode.BILLING_REQUIRED: "Provider requires credit or billing access.",
    ErrorCode.REDIRECT_REFUSED: "Provider redirect refused; verify the HTTPS base URL.",
    ErrorCode.TRANSPORT: "Provider transport failed; no retry was attempted.",
}


def safe_finish_reason(value: object) -> str:
    """Provider-controlled values must never become diagnostic text."""
    if value is None:
        return "missing"
    if isinstance(value, str) and value in {
        "stop",
        "length",
        "content_filter",
        "tool_calls",
        "function_call",
    }:
        return value
    return "other"


_NO_COMPLETION = object()


class LLMError(Exception):
    """Safe to log normally or serialize with as_dict; no upstream data attached."""

    def __init__(self, code: ErrorCode, *, finish_reason: object = _NO_COMPLETION):
        self.code = ErrorCode(code)
        self.finish_reason = (
            "unavailable" if finish_reason is _NO_COMPLETION else safe_finish_reason(finish_reason)
        )
        super().__init__(_MESSAGES[self.code])

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code.value, "message": str(self)}
