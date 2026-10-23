import copy
import json

import pytest

from torob.journey.intake import start_journey
from torob.journey.updates import update_criteria


def initial_state():
    return start_journey(
        {
            "request_id": "sample-update",
            "criteria": {
                "q": "گوشی",
                "max_price_toman": 20_000_000,
                "city": "تهران",
                "area": "ونک",
            },
        }
    ).state


def test_budget_update_preserves_identity_query_and_selected_location():
    state = initial_state()
    before = state.model_dump(mode="json")
    changes = {"max_price_toman": 25_000_000}
    original_changes = copy.deepcopy(changes)
    result = update_criteria(state, changes)
    assert result.error is None
    assert result.state.request_id == state.request_id
    assert result.state.criteria.q == "گوشی"
    assert (result.state.criteria.city, result.state.criteria.area) == ("تهران", "ونک")
    assert result.state.criteria.max_price_toman == 25_000_000
    assert state.model_dump(mode="json") == before
    serialized = result.model_dump(mode="json")
    serialized["state"]["criteria"]["area"] = "changed"
    assert state.model_dump(mode="json") == before
    assert changes == original_changes


def test_incremental_completion_and_explicit_clearing_of_optional_criteria():
    state = start_journey({"request_id": "sample-update", "criteria": {"area": "ونک"}}).state
    partial = update_criteria(state, {"q": "گوشی"})
    assert [item.field for item in partial.missing_information] == ["criteria.city"]
    complete = update_criteria(partial.state, {"city": "تهران", "max_price_toman": 20_000_000})
    assert complete.state.status == "criteria_ready"
    assert complete.state.criteria.area == "ونک"
    cleared = update_criteria(complete.state, {"max_price_toman": None, "area": None})
    assert cleared.state.criteria.max_price_toman is None
    assert cleared.state.criteria.area is None
    assert cleared.state.criteria.q == "گوشی" and cleared.state.criteria.city == "تهران"
    assert complete.state.criteria.area == "ونک"


def test_invalid_budget_patch_is_atomic_even_when_other_values_are_valid():
    state = initial_state()
    result = update_criteria(state, {"q": "لپ تاپ", "min_price_toman": 30_000_000})
    assert result.error.code == "invalid_update"
    assert result.state == state
    assert result.state.criteria.q == "گوشی"
    assert result.catalog_request is None
    json.dumps(result.model_dump(mode="json"), allow_nan=False)


@pytest.mark.parametrize(
    "changes", [None, [], {"request_id": "other"}, {"criteria": {}}, {"q": 5}, {"ready": True}]
)
def test_malformed_patches_cannot_change_identity_or_reset_existing_criteria(changes):
    state = initial_state()
    result = update_criteria(state, changes)
    assert result.state == state
    assert result.error.code == "invalid_update"
    assert result.search_performed is False
    json.dumps(result.model_dump(mode="json"), allow_nan=False)


def test_clearing_required_information_changes_preparation_state_without_guessing():
    state = initial_state()
    result = update_criteria(state, {"q": None, "city": " "})
    assert result.state.status == "needs_information"
    assert {item.field for item in result.missing_information} == {"criteria.q", "criteria.city"}
    assert result.state.criteria.area == state.criteria.area
    assert result.state.criteria.max_price_toman == state.criteria.max_price_toman
    assert result.error is None


def test_unidentified_or_arbitrary_states_are_rejected():
    result = update_criteria(None, {"q": "گوشی"})
    assert result.state is None
    assert result.error.code == "invalid_state"
