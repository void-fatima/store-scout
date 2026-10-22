"""Journey mapping tests use the actual owning Recommendation models."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from pydantic import ValidationError

from torob.journey.adapter import JourneyRequestError, adapt_criteria
from torob.journey.intake import start_journey
from torob.journey.models import ComparisonKey, ComparisonState, SearchCriteria
from torob.journey.updates import update_criteria
from torob.recommend.models import PriceUnit, ShoppingCriteria


def coordinate_criteria(**changes):
    return SearchCriteria.model_validate(
        {
            "q": "گوشی سامسونگ",
            "max_price_toman": 20_000_000,
            "latitude": 35.7,
            "longitude": 51.4,
            "max_distance_km": 5.0,
        }
        | changes
    )


def test_legacy_toman_mapping_and_coordinate_request_do_not_require_textual_city():
    criteria = coordinate_criteria()
    result = adapt_criteria(criteria)
    assert type(result) is ShoppingCriteria
    assert result.max_budget == Decimal(20_000_000)
    assert result.price_unit == PriceUnit.TOMAN
    assert result.latitude == 35.7 and result.longitude == 51.4
    state = start_journey(
        {"request_id": "mapping", "revision": 7, "criteria": criteria.model_dump()}
    ).state
    assert state.status == "criteria_ready" and state.revision == 7
    assert state.criteria.city is None


def test_exact_rial_budget_preferences_and_aware_shopping_time_survive_json_roundtrip():
    amount = "200000009.123456789123456789"
    criteria = coordinate_criteria(
        max_price_toman=None,
        max_budget=amount,
        price_unit="IRR",
        preferred_purchase_conditions={
            "payment_methods": ["card"],
            "warranty_available": True,
            "return_window_days": 3,
        },
        shopping_time="2026-10-24T15:30:00+03:30",
    )
    mapped = adapt_criteria(criteria)
    assert mapped.max_budget == Decimal(amount)
    assert mapped.budget_toman == 20_000_000
    assert mapped.preferred_purchase_conditions.return_window_days == 3
    assert mapped.shopping_time.utcoffset().total_seconds() == 12600
    assert mapped == ShoppingCriteria.model_validate_json(mapped.model_dump_json())
    assert mapped.model_dump(mode="json")["max_budget"] == amount


@pytest.mark.parametrize(
    "field,value", [("city", "تهران"), ("area", "ونک"), ("min_price_toman", 10)]
)
def test_unrepresentable_constraints_are_retained_and_actionable_even_with_coordinates(
    field, value
):
    criteria = coordinate_criteria(**{field: value})
    with pytest.raises(JourneyRequestError) as failure:
        adapt_criteria(criteria)
    error = failure.value.response.error
    assert error.code == "unsupported_constraint"
    assert error.details[0]["field"] == f"criteria.{field}"
    assert getattr(criteria, field) == value


def test_text_location_is_not_geocoded_or_treated_as_sufficient_for_recommendations():
    criteria = SearchCriteria(q="گوشی", city="تهران", area="ونک", max_price_toman=20_000_000)
    with pytest.raises(JourneyRequestError) as failure:
        adapt_criteria(criteria)
    assert failure.value.response.error.code == "missing_information"
    assert "coordinates" in failure.value.response.error.details[0]["message"]


def test_missing_query_budget_and_explicit_unit_have_distinct_actionable_fields():
    with pytest.raises(JourneyRequestError) as failure:
        adapt_criteria(SearchCriteria(latitude=35.7, longitude=51.4))
    assert {d["field"] for d in failure.value.response.error.details} == {
        "criteria.q",
        "criteria.max_budget",
        "criteria.price_unit",
    }


@pytest.mark.parametrize(
    "changes",
    [
        {"max_budget": "20", "price_unit": "IRR"},  # ambiguous with legacy maximum
        {"max_price_toman": None, "max_budget": 20.1, "price_unit": "TOMAN"},
        {"max_price_toman": None, "max_budget": True, "price_unit": "TOMAN"},
        {"max_price_toman": None, "max_budget": "9", "price_unit": "IRR"},
        {"max_price_toman": None, "max_budget": "9000000000001", "price_unit": "TOMAN"},
        {"latitude": True},
        {"longitude": "51.4"},
        {"latitude": None},
        {"max_distance_km": float("nan")},
        {"shopping_time": "2026-10-24T15:30:00"},
        {"shopping_time": 1792841400},
    ],
)
def test_invalid_or_ambiguous_new_inputs_are_rejected_by_journey_and_owning_models(changes):
    with pytest.raises(ValidationError):
        coordinate_criteria(**changes)


def test_updates_increment_revision_and_invalidate_comparison_atomically():
    state = start_journey(
        {"request_id": "mapping", "revision": 4, "criteria": coordinate_criteria().model_dump()}
    ).state
    comparison = ComparisonState(
        request_id=state.request_id,
        revision=state.revision,
        keys=(ComparisonKey(dataset_id="sample", product_id="p", offer_id="o"),),
    )
    state = type(state).model_validate(state.model_dump() | {"comparison": comparison})
    updated = update_criteria(state, {"max_price_toman": 25_000_000})
    assert updated.state.revision == 5 and updated.state.comparison is None
    assert state.revision == 4 and state.comparison == comparison
    rejected = update_criteria(state, {"max_price_toman": "25000000", "q": "کتری"})
    assert rejected.error.code == "invalid_update" and rejected.state == state
    assert rejected.state.revision == 4


def test_explicit_budget_updates_revalidate_whole_request_and_retain_preferences():
    criteria = coordinate_criteria(
        max_price_toman=None,
        max_budget="200000000.123456789",
        price_unit="IRR",
        shopping_time=datetime(2026, 10, 24, 12, tzinfo=UTC),
        preferred_purchase_conditions={"payment_methods": ["card"]},
    )
    state = start_journey({"request_id": "mapping", "criteria": criteria.model_dump()}).state
    result = update_criteria(state, {"max_budget": "250000000.987654321"})
    assert adapt_criteria(result.state.criteria).max_budget == Decimal("250000000.987654321")
    assert result.state.criteria.shopping_time == criteria.shopping_time
    assert (
        result.state.criteria.preferred_purchase_conditions
        == criteria.preferred_purchase_conditions
    )
    rejected = update_criteria(state, {"max_budget": "0.5"})
    assert rejected.error is not None and rejected.state == state
