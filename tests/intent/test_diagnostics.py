import json
import logging

import pytest

from torob.journey.intent.errors import IntentError
from torob.journey.intent.extraction import ExtractionConfig, LLMInterpreter
from torob.journey.llm.client import BoxAPIClient, OutputLimitParameter
from torob.journey.llm.config import LLMConfig
from torob.journey.llm.errors import LLMError

from .conftest import extracted

MESSAGE = "گوشی سامسونگ تا 40 میلیون تومان میخوام"
LOGGER = "torob.journey.intent.diagnostics"


def valid(**changes):
    return extracted(product_query="گوشی سامسونگ", max_budget="40 میلیون تومان") | changes


@pytest.mark.parametrize(
    ("output", "finish", "reason", "safe_finish", "fields"),
    [
        (valid(), "length", "llm_incomplete_response", "length", "-"),
        ('{"shopping_related":', "length", "llm_incomplete_response", "length", "-"),
        (valid(), "content_filter", "llm_malformed_response", "content_filter", "-"),
        (valid(), None, "non_stop_finish_reason", "missing", "-"),
        (valid(), "Authorization: unit-test-key", "llm_malformed_response", "other", "-"),
        ('{"shopping_related":', "stop", "invalid_json", "stop", "-"),
        ('{"shopping_related":true,"shopping_related":false}', "stop", "invalid_json", "stop", "-"),
        ('{"shopping_related":NaN}', "stop", "invalid_json", "stop", "-"),
        (valid(max_budget=40_000_000), "stop", "schema_validation", "stop", "max_budget"),
        (
            valid(**{"private-user-message": "raw-output"}),
            "stop",
            "schema_validation",
            "stop",
            "__unknown__",
        ),
        ([], "stop", "schema_validation", "stop", "__root__"),
        (valid(brand="Samsung"), "stop", "evidence_span_mismatch", "stop", "brand"),
        (
            valid(shopping_related=False),
            "stop",
            "irrelevant_fields",
            "stop",
            "max_budget,product_query",
        ),
        (
            valid(max_budget=None),
            "stop",
            "missing_monetary_evidence",
            "stop",
            "max_budget,min_budget",
        ),
    ],
)
def test_rejected_completion_reports_only_safe_guard_metadata(
    provider, caplog, output, finish, reason, safe_finish, fields
):
    provider.output, provider.reason = output, finish
    with caplog.at_level(logging.WARNING, logger=LOGGER):
        with pytest.raises((IntentError, LLMError)) as error:
            provider.interpreter().extract(MESSAGE)
    records = [record for record in caplog.records if record.name == LOGGER]
    assert len(records) == 1
    assert records[0].getMessage() == (
        f"intent_interpretation_rejected reason={reason} finish_reason={safe_finish} "
        f"max_output_tokens=1024 fields={fields}"
    )
    assert records[0].exc_info is None
    assert error.value.__context__ is None
    for private in (
        MESSAGE,
        "unit-test-key",
        "Authorization",
        "private-user-message",
        "raw-output",
    ):
        assert private not in caplog.text
    assert len(provider.calls) == 1


def test_existing_preference_guard_and_actual_configured_cap_are_diagnosable(provider, caplog):
    provider.output = valid()
    interpreter = LLMInterpreter(
        BoxAPIClient(
            LLMConfig("unit-test-key", "fixture-model"),
            transport=provider,
            max_output_tokens_limit=2048,
        ),
        ExtractionConfig(OutputLimitParameter.MAX_COMPLETION_TOKENS, 2048),
    )
    with caplog.at_level(logging.WARNING, logger=LOGGER), pytest.raises(IntentError):
        interpreter.extract(MESSAGE + " حتما گارانتی")
    assert caplog.records[-1].getMessage() == (
        "intent_interpretation_rejected reason=preference_evidence finish_reason=stop "
        "max_output_tokens=2048 fields=warranty"
    )
    assert json.loads(provider.calls[0][1]["body"])["max_completion_tokens"] == 2048
    assert len(provider.calls) == 1


def test_transport_failure_has_no_claim_about_a_completion(provider, caplog):
    provider.error = TimeoutError("private-transport-detail")
    with caplog.at_level(logging.WARNING, logger=LOGGER), pytest.raises(LLMError):
        provider.interpreter().extract(MESSAGE)
    assert caplog.records[-1].getMessage() == (
        "intent_interpretation_rejected reason=llm_timeout finish_reason=unavailable "
        "max_output_tokens=1024 fields=-"
    )
    assert "private-transport-detail" not in caplog.text


def test_post_extraction_normalization_is_distinct_without_guessing_completion_metadata(
    service, provider, caplog
):
    provider.output = valid(max_budget="-40 میلیون تومان")
    with caplog.at_level(logging.WARNING, logger=LOGGER), pytest.raises(IntentError) as error:
        service.create("گوشی سامسونگ تا -40 میلیون تومان میخوام")
    assert error.value.response.error.code == "invalid_interpretation"
    assert caplog.records[-1].getMessage() == (
        "intent_interpretation_rejected reason=criteria_normalization finish_reason=unavailable "
        "max_output_tokens=unavailable fields=-"
    )


def test_empty_natural_revision_reports_its_own_guard_and_keeps_state(service, provider, caplog):
    provider.output = valid()
    created = service.create(MESSAGE)
    provider.output = extracted()
    with caplog.at_level(logging.WARNING, logger=LOGGER), pytest.raises(IntentError):
        service.revise(created.draft.draft_id, created.access_token, 0, message="تأیید")
    assert "reason=empty_revision" in caplog.text
    assert service.get(created.draft.draft_id, created.access_token) == created.draft


def test_valid_completion_emits_no_rejection_diagnostic(provider, caplog):
    provider.output = valid()
    with caplog.at_level(logging.WARNING, logger=LOGGER):
        result = provider.interpreter().extract(MESSAGE)
    assert result.max_budget == "40 میلیون تومان"
    assert not [record for record in caplog.records if record.name == LOGGER]
