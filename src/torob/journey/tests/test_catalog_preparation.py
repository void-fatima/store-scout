import json

from torob.catalog.contracts import CONTRACT_VERSION, CatalogQuery
from torob.journey import prepare_catalog_request, start_journey


def test_catalog_handoff_retains_all_constraints_and_does_not_insert_search_defaults():
    criteria = {
        "q": "  گوشی سامسونگ  ",
        "min_price_toman": 10_000_000,
        "max_price_toman": 20_000_000,
        "city": "تهران",
        "area": "ونک",
    }
    state = start_journey({"request_id": "sample-catalog", "criteria": criteria}).state
    before = state.model_dump(mode="json")
    result = prepare_catalog_request(state)
    prepared = result.catalog_request
    assert result.error is None
    assert result.state.status == "catalog_request_prepared"
    assert prepared.request_id == state.request_id
    assert prepared.criteria.model_dump(exclude_none=True) == criteria
    assert prepared.parameters == {
        "q": "  گوشی سامسونگ  ",
        "min_price_toman": 10_000_000,
        "max_price_toman": 20_000_000,
    }
    assert prepared.catalog_contract_version == CONTRACT_VERSION
    assert prepared.unresolved_filters == ("city", "area")
    assert prepared.handoff_ready is False
    assert prepared.search_performed is False
    assert prepared.limitations
    # Existing draft contract accepts only the explicitly supported subset.
    CatalogQuery.model_validate(prepared.parameters, strict=True)
    assert state.model_dump(mode="json") == before
    payload = json.loads(result.model_dump_json())
    assert payload["search_performed"] is False
    assert payload["state"]["search_performed"] is False
    assert "items" not in payload and "total" not in payload


def test_optional_budget_and_area_are_not_filled_or_converted():
    state = start_journey(
        {"request_id": "sample-catalog", "criteria": {"q": "لپ تاپ", "city": "تهران"}}
    ).state
    result = prepare_catalog_request(state)
    assert result.catalog_request.parameters == {"q": "لپ تاپ"}
    assert result.catalog_request.unresolved_filters == ("city",)
    assert result.catalog_request.criteria.area is None
    assert result.catalog_request.criteria.min_price_toman is None
    assert result.catalog_request.criteria.max_price_toman is None


def test_missing_information_prevents_catalog_query_preparation():
    state = start_journey({"request_id": "sample-catalog", "criteria": {"q": "گوشی"}}).state
    result = prepare_catalog_request(state)
    assert result.catalog_request is None
    assert result.state.status == "needs_information"
    assert [item.field for item in result.missing_information] == ["criteria.city"]
    assert result.error is None


def test_incompatible_catalog_text_is_reported_without_rewriting_user_intent():
    state = start_journey(
        {"request_id": "sample-catalog", "criteria": {"q": "***", "city": "تهران"}}
    ).state
    result = prepare_catalog_request(state)
    assert result.error.code == "invalid_query"
    assert result.state.criteria.q == "***"
    assert result.catalog_request is None
    json.dumps(result.model_dump(mode="json"), allow_nan=False)


def test_invalid_state_cannot_be_prepared():
    result = prepare_catalog_request(None)
    assert result.error.code == "invalid_state"
    assert result.catalog_request is None
    assert result.search_performed is False
