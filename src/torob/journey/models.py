"""Module-local proposals; the catalog's published contract is still a draft."""

from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, ConfigDict, Field, JsonValue, field_validator, model_validator

from torob.catalog.contracts import Contract, ErrorDetail, Identifier, Price
from torob.recommend.models import Budget, PriceUnit, PurchaseConditions, ShoppingCriteria


class JourneyModel(Contract):
    model_config = ConfigDict(strict=True, frozen=True)


class SearchCriteria(JourneyModel):
    q: str | None = Field(default=None, max_length=200)
    min_price_toman: Price | None = None
    max_price_toman: Price | None = None
    city: str | None = None
    area: str | None = None
    max_budget: Budget | None = Field(default=None, strict=False)
    price_unit: PriceUnit | None = Field(default=None, strict=False)
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    max_distance_km: float | None = Field(default=None, gt=0, le=100, allow_inf_nan=False)
    preferred_purchase_conditions: PurchaseConditions | None = None
    shopping_time: AwareDatetime | None = Field(default=None, strict=False)

    @field_validator("max_budget", mode="before")
    @classmethod
    def exact_money(cls, value):
        if isinstance(value, float):
            raise ValueError("send exact money as a decimal string or integer, not a float")
        return value

    @field_validator("shopping_time", mode="before")
    @classmethod
    def explicit_timestamp(cls, value):
        if value is not None and not isinstance(value, (str, datetime)):
            raise ValueError("send an ISO timestamp with offset or an aware datetime")
        return value

    @field_validator("area")
    @classmethod
    def nonblank_area(cls, value):
        if value is not None and not value.strip():
            raise ValueError("area must be nonblank or null")
        return value

    @model_validator(mode="after")
    def valid_budget(self):
        if (
            self.min_price_toman is not None
            and self.max_price_toman is not None
            and self.min_price_toman > self.max_price_toman
        ):
            raise ValueError("min_price_toman must be <= max_price_toman")
        if self.max_price_toman is not None and (
            self.max_budget is not None or self.price_unit is not None
        ):
            raise ValueError("use max_price_toman OR max_budget with price_unit")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be supplied together")
        if self.max_distance_km is not None and self.latitude is None:
            raise ValueError("max_distance_km requires coordinates")
        if (
            self.max_budget is not None
            and self.price_unit is not None
            and self.q
            and self.q.strip()
        ):
            # The owning model checks exact conversion/limits, preferences and time.
            ShoppingCriteria.model_validate(self.recommendation_fields())
        return self

    def recommendation_fields(self) -> dict:
        fields = self.model_dump(
            include={
                "max_budget",
                "price_unit",
                "latitude",
                "longitude",
                "max_distance_km",
                "preferred_purchase_conditions",
                "shopping_time",
            }
        )
        if self.max_price_toman is not None:
            fields.update(max_budget=self.max_price_toman, price_unit=PriceUnit.TOMAN)
        return {"query": self.q, **fields}


class ComparisonKey(JourneyModel):
    dataset_id: Identifier
    product_id: Identifier
    offer_id: Identifier


class ComparisonState(JourneyModel):
    request_id: Identifier
    revision: int = Field(ge=0)
    keys: tuple[ComparisonKey, ...] = Field(max_length=10, strict=False)

    @model_validator(mode="after")
    def unique_keys(self):
        identities = [(key.dataset_id, key.product_id, key.offer_id) for key in self.keys]
        if len(set(identities)) != len(identities):
            raise ValueError("comparison keys must be unique")
        return self


class ShoppingRequest(JourneyModel):
    request_id: Identifier
    revision: int = Field(default=0, ge=0)
    criteria: SearchCriteria = Field(default_factory=SearchCriteria)
    comparison: ComparisonState | None = None

    @field_validator("request_id")
    @classmethod
    def nonblank_identity(cls, value):
        if not value.strip():
            raise ValueError("request_id must be nonblank")
        return value

    @model_validator(mode="after")
    def comparison_matches_request(self):
        if self.comparison is not None and (
            self.comparison.request_id != self.request_id
            or self.comparison.revision != self.revision
        ):
            raise ValueError("comparison must belong to this request and revision")
        return self


class ShoppingState(ShoppingRequest):
    status: Literal[
        "needs_information", "criteria_ready", "catalog_request_prepared", "recommendations_ready"
    ]
    search_performed: bool = False


class MissingInformation(JourneyModel):
    field: str
    message: str


class CatalogRequest(JourneyModel):
    request_id: Identifier
    criteria: SearchCriteria
    catalog_contract_version: str
    parameters: dict[str, JsonValue]
    unresolved_filters: tuple[str, ...]
    limitations: tuple[str, ...]
    handoff_ready: Literal[False] = False
    search_performed: Literal[False] = False


class JourneyOutcome(JourneyModel):
    state: ShoppingState | None = None
    missing_information: tuple[MissingInformation, ...] = ()
    error: ErrorDetail | None = None
    catalog_request: CatalogRequest | None = None
    search_performed: Literal[False] = False
