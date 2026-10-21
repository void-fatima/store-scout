"""MOCK offers exercise constraints; integration cases use the real sample Catalog."""

import json

import pytest
from pydantic import ValidationError

from torob.catalog.contracts import CatalogPage, CatalogQuery, distance_km
from torob.catalog.repository import CatalogRepository
from torob.catalog.text import normalize_text
from torob.recommend.alternative_models import (
    AlternativePolicy,
    AlternativesResponse,
    AlternativeSuggestion,
)
from torob.recommend.alternatives import find_alternatives
from torob.recommend.followup_models import FollowupPlan
from torob.recommend.service import RecommendationServiceError


class FilteredSource:
    """Literal filtering over known MOCK records, with observable page requests."""

    def __init__(self, items, context):
        self.items = sorted(
            items, key=lambda c: (c.price_toman is None, c.price_toman or 0, c.offer_id)
        )
        self.context = context
        self.calls = []

    def search(self, query):
        self.calls.append(CatalogQuery.model_validate(query.model_dump()))
        items = []
        for item in self.items:
            words = normalize_text(
                " ".join(
                    filter(
                        None,
                        [
                            item.product.persian_title,
                            item.product.brand_name,
                            item.product.model,
                            item.product.category_name,
                        ],
                    )
                )
            ).split()
            if not all(
                any(word.startswith(token) for word in words)
                for token in normalize_text(query.q).split()
            ):
                continue
            if query.max_price_toman is not None and (
                item.price_toman is None or item.price_toman > query.max_price_toman
            ):
                continue
            if query.radius_km is not None:
                d = distance_km(query.lat, query.lon, item.shop.lat, item.shop.lon)
                if d is None or d > query.radius_km:
                    continue
            items.append(item)
        start = (query.page - 1) * query.page_size
        return CatalogPage(
            items=items[start : start + query.page_size],
            total=len(items),
            page=query.page,
            page_size=query.page_size,
            has_next=start + query.page_size < len(items),
            context=self.context,
        )


@pytest.fixture
def filtered_source(canonical_page):
    return lambda items: FilteredSource(items, canonical_page.context.model_copy(deep=True))


def codes(response):
    return {d.code for d in response.diagnoses}


def test_budget_alternative_preserves_original_and_records(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    offer = offer_factory("mock-budget", price_toman=22000000)
    criteria = criteria_factory(max_budget=20000000)
    result = find_alternatives(filtered_source([offer]), criteria)
    assert result.original.recommendations == []
    assert "budget_too_restrictive" in codes(result)
    assert len(result.suggestions) == 1
    suggestion = result.suggestions[0]
    assert suggestion.suggestion_type == "budget_increase"
    assert suggestion.original_constraints == criteria
    assert suggestion.relaxed_constraints.budget_toman == 22000000
    assert suggestion.changes[0].field == "max_budget"
    assert suggestion.result.candidate == offer
    assert suggestion.satisfies_original_constraints is False
    assert suggestion.requires_user_acceptance is True
    assert "20000000" in suggestion.explanation and "22000000" in suggestion.explanation
    assert suggestion.verification.recorded_price_toman == 22000000
    assert result.catalog_requests == 2


def test_budget_currency_conversion_does_not_relax_more_than_needed(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    result = find_alternatives(
        filtered_source([offer_factory("mock-rial", price_toman=22000000)]),
        criteria_factory(max_budget="200000009", price_unit="IRR"),
    )
    suggestion = result.suggestions[0]
    assert suggestion.relaxed_constraints.price_unit == "IRR"
    assert suggestion.relaxed_constraints.max_budget == 220000000


def test_radius_alternative_keeps_budget_and_discloses_exact_distance(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    offer = offer_factory("mock-far", price_toman=18000000, lat=35.713, lon=51.4)
    criteria = criteria_factory(latitude=35.7, longitude=51.4, max_distance_km=1)
    response = find_alternatives(filtered_source([offer]), criteria)
    assert "radius_too_restrictive" in codes(response)
    alternative = response.suggestions[0]
    assert alternative.suggestion_type == "radius_increase"
    assert alternative.relaxed_constraints.max_budget == criteria.max_budget
    actual = distance_km(35.7, 51.4, offer.shop.lat, offer.shop.lon)
    assert alternative.relaxed_constraints.max_distance_km == actual
    assert alternative.changes[0].original == 1
    assert alternative.changes[0].relaxed == actual
    assert alternative.result.candidate == offer


def test_combined_relaxation_is_explicit(offer_factory, criteria_factory, filtered_source):
    offer = offer_factory("mock-combined", price_toman=22000000, lat=35.713)
    criteria = criteria_factory(
        max_budget=20000000,
        latitude=35.7,
        longitude=51.4,
        max_distance_km=1,
    )
    alternative = find_alternatives(filtered_source([offer]), criteria).suggestions[0]
    assert alternative.suggestion_type == "combined_relaxation"
    assert {c.field for c in alternative.changes} == {"max_budget", "max_distance_km"}
    assert alternative.satisfies_original_constraints is False


def test_prefer_one_small_change_before_two_changes(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    items = [
        offer_factory("mock-both", price_toman=21000000, lat=35.713),
        offer_factory("mock-big", price_toman=24000000),
        offer_factory("mock-small", price_toman=21000000),
    ]
    response = find_alternatives(
        filtered_source(items),
        criteria_factory(
            max_budget=20000000,
            latitude=35.7,
            longitude=51.4,
            max_distance_km=1,
        ),
    )
    assert [s.result.offer_id for s in response.suggestions] == [
        "mock-small",
        "mock-big",
        "mock-both",
    ]


def test_policy_caps_exclude_expensive_or_distant_alternatives(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    source = filtered_source(
        [
            offer_factory("mock-expensive", price_toman=26000000),
            offer_factory("mock-too-far", price_toman=18000000, lat=35.75),
        ]
    )
    response = find_alternatives(
        source,
        criteria_factory(
            max_budget=20000000,
            latitude=35.7,
            longitude=51.4,
            max_distance_km=1,
        ),
    )
    assert response.suggestions == []
    assert {"budget_too_restrictive", "radius_too_restrictive"} <= codes(response)


def test_missing_prices_and_locations_are_not_alternatives(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    source = filtered_source(
        [
            offer_factory("mock-price", price_toman=None),
            offer_factory("mock-geo", price_toman=19000000, lat=None, lon=None),
        ]
    )
    result = find_alternatives(
        source,
        criteria_factory(latitude=35.7, longitude=51.4, max_distance_km=1),
    )
    assert result.suggestions == []
    assert {"missing_price_data", "missing_geographic_data"} <= codes(result)
    missing = next(d for d in result.diagnoses if d.code == "missing_price_data")
    assert missing.evidence_offer_ids == ["mock-price"]


def test_empty_catalog_does_not_invent_offers_or_global_absence(
    criteria_factory,
    filtered_source,
):
    response = find_alternatives(filtered_source([]), criteria_factory())
    assert response.suggestions == []
    assert codes(response) == {"no_matching_product_offers"}
    assert "کل بازار" in response.diagnoses[0].message
    assert response.diagnoses[0].scope == "retrieved_catalog_records"


def test_shop_category_does_not_establish_an_offer(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    offer = offer_factory(
        "mock-case",
        persian_title="قاب گوشی سامسونگ Galaxy A55",
        category_name="قاب گوشی",
        price_toman=1,
        category_names=["گوشی"],
    )
    response = find_alternatives(filtered_source([offer]), criteria_factory())
    assert response.suggestions == []
    assert "no_matching_product_offers" in codes(response)


def test_successful_original_search_has_plans_and_no_diagnostic_queries(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    source = filtered_source([offer_factory("mock-ok")])
    response = find_alternatives(source, criteria_factory())
    assert response.original.recommendations
    assert response.suggestions == []
    assert len(source.calls) == 1
    assert len(response.original_verification) == len(response.original.recommendations)
    assert response.original_verification[0].availability == "unconfirmed"
    assert response.original_verification[0].contact_attempted is False


def test_explicit_product_query_is_catalog_backed_and_disclosed(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    offer = offer_factory(
        "mock-other",
        persian_title="گوشی شیائومی Redmi Note 13",
        brand_name="شیائومی",
        model="Redmi Note 13",
        price_toman=15000000,
    )
    response = find_alternatives(
        filtered_source([offer]),
        criteria_factory(),
        policy={"alternative_queries": ["گوشی شیائومی"]},
    )
    assert len(response.coverage) == 3
    suggestion = response.suggestions[0]
    assert suggestion.suggestion_type == "product_query_change"
    assert suggestion.result.candidate == offer
    assert suggestion.changes[0].original == criteria_factory().query
    assert suggestion.changes[0].relaxed == "گوشی شیائومی"
    assert suggestion.relaxed_constraints.max_budget == criteria_factory().max_budget


def test_no_automatic_product_query_or_unrelated_offer(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    other = offer_factory(
        "mock-other",
        persian_title="کتری برقی",
        brand_name=None,
        model=None,
        category_name="لوازم خانگی",
        price_toman=100000,
    )
    source = filtered_source([other])
    result = find_alternatives(source, criteria_factory())
    assert result.suggestions == []
    assert {q.q for q in source.calls} == {criteria_factory().query}


def test_duplicate_alternative_records_are_deduplicated(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    offer = offer_factory(
        "mock-other",
        persian_title="گوشی شیائومی Redmi Note 13",
        brand_name="شیائومی",
        model="Redmi Note 13",
        price_toman=15000000,
    )
    response = find_alternatives(
        filtered_source([offer]),
        criteria_factory(),
        policy={"alternative_queries": ["گوشی شیائومی", "Redmi"]},
    )
    assert len(response.suggestions) == 1


def test_page_limits_and_coverage_disclose_unseen_offers(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    source = filtered_source(
        [
            offer_factory(
                f"mock-case-{i}",
                persian_title="قاب گوشی سامسونگ Galaxy A55",
                category_name="قاب گوشی",
                price_toman=i + 1,
            )
            for i in range(4)
        ]
        + [offer_factory("mock-unseen", price_toman=21000000)]
    )
    response = find_alternatives(
        source,
        criteria_factory(max_budget=20000000),
        policy={"retrieval": {"max_pages": 1, "page_size": 2}},
    )
    assert len(source.calls) == response.catalog_requests == 2
    assert all(q.page == 1 and q.page_size == 2 for q in source.calls)
    assert response.suggestions == []
    assert "limited_catalog_coverage" in codes(response)
    assert all(not c.complete_for_query for c in response.coverage)


def test_maximum_probe_and_page_bounds(criteria_factory, filtered_source):
    source = filtered_source([])
    response = find_alternatives(
        source,
        criteria_factory(),
        policy={
            "alternative_queries": ["لپ تاپ", "هدفون"],
            "retrieval": {"max_pages": 1, "page_size": 1},
        },
    )
    assert response.catalog_requests == len(source.calls) == 4


def test_inventory_and_unknown_conditions_survive_alternatives(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    offer = offer_factory(
        "mock-unknown",
        price_toman=22000000,
        weekly_hours={},
        payment_options=[],
        last_price_changed_at=None,
        warranty=None,
    )
    result = find_alternatives(
        filtered_source([offer]),
        criteria_factory(max_budget=20000000),
    )
    suggestion = result.suggestions[0]
    assert suggestion.result.candidate.availability == "unconfirmed"
    assert suggestion.result.before_visit_verification.status == "unverified"
    assert suggestion.verification.opening_hours_status == "unknown"
    assert suggestion.verification.payment_status == "unknown"
    assert suggestion.verification.last_price_changed_at is None
    assert suggestion.verification.contact_attempted is False
    assert "synthetic_contacts_not_for_contact" in result.warnings


def test_failure_discards_partial_search_and_hides_source_details(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    source = filtered_source([offer_factory("mock-price", price_toman=22000000)])
    original = source.search

    def search(query):
        if query.max_price_toman is None:
            raise OSError("SECRET-CREDENTIAL")
        return original(query)

    source.search = search
    with pytest.raises(RecommendationServiceError) as caught:
        find_alternatives(source, criteria_factory(max_budget=20000000))
    assert caught.value.response.error.code == "catalog_unavailable"
    assert caught.value.retryable is True
    assert "SECRET-CREDENTIAL" not in caught.value.response.model_dump_json()


def test_snapshot_change_between_probes_is_rejected(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    source = filtered_source([offer_factory("mock-price", price_toman=22000000)])
    original = source.search

    def search(query):
        page = original(query)
        if query.max_price_toman is None:
            page.context = page.context.model_copy(deep=True)
            page.context.dataset.dataset_id = "mock-changed"
        return page

    source.search = search
    with pytest.raises(RecommendationServiceError) as caught:
        find_alternatives(source, criteria_factory(max_budget=20000000))
    assert caught.value.response.error.code == "catalog_snapshot_changed"


@pytest.mark.parametrize(
    "ticks,expected_calls",
    [
        ([0, 6], 0),
        ([0, 0, 6], 1),
        ([0, 0, 1, 6], 1),
    ],
)
def test_total_deadline_stops_more_queries(
    ticks,
    expected_calls,
    criteria_factory,
    filtered_source,
):
    source = filtered_source([])
    clock = iter(ticks).__next__
    with pytest.raises(RecommendationServiceError) as caught:
        find_alternatives(source, criteria_factory(), clock=clock)
    assert caught.value.response.error.code == "catalog_time_limit"
    assert caught.value.retryable is True
    assert len(source.calls) == expected_calls


def test_http_timeout_is_limited_to_remaining_budget(criteria_factory, canonical_page):
    from torob.recommend.catalog import CatalogAPIClient

    timeouts = []

    class Transport:
        def get(self, path, *, params, timeout):
            timeouts.append(timeout)
            raise TimeoutError("private timeout")

    clock = iter([0, 4]).__next__
    source = CatalogAPIClient(Transport(), timeout_seconds=5)
    with pytest.raises(RecommendationServiceError) as caught:
        find_alternatives(source, criteria_factory(), clock=clock)
    assert caught.value.response.error.code == "catalog_unavailable"
    assert timeouts == [1]
    assert source.timeout_seconds == 5


@pytest.mark.parametrize(
    "policy",
    [
        {"max_total_seconds": 0},
        {"max_total_seconds": float("inf")},
        {"max_budget_increase_fraction": -1},
        {"max_budget_increase_fraction": 0.6},
        {"max_radius_multiplier": 4},
        {"max_suggestions": True},
        {"alternative_queries": ["???"]},
        {"alternative_queries": ["گوشی", "گوشی"]},
        {"alternative_queries": ["a", "b", "c"]},
        {"retrieval": {"max_pages": 11}},
    ],
)
def test_invalid_policy_never_calls_catalog(policy, criteria_factory, filtered_source):
    source = filtered_source([])
    with pytest.raises(RecommendationServiceError) as caught:
        find_alternatives(source, criteria_factory(), policy=policy)
    assert caught.value.response.error.code == "invalid_recommendation_input"
    assert not source.calls


@pytest.mark.parametrize(
    "mutation",
    [
        "remove_changes",
        "wrong_original",
        "wrong_type",
        "pretend_original_fit",
        "pretend_verification",
        "wrong_evidence",
        "undisclosed_coordinates",
    ],
)
def test_malformed_alternative_contract_is_rejected(
    mutation,
    offer_factory,
    criteria_factory,
    filtered_source,
):
    response = find_alternatives(
        filtered_source([offer_factory("mock-budget", price_toman=22000000)]),
        criteria_factory(max_budget=20000000),
    )
    data = response.suggestions[0].model_dump()
    if mutation == "remove_changes":
        data["changes"] = []
    elif mutation == "wrong_original":
        data["changes"][0]["original"] = "1"
    elif mutation == "wrong_type":
        data["suggestion_type"] = "radius_increase"
    elif mutation == "pretend_original_fit":
        data["satisfies_original_constraints"] = True
    elif mutation == "pretend_verification":
        data["verification"]["contact_attempted"] = True
    elif mutation == "wrong_evidence":
        data["verification"]["recorded_price_toman"] = 1
    else:
        data["relaxed_constraints"].update(latitude=35.7, longitude=51.4)
    with pytest.raises(ValidationError):
        AlternativeSuggestion.model_validate(data)


def test_stable_utf8_serialization_and_inputs_unchanged(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    items = [
        offer_factory("mock-b", price_toman=22000000),
        offer_factory("mock-a", price_toman=22000000),
    ]
    criteria = criteria_factory(max_budget=20000000)
    before = criteria.model_dump_json(), [item.model_dump_json() for item in items]
    first = find_alternatives(filtered_source(items), criteria)
    second = find_alternatives(filtered_source(list(reversed(items))), criteria)
    assert first == second
    assert [s.result.offer_id for s in first.suggestions] == ["mock-a", "mock-b"]
    assert AlternativesResponse.model_validate_json(first.model_dump_json()) == first
    serialized = json.dumps(first.model_dump(mode="json"), ensure_ascii=False)
    assert "بودجه" in serialized and "????" not in serialized
    assert before == (criteria.model_dump_json(), [item.model_dump_json() for item in items])
    assert AlternativePolicy.model_json_schema()["additionalProperties"] is False
    assert AlternativesResponse.model_json_schema()["properties"]["schema_version"]["const"] == (
        "alternatives-v1"
    )


def test_real_catalog_integration_only_returns_recorded_offers(db_path, criteria_factory):
    source = CatalogRepository(db_path)
    criteria = criteria_factory(query="گوشی", max_budget=17000000)
    response = find_alternatives(source, criteria)
    assert response.original.recommendations == []
    assert response.suggestions
    for suggestion in response.suggestions:
        assert suggestion.result.candidate == source.offer(suggestion.result.offer_id).item
        assert suggestion.original_constraints == criteria
        assert suggestion.result.candidate.availability == "unconfirmed"
    assert response.original.context == source.context()


def test_http_and_repository_results_agree(api_source, db_path, criteria_factory):
    criteria = criteria_factory(query="گوشی", max_budget=17000000)
    assert find_alternatives(api_source, criteria) == find_alternatives(
        CatalogRepository(db_path),
        criteria,
    )


@pytest.mark.parametrize(
    "mutation",
    [
        "budget_policy",
        "request_count",
        "missing_plan",
        "wrong_original_plan",
    ],
)
def test_response_rejects_inconsistent_policy_and_verification(
    mutation,
    offer_factory,
    criteria_factory,
    filtered_source,
):
    budget = 25000000 if mutation in {"missing_plan", "wrong_original_plan"} else 20000000
    response = find_alternatives(
        filtered_source([offer_factory("mock-record", price_toman=22000000)]),
        criteria_factory(max_budget=budget),
    )
    data = response.model_dump()
    if mutation == "budget_policy":
        data["policy"]["max_budget_increase_fraction"] = 0
    elif mutation == "request_count":
        data["catalog_requests"] += 1
    elif mutation == "missing_plan":
        data["original_verification"] = []
    else:
        data["original_verification"][0]["recorded_price_toman"] = 1
    with pytest.raises(ValidationError):
        AlternativesResponse.model_validate(data)


def test_response_cannot_remove_permission_for_changed_product_query(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    offer = offer_factory(
        "mock-other",
        persian_title="گوشی شیائومی Redmi",
        brand_name="شیائومی",
        model="Redmi",
        price_toman=15000000,
    )
    response = find_alternatives(
        filtered_source([offer]),
        criteria_factory(),
        policy={"alternative_queries": ["گوشی شیائومی"]},
    )
    data = response.model_dump()
    data["policy"]["alternative_queries"] = []
    with pytest.raises(ValidationError):
        AlternativesResponse.model_validate(data)


def test_response_rejects_radius_policy_violation(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    response = find_alternatives(
        filtered_source([offer_factory("mock-far", lat=35.713, price_toman=19000000)]),
        criteria_factory(latitude=35.7, longitude=51.4, max_distance_km=1),
    )
    data = response.model_dump()
    data["policy"]["max_radius_multiplier"] = 1
    with pytest.raises(ValidationError):
        AlternativesResponse.model_validate(data)


def test_relaxation_can_be_disabled(offer_factory, criteria_factory, filtered_source):
    response = find_alternatives(
        filtered_source([offer_factory("mock-expensive", price_toman=21000000)]),
        criteria_factory(max_budget=20000000),
        policy={"max_budget_increase_fraction": 0, "max_radius_multiplier": 1},
    )
    assert "budget_too_restrictive" in codes(response)
    assert response.suggestions == []


def test_diagnostic_pagination_stops_at_page_budget(
    offer_factory,
    criteria_factory,
    filtered_source,
):
    source = filtered_source(
        [offer_factory(f"mock-{i}", price_toman=21000000 + i) for i in range(4)]
    )
    result = find_alternatives(
        source,
        criteria_factory(max_budget=20000000),
        policy={"retrieval": {"max_pages": 2, "page_size": 1}, "max_suggestions": 1},
    )
    assert [(q.max_price_toman, q.page) for q in source.calls] == [
        (20000000, 1),
        (None, 1),
        (None, 2),
    ]
    assert result.catalog_requests == 3
    assert len(result.suggestions) == 1
    assert result.suggestions[0].result.offer_id == "mock-0"
    assert result.coverage[1].catalog_total == 4
    assert result.coverage[1].retrieved_count == 2
    assert "limited_catalog_coverage" in codes(result)


@pytest.mark.parametrize("malformed", [None, {"items": []}])
def test_malformed_source_never_returns_partial_alternatives(
    malformed,
    criteria_factory,
    filtered_source,
):
    source = filtered_source([])
    source.search = lambda query: malformed
    with pytest.raises(RecommendationServiceError) as caught:
        find_alternatives(source, criteria_factory())
    assert caught.value.response.error.code == "catalog_invalid_response"
    assert caught.value.retryable is False


@pytest.mark.parametrize(
    "name,model",
    [
        ("alternatives_response.json", AlternativesResponse),
        ("followup_plan.json", FollowupPlan),
    ],
)
def test_mock_examples_are_valid_and_explicitly_labelled(name, model):
    from pathlib import Path

    path = Path(__file__).resolve().parents[2] / "src/torob/recommend/examples" / name
    fixture = json.loads(path.read_text(encoding="utf-8"))
    assert fixture["fixture_kind"] == "MOCK"
    assert "not actual Torob records" in fixture["description"]
    assert model.model_validate(fixture["data"])
