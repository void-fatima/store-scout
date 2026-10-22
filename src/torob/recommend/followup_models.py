"""Recommendation-local verification plans. No seller contact is represented as completed."""

from datetime import datetime
from typing import Literal, Self

from pydantic import AwareDatetime, Field, JsonValue, model_validator

from .models import Identifier, PurchaseConditions, RecommendationContract, Text

VerificationTopic = Literal["inventory", "price", "opening_hours", "payment", "warranty", "returns"]


class VerificationQuestion(RecommendationContract):
    topic: VerificationTopic
    question: Text
    evidence_paths: list[Text] = Field(min_length=1)
    state: Literal["pending"] = "pending"


class FollowupPlan(RecommendationContract):
    offer_id: Identifier
    product_id: Identifier
    shop_id: Identifier
    state: Literal["awaiting_user_verification"] = "awaiting_user_verification"
    availability: Literal["unconfirmed"] = "unconfirmed"
    requires_verification_before_visit: Literal[True] = True
    contact_attempted: Literal[False] = False
    contact_policy: Literal["synthetic_contacts_not_for_contact"] = (
        "synthetic_contacts_not_for_contact"
    )
    recorded_price_toman: int | None = Field(ge=1, le=9_000_000_000_000, strict=True)
    last_price_changed_at: datetime | None
    price_verification_status: Literal["unknown"] = "unknown"
    shopping_time: AwareDatetime | None = None
    requested_purchase_conditions: PurchaseConditions | None = None
    opening_hours_status: Literal["unknown", "recorded_unverified", "unsupported"]
    recorded_weekly_hours: dict[str, JsonValue] | None
    payment_status: Literal["unknown", "recorded_unverified"]
    recorded_payment_options: list[JsonValue] | None
    warranty_status: Literal["unknown"] = "unknown"
    recorded_warranty: str | None
    checklist: list[VerificationQuestion] = Field(min_length=5)
    warnings: list[Text] = Field(min_length=1)

    @model_validator(mode="after")
    def complete_checklist(self) -> Self:
        topics = [item.topic for item in self.checklist]
        required = {"inventory", "price", "opening_hours", "payment", "warranty"}
        if not required.issubset(topics) or len(topics) != len(set(topics)):
            raise ValueError("checklist must contain unique required verification topics")
        if (self.recorded_weekly_hours is None) != (self.opening_hours_status == "unknown"):
            raise ValueError("opening-hours status must agree with recorded evidence")
        if (self.recorded_payment_options is None) != (self.payment_status == "unknown"):
            raise ValueError("payment status must agree with recorded evidence")
        return self
