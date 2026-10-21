"""Recommendation contract tests; no ranking/retrieval/service logic is imported."""

import importlib
import json
import subprocess
import sys
from copy import deepcopy
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from pydantic import BaseModel, ValidationError

import torob.recommend as contracts
from torob.catalog.contracts import CatalogPage, CatalogQuery
from torob.catalog.contracts import OfferCandidate as CatalogOffer
from torob.recommend import (
    BeforeVisitVerification,
    CandidateBatch,
    CandidateCoverage,
    OfferCandidate,
    PurchaseConditions,
    RankingStrategy,
    RecommendationResponse,
    RecommendationResult,
    RetrievalPolicy,
    ScoreBreakdown,
    ShoppingCriteria,
)

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "src/torob/recommend/examples"


def read_example(name):
    return json.loads((EXAMPLES / name).read_text(encoding="utf-8"))


def criteria_payload(**updates):
    return {
        "query": "گوشی سامسونگ Galaxy A55",
        "max_budget": "25000000",
        "price_unit": "TOMAN",
    } | updates


@pytest.fixture
def published_page():
    return CatalogPage.model_validate_json(
        (ROOT / "contracts/examples/catalog-page.json").read_text(encoding="utf-8")
    )


@pytest.fixture
def result_payload():
    return deepcopy(read_example("recommendation_response.json")["data"]["recommendations"][0])


@pytest.fixture
def response_payload():
    return deepcopy(read_example("recommendation_response.json")["data"])


def coverage(total, **updates):
    return CandidateCoverage.model_validate(
        {
            "query": CatalogQuery(page_size=2),
            "pages_fetched": 1,
            "retrieved_count": min(total, 2),
            "catalog_total": total,
            "complete_for_query": total <= 2,
            "stop_reason": "exhausted" if total <= 2 else "page_limit",
        }
        | updates
    )


def test_offer_type_is_the_canonical_catalog_model(published_page):
    assert OfferCandidate is CatalogOffer
    assert all(isinstance(item, OfferCandidate) for item in published_page.items)
    assert CatalogPage.model_validate_json(published_page.model_dump_json()) == published_page


def test_package_import_is_independent_of_unfinished_implementations():
    # Run in a fresh interpreter so collection/import order cannot mask a dependency.
    script = (
        "import sys; import torob.recommend; "
        "assert not any(name in sys.modules for name in "
        "('torob.recommend.ranking', 'torob.recommend.catalog', 'torob.recommend.service'))"
    )
    subprocess.run([sys.executable, "-B", "-c", script], check=True)


def test_all_public_models_import_and_generate_closed_schemas():
    for name in contracts.__all__:
        exported = getattr(contracts, name)
        assert exported is getattr(importlib.import_module(exported.__module__), exported.__name__)
        if issubclass(exported, BaseModel):
            schema = exported.model_json_schema()
            assert schema["type"] == "object"
            assert schema["additionalProperties"] is False


def test_persian_query_is_saved_as_unicode_and_round_trips():
    value = ShoppingCriteria.model_validate(criteria_payload())
    assert value.query == "گوشی سامسونگ Galaxy A55"
    assert any("\u0600" <= char <= "\u06ff" for char in value.query)
    assert ShoppingCriteria.model_validate_json(value.model_dump_json()) == value
    assert value.max_budget == Decimal("25000000")
    assert isinstance(value.model_dump(mode="json")["max_budget"], str)


@pytest.mark.parametrize(
    "amount",
    [
        -1,
        0,
        True,
        False,
        "NaN",
        "Infinity",
        float("nan"),
        float("inf"),
        None,
        {},
        [],
        "",
        "bad-price",
        "1e1000000",
        "9000000000000.01",
        "0.99",
    ],
)
def test_invalid_budgets_are_rejected_at_the_money_field_or_budget_validator(amount):
    with pytest.raises(ValidationError) as caught:
        ShoppingCriteria.model_validate(criteria_payload(max_budget=amount))
    assert any(error["loc"] in [(), ("max_budget",)] for error in caught.value.errors())


@pytest.mark.parametrize("amount", [1, 2500.5, "25000000.125", Decimal("25.01")])
def test_budget_decimal_precision_and_serialization(amount):
    value = ShoppingCriteria.model_validate(criteria_payload(max_budget=amount))
    assert value.max_budget == Decimal(str(amount))
    assert ShoppingCriteria.model_validate_json(value.model_dump_json()) == value


@pytest.mark.parametrize(
    "unit,amount,expected",
    [
        ("TOMAN", "25000000.99", 25000000),
        ("IRR", "250000009.9", 25000000),
        ("IRR", "19.999999999999999999999999999999999999999", 1),
        ("TOMAN", "9000000000000", 9000000000000),
        ("IRR", "90000000000000", 9000000000000),
    ],
)
def test_budget_conversion_never_rounds_up(unit, amount, expected):
    value = ShoppingCriteria.model_validate(criteria_payload(price_unit=unit, max_budget=amount))
    assert value.budget_toman == expected


@pytest.mark.parametrize("amount", ["9.999999", "90000000000000.01"])
def test_rial_budget_must_cover_one_toman_and_respect_catalog_cap(amount):
    with pytest.raises(ValidationError):
        ShoppingCriteria.model_validate(criteria_payload(price_unit="IRR", max_budget=amount))


@pytest.mark.parametrize(
    "field,value",
    [
        ("query", ""),
        ("query", "  "),
        ("query", "***"),
        ("query", "x" * 201),
        ("query", None),
        ("query", 12),
        ("price_unit", "USD"),
        ("shopping_time", "tomorrow"),
        ("shopping_time", "2026-10-24T10:00:00"),
        ("shopping_time", 0),
        ("preferred_purchase_conditions", "cash"),
        ("unexpected", "rejected"),
    ],
)
def test_invalid_criteria_fields(field, value):
    with pytest.raises(ValidationError):
        ShoppingCriteria.model_validate(criteria_payload(**{field: value}))


@pytest.mark.parametrize("field", ["query", "max_budget", "price_unit"])
def test_required_criteria_fields(field):
    data = criteria_payload()
    data.pop(field)
    with pytest.raises(ValidationError) as caught:
        ShoppingCriteria.model_validate(data)
    assert caught.value.errors()[0]["loc"] == (field,)


@pytest.mark.parametrize(
    "field,value",
    [
        ("latitude", -90.01),
        ("latitude", 90.01),
        ("longitude", -180.01),
        ("longitude", 180.01),
        ("latitude", True),
        ("longitude", "51.4"),
        ("latitude", float("nan")),
        ("longitude", float("inf")),
        ("max_distance_km", 0),
        ("max_distance_km", -1),
        ("max_distance_km", 100.1),
        ("max_distance_km", True),
        ("max_distance_km", "5"),
    ],
)
def test_invalid_coordinates_and_distances_are_not_masked_by_invalid_query(field, value):
    data = criteria_payload(latitude=35.7, longitude=51.4, max_distance_km=5)
    data[field] = value
    with pytest.raises(ValidationError) as caught:
        ShoppingCriteria.model_validate(data)
    assert any(error["loc"] == (field,) for error in caught.value.errors())


@pytest.mark.parametrize("latitude,longitude", [(-90, -180), (90, 180), (0, 0)])
def test_coordinate_boundaries(latitude, longitude):
    value = ShoppingCriteria.model_validate(
        criteria_payload(latitude=latitude, longitude=longitude, max_distance_km=100)
    )
    assert (value.latitude, value.longitude) == (latitude, longitude)


@pytest.mark.parametrize("fields", [{"latitude": 35}, {"longitude": 51}, {"max_distance_km": 5}])
def test_location_cross_field_validation(fields):
    with pytest.raises(ValidationError):
        ShoppingCriteria.model_validate(criteria_payload(**fields))


@pytest.mark.parametrize(
    "timestamp",
    [
        "2026-10-24T10:00:00+03:30",
        "2026-10-24T06:30:00Z",
        datetime(2026, 10, 24, 6, 30, tzinfo=UTC),
    ],
)
def test_aware_shopping_timestamps(timestamp):
    value = ShoppingCriteria.model_validate(criteria_payload(shopping_time=timestamp))
    assert value.shopping_time.utcoffset() is not None


def test_optional_information_stays_unknown():
    value = ShoppingCriteria.model_validate(criteria_payload())
    for field in [
        "latitude",
        "longitude",
        "max_distance_km",
        "preferred_purchase_conditions",
        "shopping_time",
    ]:
        assert getattr(value, field) is None
    assert PurchaseConditions().model_dump() == {
        "payment_methods": None,
        "warranty_available": None,
        "return_window_days": None,
    }
    scores = ScoreBreakdown(product_match=1, budget_fit=0.5)
    assert scores.distance_fit is None
    assert scores.opening_hours_fit is None
    assert scores.purchase_conditions_fit is None
    assert scores.price_freshness is None


@pytest.mark.parametrize(
    "data",
    [
        {"payment_methods": []},
        {"payment_methods": ["card", "card"]},
        {"payment_methods": ["crypto"]},
        {"warranty_available": "yes"},
        {"return_window_days": True},
        {"return_window_days": -1},
        {"invented_condition": True},
    ],
)
def test_malformed_purchase_conditions(data):
    with pytest.raises(ValidationError):
        PurchaseConditions.model_validate(data)


def test_explicit_false_purchase_condition_is_preserved():
    terms = PurchaseConditions(warranty_available=False, return_window_days=0)
    assert terms.warranty_available is False
    assert terms.return_window_days == 0


@pytest.mark.parametrize("price", [-1, 0, "NaN", "Infinity", "bad-price", 9000000000001])
def test_canonical_invalid_prices(published_page, price):
    data = published_page.items[0].model_dump() | {"price_toman": price}
    with pytest.raises(ValidationError):
        OfferCandidate.model_validate(data)


def test_unknown_price_is_a_valid_recorded_offer(published_page):
    data = published_page.items[0].model_dump() | {"price_toman": None}
    item = OfferCandidate.model_validate(data)
    assert item.price_toman is None
    assert item.availability == "unconfirmed"


@pytest.mark.parametrize("field", ["offer_id", "product_id", "shop_id"])
@pytest.mark.parametrize("value", ["", " ", None])
def test_result_identifiers_reject_invalid_values(field, value, result_payload):
    result_payload[field] = value
    with pytest.raises(ValidationError):
        RecommendationResult.model_validate(result_payload)


@pytest.mark.parametrize("field", ["offer_id", "product_id", "shop_id"])
def test_result_identifiers_are_required(field, result_payload):
    result_payload.pop(field)
    with pytest.raises(ValidationError) as caught:
        RecommendationResult.model_validate(result_payload)
    assert caught.value.errors()[0]["loc"] == (field,)


@pytest.mark.parametrize("field", ["offer_id", "product_id", "shop_id"])
def test_result_identifiers_must_match_catalog_evidence(field, result_payload):
    result_payload[field] = "invented-other-id"
    with pytest.raises(ValidationError, match="must match"):
        RecommendationResult.model_validate(result_payload)


@pytest.mark.parametrize(
    "field", ["availability", "evidence", "requires_verification_before_visit"]
)
def test_catalog_uncertainty_and_offer_evidence_are_fixed(field, published_page):
    value = {
        "availability": "in_stock",
        "evidence": "shop_record_only",
        "requires_verification_before_visit": False,
    }[field]
    with pytest.raises(ValidationError):
        OfferCandidate.model_validate(published_page.items[0].model_dump() | {field: value})


def test_shop_category_without_offer_is_never_a_candidate():
    with pytest.raises(ValidationError):
        OfferCandidate.model_validate(
            {"shop": {"shop_id": "mock-shop", "name": "نمونه", "category_names": ["گوشی"]}}
        )


@pytest.mark.parametrize("status", ["verified_available", "verified_unavailable", "confirmed"])
def test_before_visit_contract_cannot_claim_verified_inventory(status):
    with pytest.raises(ValidationError):
        BeforeVisitVerification(status=status)


def test_inventory_limitation_is_required(result_payload):
    result_payload["data_limitations"] = [
        value
        for value in result_payload["data_limitations"]
        if value["code"] != "inventory_not_verified"
    ]
    with pytest.raises(ValidationError, match="uncertainty must be disclosed"):
        RecommendationResult.model_validate(result_payload)


@pytest.mark.parametrize(
    "field,value",
    [
        ("explanation_reasons", []),
        ("explanation_reasons", ["cheap"]),
        ("explanation_reasons", [{"code": "within_budget", "message": " "}]),
        ("data_limitations", ["unknown"]),
        ("score_breakdown", {"invented": 1}),
        ("candidate", {"shop_id": "not-an-offer"}),
        ("unexpected", True),
    ],
)
def test_malformed_recommendation_structures(field, value, result_payload):
    with pytest.raises(ValidationError):
        RecommendationResult.model_validate(result_payload | {field: value})


@pytest.mark.parametrize("score", [-0.1, 1.1, True, "0.5", float("nan"), float("inf")])
def test_scores_must_be_finite_normalized_numbers(score, result_payload):
    with pytest.raises(ValidationError):
        RecommendationResult.model_validate(result_payload | {"overall_score": score})
    with pytest.raises(ValidationError):
        ScoreBreakdown(product_match=score, budget_fit=0.5)


@pytest.mark.parametrize("score", [0, 1])
def test_score_boundaries(score, result_payload):
    value = RecommendationResult.model_validate(result_payload | {"overall_score": score})
    assert value.overall_score == score


def test_last_price_change_is_not_a_freshness_score():
    with pytest.raises(ValidationError):
        ScoreBreakdown(product_match=1, budget_fit=0.5, price_freshness=1)


def test_batch_preserves_context_and_nested_raw_values(published_page):
    batch = CandidateBatch(
        candidates=published_page.items, context=published_page.context, coverage=coverage(2)
    )
    assert CandidateBatch.model_validate_json(batch.model_dump_json()) == batch
    assert batch.context == published_page.context
    assert batch.candidates[0].shop.weekly_hours == published_page.items[0].shop.weekly_hours
    assert batch.candidates[0].shop.payment_options == published_page.items[0].shop.payment_options


def test_duplicate_candidate_ids_and_coverage_mismatch_rejected(published_page):
    with pytest.raises(ValidationError, match="duplicate"):
        CandidateBatch(
            candidates=[published_page.items[0]] * 2,
            context=published_page.context,
            coverage=coverage(2),
        )
    with pytest.raises(ValidationError, match="count"):
        CandidateBatch(
            candidates=published_page.items[:1],
            context=published_page.context,
            coverage=coverage(2),
        )


@pytest.mark.parametrize("field", ["offer", "product", "shop"])
def test_candidate_batch_rejects_blank_identifiers(field, published_page):
    data = published_page.items[0].model_dump()
    if field == "offer":
        data["offer_id"] = " "
    else:
        data[field][f"{field}_id"] = " "
    item = OfferCandidate.model_validate(data)
    with pytest.raises(ValidationError, match="must not be blank"):
        CandidateBatch(candidates=[item], context=published_page.context, coverage=coverage(1))


@pytest.mark.parametrize(
    "updates",
    [
        {"retrieved_count": 3},
        {"retrieved_count": 1},
        {"complete_for_query": False},
        {"stop_reason": "page_limit"},
        {"query": CatalogQuery(page=2)},
        {"pages_fetched": 2},
        {"full_dataset_ranking": True},
    ],
)
def test_inconsistent_or_overstated_coverage_rejected(updates):
    with pytest.raises(ValidationError):
        coverage(2, **updates)


def test_partial_and_empty_query_coverage_are_explicit():
    partial = coverage(3)
    assert partial.complete_for_query is False
    assert partial.full_dataset_ranking is False
    empty = coverage(0)
    assert empty.complete_for_query is True
    assert empty.retrieved_count == 0


@pytest.mark.parametrize(
    "policy", [{"max_pages": 0}, {"max_pages": 11}, {"page_size": 101}, {"max_pages": True}]
)
def test_retrieval_metadata_is_bounded(policy):
    with pytest.raises(ValidationError):
        RetrievalPolicy(**policy)


def test_strategy_is_only_validated_metadata():
    value = RankingStrategy()
    assert value.version == "lexical-v1"
    assert value.ordering == "product_match_desc,overall_score_desc,offer_id_asc"
    with pytest.raises(ValidationError, match="sum to 1"):
        RankingStrategy(price_weight=0.9)
    with pytest.raises(ValidationError):
        RankingStrategy(distance_scale_km=0)


def test_response_preserves_source_context_and_round_trips(response_payload):
    value = RecommendationResponse.model_validate(response_payload)
    assert RecommendationResponse.model_validate_json(value.model_dump_json()) == value
    assert RecommendationResponse.model_validate(value.model_dump(mode="json")) == value
    assert value.context.dataset.source_kind == "sample"
    assert value.context.dataset.coverage == "Tehran dataset; coverage is incomplete"
    assert "contact_numbers_synthetic" in value.context.notices
    assert value.coverage.full_dataset_ranking is False
    for result in value.recommendations:
        assert result.candidate.availability == "unconfirmed"
        assert result.before_visit_verification.requires_verification_before_visit is True


@pytest.mark.parametrize(
    "update",
    [
        {"considered_count": 99},
        {"eligible_count": 0},
        {"excluded_counts": {"unknown_price": -1}},
        {"schema_version": "1.0"},
        {"unexpected": "rejected"},
    ],
)
def test_inconsistent_response_rejected(update, response_payload):
    with pytest.raises(ValidationError):
        RecommendationResponse.model_validate(response_payload | update)


def test_response_rejects_duplicate_offers(response_payload):
    response_payload["recommendations"] = [response_payload["recommendations"][0]] * 2
    with pytest.raises(ValidationError, match="duplicate"):
        RecommendationResponse.model_validate(response_payload)


def test_empty_response_retains_honest_context(response_payload):
    response_payload.update(recommendations=[], eligible_count=0, excluded_counts={"irrelevant": 2})
    result = RecommendationResponse.model_validate(response_payload)
    assert result.recommendations == []
    assert result.considered_count == 2


@pytest.mark.parametrize(
    "filename,model",
    [
        ("shopping_request.json", ShoppingCriteria),
        ("catalog_candidates.json", CatalogPage),
        ("recommendation_response.json", RecommendationResponse),
        ("missing_optional_data.json", OfferCandidate),
    ],
)
def test_examples_are_explicit_mock_utf8_and_valid(filename, model):
    example = read_example(filename)
    assert example["fixture_metadata"]["is_mock"] is True
    assert "MOCK" in example["fixture_metadata"]["description"]
    assert "Torob" in example["fixture_metadata"]["description"]
    model.model_validate(example["data"])


def test_minimal_candidate_preserves_unknown_optional_information():
    item = OfferCandidate.model_validate(read_example("missing_optional_data.json")["data"])
    assert item.price_toman is None
    assert item.shop.lat is None and item.shop.lon is None
    assert item.distance_km is None
    assert item.last_price_changed_at is None
    assert item.shop.weekly_hours == {}
    assert item.shop.payment_options == []
    assert item.availability == "unconfirmed"


@pytest.mark.parametrize(
    "model,fields,required",
    [
        (
            ShoppingCriteria,
            {
                "query",
                "max_budget",
                "price_unit",
                "latitude",
                "longitude",
                "max_distance_km",
                "preferred_purchase_conditions",
                "shopping_time",
            },
            {"query", "max_budget", "price_unit"},
        ),
        (
            RecommendationResult,
            {
                "offer_id",
                "product_id",
                "shop_id",
                "candidate",
                "overall_score",
                "score_breakdown",
                "explanation_reasons",
                "data_limitations",
                "before_visit_verification",
            },
            {
                "offer_id",
                "product_id",
                "shop_id",
                "candidate",
                "overall_score",
                "score_breakdown",
                "explanation_reasons",
                "data_limitations",
            },
        ),
        (
            RecommendationResponse,
            {
                "schema_version",
                "strategy",
                "context",
                "coverage",
                "considered_count",
                "eligible_count",
                "excluded_counts",
                "recommendations",
                "notices",
            },
            {
                "strategy",
                "context",
                "coverage",
                "considered_count",
                "eligible_count",
                "excluded_counts",
                "recommendations",
            },
        ),
    ],
)
@pytest.mark.parametrize("mode", ["validation", "serialization"])
def test_stable_schema_structure(model, fields, required, mode):
    schema = model.model_json_schema(mode=mode)
    assert set(schema["properties"]) == fields
    assert set(schema["required"]) == required
    assert schema["additionalProperties"] is False


def test_output_schema_references_canonical_offer_and_keeps_inventory_literals():
    schema = RecommendationResponse.model_json_schema(mode="serialization")
    offer = schema["$defs"]["OfferCandidate"]
    assert set(offer["properties"]) == set(OfferCandidate.model_fields)
    assert offer["properties"]["availability"]["const"] == "unconfirmed"
    assert offer["properties"]["requires_verification_before_visit"]["const"] is True
    assert schema["properties"]["schema_version"]["const"] == "2.0"
