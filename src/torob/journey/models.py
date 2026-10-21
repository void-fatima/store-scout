"""Module-local proposals; the catalog's published contract is still a draft."""

from typing import Literal

from pydantic import ConfigDict, Field, JsonValue, field_validator, model_validator

from torob.catalog.contracts import Contract, ErrorDetail, Identifier, Price


class JourneyModel(Contract):
    model_config = ConfigDict(strict=True, frozen=True)


class SearchCriteria(JourneyModel):
    q: str | None = Field(default=None, max_length=200)
    min_price_toman: Price | None = None
    max_price_toman: Price | None = None
    city: str | None = None
    area: str | None = None

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
        return self


class ShoppingRequest(JourneyModel):
    request_id: Identifier
    criteria: SearchCriteria = Field(default_factory=SearchCriteria)

    @field_validator("request_id")
    @classmethod
    def nonblank_identity(cls, value):
        if not value.strip():
            raise ValueError("request_id must be nonblank")
        return value


class ShoppingState(ShoppingRequest):
    status: Literal["needs_information", "criteria_ready", "catalog_request_prepared"]
    search_performed: Literal[False] = False


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
