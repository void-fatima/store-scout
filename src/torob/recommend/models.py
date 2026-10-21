"""Recommendation-only contracts; Catalog offers are never redefined here."""

import math
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Literal, Self

from pydantic import (
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from torob.catalog.contracts import CatalogContext, CatalogQuery, OfferCandidate
from torob.catalog.text import normalize_text


def _money_input(value: object) -> object:
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise ValueError("money must be a numeric amount")
    return value


def _number_input(value: object) -> object:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError("expected a number, not a boolean or numeric string")
    return value


def _datetime_input(value: object) -> object:
    if not isinstance(value, (str, datetime)):
        raise ValueError("expected an ISO timestamp with offset or an aware datetime")
    return value


Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Score = Annotated[float, BeforeValidator(_number_input), Field(ge=0, le=1, allow_inf_nan=False)]
Budget = Annotated[Decimal, BeforeValidator(_money_input), Field(gt=0, allow_inf_nan=False)]


class RecommendationContract(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_default=True)


class PriceUnit(StrEnum):
    TOMAN = "TOMAN"
    IRR = "IRR"


class PaymentMethod(StrEnum):
    CASH = "cash"
    CARD = "card"
    INSTALLMENTS = "installments"


class PurchaseConditions(RecommendationContract):
    payment_methods: list[PaymentMethod] | None = Field(default=None, min_length=1)
    warranty_available: bool | None = Field(default=None, strict=True)
    return_window_days: int | None = Field(default=None, ge=0, strict=True)

    @model_validator(mode="after")
    def unique_methods(self) -> Self:
        if self.payment_methods and len(set(self.payment_methods)) != len(self.payment_methods):
            raise ValueError("payment_methods must be unique")
        return self


class ShoppingCriteria(RecommendationContract):
    query: Annotated[Text, Field(max_length=200)]
    max_budget: Budget
    price_unit: PriceUnit
    latitude: (
        Annotated[float, BeforeValidator(_number_input), Field(ge=-90, le=90, allow_inf_nan=False)]
        | None
    ) = None
    longitude: (
        Annotated[
            float, BeforeValidator(_number_input), Field(ge=-180, le=180, allow_inf_nan=False)
        ]
        | None
    ) = None
    max_distance_km: (
        Annotated[float, BeforeValidator(_number_input), Field(gt=0, le=100, allow_inf_nan=False)]
        | None
    ) = None
    preferred_purchase_conditions: PurchaseConditions | None = None
    shopping_time: Annotated[AwareDatetime, BeforeValidator(_datetime_input)] | None = None

    @property
    def budget_toman(self) -> int:
        # Floor towards zero: a fractional toman must not widen the budget.
        # int(Decimal) is exact; division before truncation could round a very
        # long fractional amount up under Decimal's default precision.
        whole_units = int(self.max_budget)
        return whole_units // 10 if self.price_unit == PriceUnit.IRR else whole_units

    @model_validator(mode="after")
    def valid_criteria(self) -> Self:
        if not normalize_text(self.query):
            raise ValueError("query must contain letters or digits")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be supplied together")
        if self.max_distance_km is not None and self.latitude is None:
            raise ValueError("max_distance_km requires user coordinates")
        limit = 90_000_000_000_000 if self.price_unit == PriceUnit.IRR else 9_000_000_000_000
        # Bound the Decimal before converting it to an integer, including large
        # exponent input. Compare directly so fractional amounts cannot bypass it.
        if self.max_budget > limit or self.budget_toman < 1:
            raise ValueError("budget must cover 1 to 9_000_000_000_000 whole toman")
        return self


class RetrievalPolicy(RecommendationContract):
    max_pages: int = Field(default=3, ge=1, le=10, strict=True)
    page_size: int = Field(default=100, ge=1, le=100, strict=True)


class CandidateCoverage(RecommendationContract):
    query: CatalogQuery
    pages_fetched: int = Field(ge=1, le=10, strict=True)
    retrieved_count: int = Field(ge=0, le=1000, strict=True)
    catalog_total: int = Field(ge=0, strict=True)
    complete_for_query: bool = Field(strict=True)
    stop_reason: Literal["exhausted", "page_limit"]
    ranking_scope: Literal["retrieved_candidates"] = "retrieved_candidates"
    full_dataset_ranking: Literal[False] = False

    @model_validator(mode="after")
    def consistent_counts(self) -> Self:
        if self.query.page != 1:
            raise ValueError("coverage query must describe retrieval starting at page 1")
        expected_count = min(self.catalog_total, self.query.page_size * self.pages_fetched)
        if self.retrieved_count != expected_count:
            raise ValueError("retrieved_count must match the reported contiguous pages")
        expected_pages = max(
            1, (self.retrieved_count + self.query.page_size - 1) // self.query.page_size
        )
        if self.pages_fetched != expected_pages:
            raise ValueError("pages_fetched must match retrieved_count and page_size")
        complete = self.retrieved_count == self.catalog_total
        if complete != self.complete_for_query:
            raise ValueError("complete_for_query must match coverage counts")
        if (self.stop_reason == "exhausted") != complete:
            raise ValueError("stop_reason must match completeness")
        return self


class CandidateBatch(RecommendationContract):
    candidates: list[OfferCandidate]
    context: CatalogContext
    coverage: CandidateCoverage

    @model_validator(mode="after")
    def real_unique_candidates(self) -> Self:
        ids = [item.offer_id for item in self.candidates]
        if len(set(ids)) != len(ids):
            raise ValueError("duplicate offer_id in candidate batch")
        if len(ids) != self.coverage.retrieved_count:
            raise ValueError("coverage count must match candidates")
        for item in self.candidates:
            for value in (item.offer_id, item.product.product_id, item.shop.shop_id):
                if not value.strip():
                    raise ValueError("candidate identifiers must not be blank")
        return self


class RankingStrategy(RecommendationContract):
    """Provisional strategy metadata only; this class computes no ranking."""

    version: Literal["lexical-v1"] = "lexical-v1"
    relevance_weight: Score = 0.60
    price_weight: Score = 0.20
    distance_weight: Score = 0.15
    opening_hours_weight: Score = 0.025
    purchase_conditions_weight: Score = 0.025
    distance_scale_km: Annotated[
        float, BeforeValidator(_number_input), Field(gt=0, allow_inf_nan=False)
    ] = 10.0
    max_results: int = Field(default=10, ge=1, le=100, strict=True)
    ordering: Literal["product_match_desc,overall_score_desc,offer_id_asc"] = (
        "product_match_desc,overall_score_desc,offer_id_asc"
    )

    @model_validator(mode="after")
    def normalized_weights(self) -> Self:
        weights = (
            self.relevance_weight,
            self.price_weight,
            self.distance_weight,
            self.opening_hours_weight,
            self.purchase_conditions_weight,
        )
        if not math.isclose(sum(weights), 1.0, rel_tol=0, abs_tol=1e-9):
            raise ValueError("ranking weights must sum to 1")
        return self


class ScoreBreakdown(RecommendationContract):
    product_match: Score
    budget_fit: Score
    distance_fit: Score | None = None
    opening_hours_fit: Score | None = None
    purchase_conditions_fit: Score | None = None
    # A last-change timestamp never establishes verification freshness.
    price_freshness: Literal[None] = None


class ExplanationReason(RecommendationContract):
    code: Literal[
        "product_match",
        "within_budget",
        "distance",
        "declared_opening_hours",
        "recorded_payment_option",
    ]
    message: Text


class DataLimitation(RecommendationContract):
    code: Literal[
        "inventory_not_verified",
        "recorded_price_not_live",
        "location_unknown",
        "user_location_unknown",
        "opening_hours_unknown",
        "opening_hours_unsupported",
        "shopping_time_unknown",
        "purchase_conditions_unknown",
        "price_freshness_unknown",
    ]
    message: Text


class BeforeVisitVerification(RecommendationContract):
    status: Literal["unverified"] = "unverified"
    availability: Literal["unconfirmed"] = "unconfirmed"
    requires_verification_before_visit: Literal[True] = True


class RecommendationResult(RecommendationContract):
    offer_id: Identifier
    product_id: Identifier
    shop_id: Identifier
    candidate: OfferCandidate
    overall_score: Score
    score_breakdown: ScoreBreakdown
    explanation_reasons: list[ExplanationReason] = Field(min_length=1)
    data_limitations: list[DataLimitation] = Field(min_length=1)
    before_visit_verification: BeforeVisitVerification = Field(
        default_factory=BeforeVisitVerification
    )

    @model_validator(mode="after")
    def consistent_evidence(self) -> Self:
        identity = (self.offer_id, self.product_id, self.shop_id)
        candidate = self.candidate
        if identity != (candidate.offer_id, candidate.product.product_id, candidate.shop.shop_id):
            raise ValueError("recommendation identifiers must match the catalog candidate")
        if not any(item.code == "inventory_not_verified" for item in self.data_limitations):
            raise ValueError("inventory uncertainty must be disclosed")
        return self


class RecommendationResponse(RecommendationContract):
    schema_version: Literal["2.0"] = "2.0"
    strategy: RankingStrategy
    context: CatalogContext
    coverage: CandidateCoverage
    considered_count: int = Field(ge=0, strict=True)
    eligible_count: int = Field(ge=0, strict=True)
    excluded_counts: dict[
        Literal["irrelevant", "unknown_price", "over_budget", "unknown_distance", "outside_radius"],
        Annotated[int, Field(ge=0, strict=True)],
    ]
    recommendations: list[RecommendationResult]
    notices: list[Text] = Field(
        default_factory=lambda: [
            "ranking_is_limited_to_retrieved_candidates",
            "catalog_query_is_lexical_AND_not_semantic_search",
            "catalog_dataset_coverage_is_incomplete",
        ]
    )

    @model_validator(mode="after")
    def consistent_response(self) -> Self:
        ids = [item.offer_id for item in self.recommendations]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate offer_id in response")
        if self.considered_count != self.coverage.retrieved_count:
            raise ValueError("considered_count must match retrieved coverage")
        if self.eligible_count + sum(self.excluded_counts.values()) != self.considered_count:
            raise ValueError("eligible and excluded counts must cover considered candidates")
        if len(ids) > min(self.eligible_count, self.strategy.max_results):
            raise ValueError("too many recommendations")
        return self
