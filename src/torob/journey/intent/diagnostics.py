"""Only fixed reason/field names and bounded configuration enter server logs."""

import logging

from torob.journey.llm.errors import ErrorCode

from .models import ExtractedFields

logger = logging.getLogger(__name__)
_REASONS = {
    "non_stop_finish_reason",
    "invalid_json",
    "schema_validation",
    "evidence_span_mismatch",
    "irrelevant_fields",
    "preference_evidence",
    "missing_monetary_evidence",
    "criteria_normalization",
    "empty_revision",
    *(f"llm_{code.value}" for code in ErrorCode),
}
_FIELDS = frozenset(ExtractedFields.model_fields) | {"__root__", "__unknown__"}


def rejection(reason: str, *, finish_reason="unavailable", max_output_tokens=None, fields=()):
    """No exception, input, completion, identifiers, model name or headers accepted."""
    reason = reason if reason in _REASONS else "unknown"
    # Callers normalize provider values before passing them here. Recheck the allowlist.
    finish = (
        finish_reason
        if isinstance(finish_reason, str)
        and finish_reason
        in {"stop", "length", "content_filter", "tool_calls", "function_call", "missing", "other"}
        else "unavailable"
    )
    limit = (
        max_output_tokens
        if type(max_output_tokens) is int and 16 <= max_output_tokens <= 2048
        else None
    )
    names = tuple(sorted({name if name in _FIELDS else "__unknown__" for name in fields}))
    logger.warning(
        "intent_interpretation_rejected reason=%s finish_reason=%s max_output_tokens=%s fields=%s",
        reason,
        finish,
        limit if limit is not None else "unavailable",
        ",".join(names) or "-",
    )
