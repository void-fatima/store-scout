"""Internal alternative contracts, separate from the existing response and public API."""

from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BeforeValidator, Field, JsonValue, model_validator

from torob.catalog.contracts import OfferCandidate, distance_km
from torob.catalog.text import normalize_text

from .followup_models import FollowupPlan
from .models import (
    CandidateCoverage,
    Identifier,
    RecommendationContract,
    RecommendationResponse,
    RecommendationResult,
    RetrievalPolicy,
    ShoppingCriteria,
    Text,
    _number_input,
)

ConstraintField = Literal["query", "max_budget", "max_distance_km"]
DiagnosisCode = Literal[
    "no_matching_product_offers",
    "budget_too_restrictive",
    "radius_too_restrictive",
    "missing_price_data",
    "missing_geographic_data",
    "limited_catalog_coverage",
    "no_suitable_offer_in_retrieved_records",
]


class AlternativePolicy(RecommendationContract):
    retrieval: RetrievalPolicy = Field(
        default_factory=lambda: RetrievalPolicy(max_pages=2, page_size=50)
    )
    max_budget_increase_fraction: Annotated[
        float, BeforeValidator(_number_input), Field(ge=0, le=0.5, allow_inf_nan=False)
    ] = 0.25
    max_radius_multiplier: Annotated[
        float, BeforeValidator(_number_input), Field(ge=1, le=3, allow_inf_nan=False)
    ] = 2.0
    max_total_seconds: Annotated[
        float, BeforeValidator(_number_input), Field(gt=0, le=30, allow_inf_nan=False)
    ] = 5.0
    max_suggestions: int = Field(default=3, ge=1, le=10, strict=True)
    # Explicit caller-curated alternatives only. The engine invents no replacement query.
    alternative_queries: list[Annotated[Text, Field(max_length=200)]] = Field(
        default_factory=list, max_length=2
    )

    @model_validator(mode="after")
    def valid_queries(self) -> Self:
        normalized = [normalize_text(q) for q in self.alternative_queries]
        if not all(normalized) or len(set(normalized)) != len(normalized):
            raise ValueError("alternative queries must be meaningful and unique")
        return self

    def budget_limit_toman(self, original: ShoppingCriteria) -> int:
        return min(
            9_000_000_000_000,
            int(
                Decimal(original.budget_toman)
                * (1 + Decimal(str(self.max_budget_increase_fraction)))
            ),
        )


class ConstraintChange(RecommendationContract):
    field: ConstraintField
    original: JsonValue
    relaxed: JsonValue


class AlternativeDiagnosis(RecommendationContract):
    code: DiagnosisCode
    message: Text
    scope: Literal["retrieved_catalog_records"] = "retrieved_catalog_records"
    evidence_offer_ids: list[Identifier] = Field(default_factory=list)


def _check_plan(plan: FollowupPlan, candidate: OfferCandidate, criteria: ShoppingCriteria) -> None:
    if (plan.offer_id, plan.product_id, plan.shop_id) != (
        candidate.offer_id,
        candidate.product.product_id,
        candidate.shop.shop_id,
    ):
        raise ValueError("verification must refer to the same recorded offer")
    if (
        plan.recorded_price_toman != candidate.price_toman
        or plan.last_price_changed_at != candidate.last_price_changed_at
        or plan.recorded_weekly_hours != (candidate.shop.weekly_hours or None)
        or plan.recorded_payment_options != (candidate.shop.payment_options or None)
        or plan.recorded_warranty != candidate.warranty
        or plan.shopping_time != criteria.shopping_time
        or plan.requested_purchase_conditions != criteria.preferred_purchase_conditions
    ):
        raise ValueError("verification must preserve the offer and requested conditions")


class AlternativeSuggestion(RecommendationContract):
    suggestion_type: Literal[
        "budget_increase", "radius_increase", "product_query_change", "combined_relaxation"
    ]
    original_constraints: ShoppingCriteria
    relaxed_constraints: ShoppingCriteria
    changes: list[ConstraintChange] = Field(min_length=1, max_length=3)
    satisfies_original_constraints: Literal[False] = False
    requires_user_acceptance: Literal[True] = True
    evidence: Literal["catalog_offer_record"] = "catalog_offer_record"
    explanation: Text
    result: RecommendationResult
    verification: FollowupPlan

    @model_validator(mode="after")
    def disclosed_evidence(self) -> Self:
        original = self.original_constraints.model_dump(mode="json")
        relaxed = self.relaxed_constraints.model_dump(mode="json")
        actual = {key for key in original if original[key] != relaxed[key]}
        changes = {change.field: change for change in self.changes}
        if not actual or actual != changes.keys() or len(changes) != len(self.changes):
            raise ValueError("all changed constraints must be disclosed exactly once")
        for key, change in changes.items():
            if change.original != original[key] or change.relaxed != relaxed[key]:
                raise ValueError("change values must match the criteria snapshots")
        if "max_budget" in actual and (
            self.relaxed_constraints.max_budget <= self.original_constraints.max_budget
        ):
            raise ValueError("budget relaxation must increase the budget")
        if "query" in actual and (
            normalize_text(self.relaxed_constraints.query)
            == normalize_text(self.original_constraints.query)
        ):
            raise ValueError("query relaxation must change the normalized query")
        if "max_distance_km" in actual:
            old = self.original_constraints.max_distance_km
            new = self.relaxed_constraints.max_distance_km
            if old is None or new is None or new <= old:
                raise ValueError("radius relaxation must increase an existing radius")
        expected_type = (
            "combined_relaxation"
            if len(actual) > 1
            else {
                "query": "product_query_change",
                "max_budget": "budget_increase",
                "max_distance_km": "radius_increase",
            }[next(iter(actual))]
        )
        if self.suggestion_type != expected_type:
            raise ValueError("suggestion type must match the changes")
        candidate = self.result.candidate
        _check_plan(self.verification, candidate, self.relaxed_constraints)
        if candidate.price_toman is None or (
            candidate.price_toman > self.relaxed_constraints.budget_toman
        ):
            raise ValueError("alternative must have a recorded price within the relaxed budget")
        radius = self.relaxed_constraints.max_distance_km
        if radius is not None:
            distance = distance_km(
                self.relaxed_constraints.latitude,
                self.relaxed_constraints.longitude,
                candidate.shop.lat,
                candidate.shop.lon,
            )
            if distance is None or distance > radius:
                raise ValueError("alternative must have known distance within the relaxed radius")
        return self


class AlternativesResponse(RecommendationContract):
    schema_version: Literal["alternatives-v1"] = "alternatives-v1"
    original_constraints: ShoppingCriteria
    policy: AlternativePolicy
    original: RecommendationResponse
    original_verification: list[FollowupPlan]
    diagnoses: list[AlternativeDiagnosis]
    suggestions: list[AlternativeSuggestion]
    coverage: list[CandidateCoverage] = Field(min_length=1, max_length=4)
    catalog_requests: int = Field(ge=1, le=40, strict=True)
    warnings: list[Text] = Field(min_length=1)

    @model_validator(mode="after")
    def consistent_response(self) -> Self:
        if self.coverage[0] != self.original.coverage:
            raise ValueError("first coverage entry must describe the original search")
        if self.catalog_requests != sum(c.pages_fetched for c in self.coverage):
            raise ValueError("request count must match completed page retrievals")
        if len(self.coverage) > 2 + len(self.policy.alternative_queries):
            raise ValueError("too many Catalog probes")
        if any(c.pages_fetched > self.policy.retrieval.max_pages for c in self.coverage):
            raise ValueError("page budget exceeded")
        if [p.offer_id for p in self.original_verification] != [
            r.offer_id for r in self.original.recommendations
        ]:
            raise ValueError("every original recommendation needs a verification plan")
        for plan, result in zip(
            self.original_verification, self.original.recommendations, strict=True
        ):
            _check_plan(plan, result.candidate, self.original_constraints)
        if self.original.recommendations and self.suggestions:
            raise ValueError(
                "alternatives are searched only when original recommendations are empty"
            )
        ids = [s.result.offer_id for s in self.suggestions]
        if len(ids) != len(set(ids)) or len(ids) > self.policy.max_suggestions:
            raise ValueError("suggestions must be unique and respect the result limit")
        if any(s.original_constraints != self.original_constraints for s in self.suggestions):
            raise ValueError("suggestions must retain the original criteria")
        for suggestion in self.suggestions:
            relaxed = suggestion.relaxed_constraints
            if "max_budget" in {
                change.field for change in suggestion.changes
            } and relaxed.budget_toman > self.policy.budget_limit_toman(self.original_constraints):
                raise ValueError("alternative exceeds budget relaxation policy")
            radius = self.original_constraints.max_distance_km
            if radius is not None and relaxed.max_distance_km > min(
                100, radius * self.policy.max_radius_multiplier
            ):
                raise ValueError("alternative exceeds radius relaxation policy")
            if normalize_text(relaxed.query) != normalize_text(self.original_constraints.query):
                if normalize_text(relaxed.query) not in {
                    normalize_text(q) for q in self.policy.alternative_queries
                }:
                    raise ValueError("product query must be explicitly permitted by policy")
        return self
