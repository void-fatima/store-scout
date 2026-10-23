import copy
import json

import pytest

from torob.journey.intake import start_journey


def test_complete_shopping_request_preserves_optional_constraints():
    payload = {
        "request_id": "sample-1",
        "criteria": {"q": "گوشی", "max_price_toman": 20_000_000, "city": "تهران", "area": "ونک"},
    }
    original = copy.deepcopy(payload)
    result = start_journey(payload)
    assert result.state.status == "criteria_ready"
    assert result.state.criteria.area == "ونک"
    assert result.state.criteria.min_price_toman is None
    assert result.state.request_id == "sample-1"
    assert not result.missing_information and result.error is None
    assert result.search_performed is False and result.state.search_performed is False
    serialized = json.loads(result.model_dump_json())
    serialized["state"]["criteria"]["q"] = "changed"
    assert payload == original
    assert result.state.criteria.q == "گوشی"


@pytest.mark.parametrize("query", [None, "", "  \t"])
def test_missing_query_and_city_are_distinct_from_malformed_values(query):
    result = start_journey({"request_id": "sample-1", "criteria": {"q": query, "area": "ونک"}})
    assert result.state.status == "needs_information"
    assert {item.field for item in result.missing_information} == {"criteria.q", "criteria.city"}
    assert result.state.criteria.area == "ونک"
    assert result.state.criteria.q == query
    assert result.error is None


def test_missing_identity_is_not_generated():
    result = start_journey({"criteria": {"q": "گوشی", "city": "تهران"}})
    assert result.state is None
    assert [item.field for item in result.missing_information] == ["request_id"]
    assert result.error is None


@pytest.mark.parametrize(
    "payload",
    [
        None,
        [],
        {"request_id": 1},
        {"request_id": "sample-1", "criteria": []},
        {"request_id": "sample-1", "criteria": {"q": 123}},
        {"request_id": "sample-1", "criteria": {"city": {"name": "تهران"}}},
        {"request_id": "sample-1", "criteria": {"min_price_toman": -1}},
        {"request_id": "sample-1", "criteria": {"min_price_toman": 20, "max_price_toman": 10}},
        {"request_id": "sample-1", "criteria": {"budget": 20, "currency": "rial"}},
        {"request_id": "sample-1", "search_performed": True},
    ],
)
def test_malformed_requests_return_json_safe_errors(payload):
    result = start_journey(payload)
    assert result.state is None
    assert result.error.code == "invalid_request"
    assert result.error.details
    assert result.search_performed is False
    json.dumps(result.model_dump(mode="json"), allow_nan=False)
