import json

import pytest

from torob.catalog.contracts import CatalogPage, ErrorResponse
from torob.catalog.repository import CatalogRepository
from torob.recommend import RecommendationResponse, RetrievalPolicy
from torob.recommend.service import RecommendationServiceError, recommend


def test_service_uses_only_real_catalog_offers_and_keeps_context(db_path, criteria_factory):
    repository = CatalogRepository(db_path)
    criteria = criteria_factory(query="گوشی", max_budget="50000000", latitude=35.7, longitude=51.4)
    result = recommend(repository, criteria, retrieval=RetrievalPolicy(page_size=1, max_pages=5))
    assert len(result.recommendations) == 3
    for item in result.recommendations:
        detail = repository.offer(item.offer_id)
        assert detail is not None
        assert item.product_id == detail.item.product.product_id
        assert item.shop_id == detail.item.shop.shop_id
        assert item.candidate.shop == detail.item.shop
        assert item.candidate.product == detail.item.product
        assert item.candidate.availability == "unconfirmed"
        assert item.before_visit_verification.requires_verification_before_visit is True
    assert result.context == repository.context()
    assert RecommendationResponse.model_validate_json(result.model_dump_json()) == result


def test_http_service_matches_in_process_service(api_source, db_path, criteria_factory):
    criteria = criteria_factory(query="گوشی", max_budget="50000000")
    api_result = recommend(api_source, criteria)
    local_result = recommend(CatalogRepository(db_path), criteria)
    assert api_result == local_result


def test_service_accepts_serialized_validated_inputs(
    offer_factory, source_factory, criteria_factory
):
    source = source_factory([offer_factory("mock-1")])
    result = recommend(
        source,
        criteria_factory().model_dump(mode="json"),
        retrieval={"max_pages": 1, "page_size": 2},
        strategy={"max_results": 1},
    )
    assert result.eligible_count == 1
    assert source.calls[0].page_size == 2
    assert result.strategy.version == "lexical-v1"


@pytest.mark.parametrize(
    "updates",
    [
        {"criteria": {"query": "????", "max_budget": 100, "price_unit": "TOMAN"}},
        {"retrieval": {"max_pages": 0}},
        {"strategy": {"price_weight": 0.99}},
    ],
)
def test_invalid_input_is_structured_and_does_not_call_catalog(
    updates, source_factory, criteria_factory
):
    source = source_factory([])
    kwargs = {"criteria": criteria_factory()} | updates
    with pytest.raises(RecommendationServiceError) as caught:
        recommend(source, **kwargs)
    payload = caught.value.response
    assert payload.error.code == "invalid_recommendation_input"
    assert caught.value.retryable is False
    assert source.calls == []
    assert ErrorResponse.model_validate_json(payload.model_dump_json()) == payload


def test_upstream_failure_is_retryable_and_does_not_leak_private_error_text(
    source_factory, criteria_factory
):
    source = source_factory([])

    def failed(_query):
        raise OSError("private source path; credential=DO_NOT_EXPOSE")

    source.search = failed
    with pytest.raises(RecommendationServiceError) as caught:
        recommend(source, criteria_factory())
    assert caught.value.response.error.code == "catalog_unavailable"
    assert caught.value.retryable is True
    assert "DO_NOT_EXPOSE" not in caught.value.response.model_dump_json()
    assert any("\u0600" <= char <= "\u06ff" for char in caught.value.response.error.message)


def test_malformed_catalog_payload_is_structured(source_factory, criteria_factory):
    source = source_factory([])
    source.search = lambda _query: {"not": "a CatalogPage"}
    with pytest.raises(RecommendationServiceError) as caught:
        recommend(source, criteria_factory())
    assert caught.value.response.error.code == "catalog_invalid_response"
    assert caught.value.retryable is False


def test_snapshot_change_discards_all_partial_recommendations(
    offer_factory, source_factory, criteria_factory
):
    source = source_factory([offer_factory("mock-1"), offer_factory("mock-2")])
    original = source.search

    def changed(query):
        page = original(query)
        if query.page == 2:
            data = page.model_dump()
            data["context"]["dataset"]["dataset_id"] = "mock-new"
            return CatalogPage.model_validate(data)
        return page

    source.search = changed
    with pytest.raises(RecommendationServiceError) as caught:
        recommend(source, criteria_factory(), retrieval=RetrievalPolicy(page_size=1))
    assert caught.value.response.error.code == "catalog_snapshot_changed"
    assert caught.value.retryable is True
    assert len(source.calls) == 2


def test_valid_empty_result_retains_coverage_and_uncertainty(
    source_factory, empty_context, criteria_factory
):
    result = recommend(source_factory([], context=empty_context), criteria_factory())
    assert result.recommendations == []
    assert result.coverage.complete_for_query is True
    assert result.context.dataset is None
    assert "catalog_has_no_imported_dataset" in result.notices
    assert "no_eligible_offers" in result.notices


def test_no_qualifying_offers_does_not_claim_the_whole_dataset_is_empty(
    offer_factory, source_factory, criteria_factory
):
    case = offer_factory(
        "mock-case",
        price_toman=1,
        persian_title="قاب گوشی سامسونگ Galaxy A55",
        category_name="قاب گوشی",
    )
    phone = offer_factory("mock-phone", price_toman=20000000)
    source = source_factory([phone, case])
    result = recommend(
        source, criteria_factory(), retrieval=RetrievalPolicy(page_size=1, max_pages=1)
    )
    assert result.recommendations == []
    assert result.coverage.catalog_total == 2
    assert result.considered_count == 1
    assert result.coverage.complete_for_query is False
    assert "price_sorted_page_limit_may_omit_better_matches" in result.notices


def test_service_input_and_source_notices_are_not_mutated(
    offer_factory, source_factory, criteria_factory
):
    source = source_factory([offer_factory("mock-1")])
    criteria = criteria_factory()
    before = json.dumps(source.context.model_dump(mode="json"), sort_keys=True)
    criteria_before = criteria.model_dump_json()
    recommend(source, criteria)
    assert json.dumps(source.context.model_dump(mode="json"), sort_keys=True) == before
    assert criteria.model_dump_json() == criteria_before
