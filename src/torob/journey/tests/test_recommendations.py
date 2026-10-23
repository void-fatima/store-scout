"""Behavior tests exercise the actual Task 03 service and temporary Catalog database."""

import json
from decimal import Decimal

import pytest

from torob.catalog.contracts import CatalogQuery
from torob.journey.adapter import JourneyRequestError
from torob.journey.models import ComparisonKey
from torob.journey.recommendations import (
    AlternativeAcceptance,
    JourneyRecommendations,
    accept_alternative,
    comparison_keys,
    run_recommendations,
    select_for_comparison,
)
from torob.journey.updates import update_criteria
from torob.recommend.alternative_models import AlternativePolicy
from torob.recommend.models import RetrievalPolicy
from torob.recommend.service import RecommendationServiceError


class ObservedSource:
    def __init__(self, repository):
        self.repository = repository
        self.calls = []

    def search(self, query):
        self.calls.append(query)
        return self.repository.search(query)


def test_normal_results_use_one_task03_invocation_preserve_rank_and_metadata(
    journey_repository, journey_request, monkeypatch
):
    from torob.journey import recommendations as workflow

    service = workflow.find_alternatives
    calls = []

    def observed(*args, **kwargs):
        calls.append(args[1])
        return service(*args, **kwargs)

    monkeypatch.setattr(workflow, "find_alternatives", observed)
    source = ObservedSource(journey_repository)
    response = run_recommendations(source, journey_request())
    result = response.result
    assert len(calls) == 1 and len(source.calls) == 1
    assert result.catalog_requests == 1
    assert [r.offer_id for r in result.original.recommendations] == [
        "sample_offer_1",
        "sample_offer_3",
    ]
    assert result.original.context == journey_repository.context()
    assert response.state.request_id == "sample-journey" and response.state.revision == 2
    assert response.state.search_performed is True
    assert result.original.coverage.full_dataset_ranking is False
    assert result.original.context.dataset.source_kind == "sample"
    assert "contact_numbers_synthetic" in result.warnings
    assert all(p.state == "awaiting_user_verification" for p in result.original_verification)
    assert all(q.state == "pending" for p in result.original_verification for q in p.checklist)
    assert JourneyRecommendations.model_validate_json(response.model_dump_json()) == response


def test_valid_empty_response_keeps_dataset_and_diagnostic_coverage(
    journey_repository, journey_request
):
    response = run_recommendations(journey_repository, journey_request(q="محصول ناموجود"))
    assert response.result.original.recommendations == []
    assert response.result.suggestions == []
    assert response.result.catalog_requests == 2
    assert response.result.original.context.dataset.dataset_id
    assert response.result.diagnoses[0].scope == "retrieved_catalog_records"


def test_alternatives_disclose_changes_but_never_mutate_or_automatically_relax_request(
    journey_repository, journey_request
):
    state = journey_request(max_price_toman=18_000_000)
    before = state.model_dump()
    response = run_recommendations(journey_repository, state)
    assert not response.result.original.recommendations
    assert response.result.suggestions
    suggestion = response.result.suggestions[0]
    assert suggestion.requires_user_acceptance and not suggestion.satisfies_original_constraints
    assert suggestion.original_constraints.max_budget == Decimal(18_000_000)
    assert suggestion.relaxed_constraints.max_budget == Decimal(20_000_000)
    assert suggestion.changes[0].field == "max_budget"
    assert state.model_dump() == before
    assert response.state.criteria.max_price_toman == 18_000_000


def test_explicit_acceptance_validates_changes_advances_revision_and_requires_fresh_search(
    journey_repository, journey_request
):
    source = ObservedSource(journey_repository)
    response = run_recommendations(source, journey_request(max_price_toman=18_000_000))
    selected = select_for_comparison(response, comparison_keys(response.result)[:1])
    suggestion = response.result.suggestions[0]
    acceptance = AlternativeAcceptance(
        request_id=response.state.request_id,
        expected_revision=response.state.revision,
        dataset_id=response.result.original.context.dataset.dataset_id,
        offer_id=suggestion.result.offer_id,
        accepted_changes=tuple(suggestion.changes),
    )
    calls = len(source.calls)
    fresh = accept_alternative(selected, acceptance, current_state=selected.state)
    assert len(source.calls) == calls  # acceptance alone never returns old results as fresh
    assert fresh.revision == response.state.revision + 1
    assert fresh.comparison is None and not fresh.search_performed
    assert fresh.criteria.max_price_toman == 20_000_000
    rerun = run_recommendations(source, fresh)
    assert rerun.result.original.recommendations and len(source.calls) > calls
    for patch in (
        {"expected_revision": 99},
        {"dataset_id": "old"},
        {"request_id": "other"},
        {"offer_id": "not-in-results"},
        {
            "accepted_changes": [
                {"field": "max_budget", "original": "18000000", "relaxed": "99999999"}
            ]
        },
    ):
        bad = AlternativeAcceptance.model_validate(acceptance.model_dump() | patch)
        with pytest.raises(JourneyRequestError):
            accept_alternative(response, bad, current_state=response.state)
    changed = update_criteria(response.state, {"max_price_toman": 19_000_000}).state
    with pytest.raises(JourneyRequestError, match="Refresh"):
        accept_alternative(response, acceptance, current_state=changed)


def test_acceptance_preserves_rial_unit_fractional_input_preferences_and_time(
    journey_repository, journey_request
):
    state = journey_request(
        max_price_toman=None,
        max_budget="180000009.123456789",
        price_unit="IRR",
        shopping_time="2026-10-24T15:00:00+03:30",
        preferred_purchase_conditions={"payment_methods": ["card"]},
    )
    response = run_recommendations(journey_repository, state)
    suggestion = response.result.suggestions[0]
    fresh = accept_alternative(
        response,
        AlternativeAcceptance(
            request_id=state.request_id,
            expected_revision=state.revision,
            dataset_id=response.result.original.context.dataset.dataset_id,
            offer_id=suggestion.result.offer_id,
            accepted_changes=tuple(suggestion.changes),
        ),
        current_state=state,
    )
    assert fresh.criteria.max_budget == Decimal("200000000")
    assert fresh.criteria.price_unit == "IRR"
    assert fresh.criteria.shopping_time == state.criteria.shopping_time
    assert (
        fresh.criteria.preferred_purchase_conditions == state.criteria.preferred_purchase_conditions
    )
    assert response.result.original_constraints.max_budget == Decimal("180000009.123456789")


def test_comparison_distinguishes_same_titles_and_invalidates_on_revision_or_dataset_change(
    journey_repository, journey_request
):
    response = run_recommendations(journey_repository, journey_request())
    candidates = response.result.original.recommendations
    assert (
        candidates[0].candidate.product.persian_title
        == candidates[1].candidate.product.persian_title
    )
    keys = comparison_keys(response.result)
    assert len(keys) == 2 and keys[0].product_id != keys[1].product_id
    selected = select_for_comparison(response, keys)
    rerun = run_recommendations(journey_repository, selected.state)
    assert rerun.state.comparison == selected.state.comparison
    updated = update_criteria(selected.state, {"q": "کتری"})
    assert updated.state.revision == 3 and updated.state.comparison is None

    class NewDataset:
        def search(self, query):
            page = journey_repository.search(query)
            data = page.model_dump()
            data["context"]["dataset"]["dataset_id"] = "new-dataset"
            return type(page).model_validate(data)

    assert run_recommendations(NewDataset(), selected.state).state.comparison is None
    wrong_product = ComparisonKey(
        dataset_id=keys[0].dataset_id, product_id="wrong", offer_id=keys[0].offer_id
    )
    with pytest.raises(JourneyRequestError, match="dataset/product/offer"):
        select_for_comparison(response, (wrong_product,))
    with pytest.raises(JourneyRequestError):
        select_for_comparison(response, (keys[0], keys[0]))


@pytest.mark.parametrize(
    "criteria",
    [
        {"city": "تهران"},
        {"area": "ونک"},
        {"min_price_toman": 1},
        {"latitude": None, "longitude": None, "max_distance_km": None},
    ],
)
def test_unenforceable_or_missing_location_never_queries_catalog(criteria, journey_request):
    class ForbiddenSource:
        def search(self, query):
            raise AssertionError("Must validate all constraints before retrieval")

    with pytest.raises(JourneyRequestError):
        run_recommendations(ForbiddenSource(), journey_request(**criteria))


@pytest.mark.parametrize("between_probes", [False, True])
def test_snapshot_changes_discard_response_between_pages_or_probes(
    between_probes, journey_repository, journey_request
):
    class ChangingSnapshot:
        calls = 0

        def search(self, query):
            self.calls += 1
            page = journey_repository.search(query)
            data = page.model_dump()
            if self.calls > 1:
                data["context"]["dataset"]["dataset_id"] = "changed"
            return type(page).model_validate(data)

    policy = AlternativePolicy(retrieval=RetrievalPolicy(page_size=1, max_pages=2))
    with pytest.raises(RecommendationServiceError) as failure:
        run_recommendations(
            ChangingSnapshot(),
            journey_request(max_price_toman=18_000_000 if between_probes else 20_000_000),
            policy=policy,
        )
    assert failure.value.response.error.code == "catalog_snapshot_changed"
    assert failure.value.retryable


def test_upstream_failure_preserves_canonical_error_without_raw_exception(journey_request):
    class FailedSource:
        def search(self, query):
            raise RuntimeError("private database path and SQL")

    with pytest.raises(RecommendationServiceError) as failure:
        run_recommendations(FailedSource(), journey_request())
    payload = failure.value.response.model_dump_json()
    assert failure.value.response.error.code == "catalog_unavailable"
    assert "private database" not in payload and failure.value.retryable


def test_unknown_prices_inventory_hours_and_serialization_preserve_canonical_semantics(
    journey_repository, journey_request
):
    # The real sample's unknown price survives diagnostic coverage, never a budget-qualified result.
    unknown = next(
        c for c in journey_repository.search(CatalogQuery(q="گوشی")).items if c.price_toman is None
    )
    assert unknown.availability == "unconfirmed"
    response = run_recommendations(journey_repository, journey_request(max_price_toman=1))
    assert "missing_price_data" in {d.code for d in response.result.diagnoses}
    assert not response.result.suggestions

    class UnknownHours:
        def search(self, query):
            page = journey_repository.search(query)
            data = page.model_dump()
            for item in data["items"]:
                item["shop"]["weekly_hours"] = {}
                item["shop"]["payment_options"] = []
            return type(page).model_validate(data)

    response = run_recommendations(UnknownHours(), journey_request())
    payload = json.loads(response.model_dump_json())
    result = payload["result"]
    assert result == response.result.model_dump(mode="json")
    assert result["original"]["context"]["dataset"]["dataset_id"]
    plan = result["original_verification"][0]
    assert plan["opening_hours_status"] == "unknown" and plan["recorded_weekly_hours"] is None
    assert plan["payment_status"] == "unknown" and not plan["contact_attempted"]
    assert plan["contact_policy"] == "synthetic_contacts_not_for_contact"
    assert result["original"]["recommendations"][0]["candidate"]["availability"] == "unconfirmed"


def test_page_limit_and_exact_rial_budget_are_visible_in_canonical_output(
    journey_repository, journey_request
):
    response = run_recommendations(
        journey_repository,
        journey_request(max_price_toman=None, max_budget="200000009.123456789", price_unit="IRR"),
        policy=AlternativePolicy(retrieval=RetrievalPolicy(page_size=1, max_pages=1)),
    )
    assert response.result.original.coverage.stop_reason == "page_limit"
    assert not response.result.original.coverage.complete_for_query
    assert response.result.original_constraints.max_budget == Decimal("200000009.123456789")
    assert response.result.original.coverage.query.max_price_toman == 20_000_000


def test_combined_budget_radius_alternative_requires_every_disclosed_change(
    journey_repository, journey_request
):
    response = run_recommendations(
        journey_repository,
        journey_request(max_price_toman=18_000_000, latitude=35.71, max_distance_km=1.0),
    )
    suggestion = response.result.suggestions[0]
    assert {c.field for c in suggestion.changes} == {"max_budget", "max_distance_km"}
    acceptance = AlternativeAcceptance(
        request_id=response.state.request_id,
        expected_revision=response.state.revision,
        dataset_id=response.result.original.context.dataset.dataset_id,
        offer_id=suggestion.result.offer_id,
        accepted_changes=tuple(suggestion.changes[:1]),
    )
    with pytest.raises(JourneyRequestError, match="every disclosed change"):
        accept_alternative(response, acceptance, current_state=response.state)
    acceptance = AlternativeAcceptance.model_validate(
        acceptance.model_dump() | {"accepted_changes": tuple(suggestion.changes)}
    )
    fresh = accept_alternative(response, acceptance, current_state=response.state)
    assert fresh.criteria.max_distance_km == suggestion.relaxed_constraints.max_distance_km
    assert fresh.criteria.max_price_toman == 20_000_000
    assert response.state.criteria.max_distance_km == 1.0


def test_only_explicitly_curated_product_queries_are_used_and_accepted(
    journey_repository, journey_request
):
    response = run_recommendations(
        journey_repository,
        journey_request(q="لپ تاپ"),
        policy=AlternativePolicy(alternative_queries=["گوشی سامسونگ"]),
    )
    suggestion = response.result.suggestions[0]
    assert [c.field for c in suggestion.changes] == ["query"]
    fresh = accept_alternative(
        response,
        AlternativeAcceptance(
            request_id=response.state.request_id,
            expected_revision=response.state.revision,
            dataset_id=response.result.original.context.dataset.dataset_id,
            offer_id=suggestion.result.offer_id,
            accepted_changes=tuple(suggestion.changes),
        ),
        current_state=response.state,
    )
    assert fresh.criteria.q == "گوشی سامسونگ"
    assert response.state.criteria.q == "لپ تاپ"


def test_missing_database_is_never_created_or_initialized(tmp_path, journey_request):
    from torob.catalog.repository import CatalogRepository

    missing = tmp_path / "not-created.sqlite3"
    with pytest.raises(RecommendationServiceError):
        run_recommendations(CatalogRepository(missing), journey_request())
    assert not missing.exists()
