"""Draft v1 public contracts. Exported JSON/OpenAPI live in /contracts."""

import math
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator

from torob.catalog.text import normalize_text

CONTRACT_VERSION = "1.0.0-draft.1"
Price = Annotated[int, Field(gt=0, le=9_000_000_000_000)]
Identifier = Annotated[str, Field(min_length=1, max_length=200)]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GeoQuery(Contract):
    lat: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    lon: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    radius_km: float | None = Field(default=None, gt=0, le=100, allow_inf_nan=False)
    page: int = Field(default=1, ge=1, le=10_000)
    page_size: int = Field(default=20, ge=1, le=100)

    @model_validator(mode="after")
    def valid_location(self):
        if (self.lat is None) != (self.lon is None):
            raise ValueError("lat and lon must be supplied together")
        if self.radius_km is not None and self.lat is None:
            raise ValueError("radius_km requires lat and lon")
        return self


class CatalogQuery(GeoQuery):
    q: str = Field(default="", max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=300)
    shop_id: Identifier | None = None
    product_id: Identifier | None = None
    min_price_toman: Price | None = None
    max_price_toman: Price | None = None
    sort: Literal["price_asc", "price_desc", "distance", "price_changed_desc"] = "price_asc"

    @model_validator(mode="after")
    def valid_filters(self):
        if self.q and not normalize_text(self.q):
            raise ValueError("q must contain letters or digits")
        if self.category is not None and not normalize_text(self.category):
            raise ValueError("category must contain letters or digits")
        if (
            self.min_price_toman is not None
            and self.max_price_toman is not None
            and self.min_price_toman > self.max_price_toman
        ):
            raise ValueError("min_price_toman must be <= max_price_toman")
        if self.sort == "distance" and self.lat is None:
            raise ValueError("distance sorting requires lat and lon")
        return self


class ShopQuery(GeoQuery):
    category: str | None = Field(default=None, min_length=1, max_length=300)

    @model_validator(mode="after")
    def valid_category(self):
        if self.category is not None and not normalize_text(self.category):
            raise ValueError("category must contain letters or digits")
        return self


class Shop(Contract):
    shop_id: Identifier
    name: str = Field(min_length=1)
    address: str | None = None
    location_label: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    lon: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    category_names: list[str] = Field(default_factory=list)
    contacts: list[dict[str, JsonValue]] = Field(default_factory=list)
    instagram: str | None = None
    website_url: str | None = None
    payment_options: list[JsonValue] = Field(default_factory=list)
    supports_fast_delivery: bool | None = None
    weekly_hours: dict[str, JsonValue] = Field(default_factory=dict)
    identity_status: Literal["synthetic_or_unverified"] = "synthetic_or_unverified"
    contacts_status: Literal["synthetic"] = "synthetic"

    @model_validator(mode="after")
    def coordinate_pair(self):
        if (self.lat is None) != (self.lon is None):
            raise ValueError("shop coordinates must be both present or both missing")
        return self


class ProductSummary(Contract):
    product_id: Identifier
    persian_title: str = Field(min_length=1)
    category_name: str | None = None
    brand_name: str | None = None
    model: str | None = None
    image_urls: list[str] = Field(default_factory=list)


class Product(ProductSummary):
    specs: list[dict[str, JsonValue]] = Field(default_factory=list)


class Offer(Contract):
    offer_id: Identifier
    product_id: Identifier
    shop_id: Identifier
    price_toman: Price | None
    last_price_changed_at: datetime | None = None
    seller_title: str | None = None
    description: str | None = None
    warranty: str | None = None


class DatasetInfo(Contract):
    dataset_id: str
    source_kind: Literal["sample", "provided"]
    imported_at: datetime
    source_sha256: str
    counts: dict[str, int]
    coverage: Literal["Tehran dataset; coverage is incomplete"] = (
        "Tehran dataset; coverage is incomplete"
    )


class CatalogContext(Contract):
    contract_version: str = CONTRACT_VERSION
    dataset: DatasetInfo | None = None
    currency: Literal["toman"] = "toman"
    notices: list[str] = Field(
        default_factory=lambda: [
            "offer_does_not_confirm_stock",
            "price_timestamp_is_last_change_not_last_verification",
            "shop_names_synthetic_or_unverified",
            "contact_numbers_synthetic",
            "tehran_coverage_incomplete",
        ]
    )


class OfferCandidate(Contract):
    offer_id: Identifier
    evidence: Literal["offer_record"] = "offer_record"
    product: ProductSummary
    shop: Shop
    price_toman: Price | None
    last_price_changed_at: datetime | None
    seller_title: str | None
    description: str | None
    warranty: str | None
    distance_km: float | None
    availability: Literal["unconfirmed"] = "unconfirmed"
    requires_verification_before_visit: Literal[True] = True


class CatalogPage(Contract):
    items: list[OfferCandidate]
    total: int
    page: int
    page_size: int
    has_next: bool
    context: CatalogContext


class ShopMatch(Contract):
    shop: Shop
    evidence: Literal["shop_record_only"] = "shop_record_only"
    distance_km: float | None
    product_availability: Literal["not_established"] = "not_established"


class OfferDetail(Contract):
    item: OfferCandidate
    context: CatalogContext


class ProductDetail(Contract):
    item: Product
    context: CatalogContext


class ShopPage(Contract):
    items: list[ShopMatch]
    total: int
    page: int
    page_size: int
    has_next: bool
    context: CatalogContext


class ErrorDetail(Contract):
    code: str
    message: str
    details: list[dict[str, JsonValue]] = Field(default_factory=list)


class ErrorResponse(Contract):
    error: ErrorDetail


def distance_km(lat1, lon1, lat2, lon2) -> float | None:
    if None in (lat1, lon1, lat2, lon2):
        return None
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(max(0.0, min(1.0, a))))
