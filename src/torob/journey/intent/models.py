"""Strict local contracts; model evidence is separate from user-supplied coordinates."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from torob.journey.models import SearchCriteria

Span = Annotated[str, StringConstraints(min_length=1, max_length=200)]
Message = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
Identifier = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{32}$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True, hide_input_in_errors=True)


class ExtractedFields(StrictModel):
    """Every non-null string must be a verbatim span from the current user message."""

    shopping_related: bool
    product_query: Span | None
    brand: Span | None
    category: Span | None
    max_budget: Span | None
    min_budget: Span | None
    location: Span | None
    radius: Span | None
    warranty: Span | None
    installments: Span | None
    return_window: Span | None
    other_preferences: list[Span] = Field(max_length=5)


class Coordinates(StrictModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    for_location: Span | None = None


class IntentFields(StrictModel):
    product_query: Span | None = None
    brand: Span | None = None
    category: Span | None = None
    max_budget: Span | None = None
    min_budget: Span | None = None
    location: Span | None = None
    radius: Span | None = None
    warranty: Span | None = None
    installments: Span | None = None
    return_window: Span | None = None
    other_preferences: list[Span] = Field(default_factory=list, max_length=5)
    coordinates: Coordinates | None = None


class IntentPatch(IntentFields):
    """Only model_fields_set entries change; explicit null clears a value."""


class Provenance(StrictModel):
    source: Literal["model_interpretation", "user_supplied"]
    evidence: str = Field(max_length=200)


class CreateIntent(StrictModel):
    message: Message = Field(repr=False)


class VersionRequest(StrictModel):
    expected_revision: int = Field(ge=0)


class ReviseIntent(VersionRequest):
    message: Message | None = Field(default=None, repr=False)
    changes: IntentPatch | None = None

    @model_validator(mode="after")
    def one_change_source(self):
        if (self.message is None) == (self.changes is None):
            raise ValueError("Provide a message or explicit changes")
        if self.changes is not None and not self.changes.model_fields_set:
            raise ValueError("Provide at least one change")
        return self


class ConfirmIntent(VersionRequest):
    confirm: Literal[True]

    @model_validator(mode="before")
    @classmethod
    def explicit_boolean(cls, value):
        if isinstance(value, dict) and value.get("confirm") is not True:
            raise ValueError("An explicit boolean confirmation is required")
        return value


class Issue(StrictModel):
    field: str
    code: Literal["missing", "ambiguous", "unsupported", "resolution_required", "irrelevant"]
    question: str


class Money(StrictModel):
    raw_text: str
    value: str | None
    currency: Literal["TOMAN", "IRR"] | None
    toman: int | None
    requires_clarification: bool


class SummaryLine(StrictModel):
    label: str
    value: str


class IntentRecord(StrictModel):
    draft_id: Identifier
    revision: int = Field(ge=0)
    expires_at: int
    fields: IntentFields
    provenance: dict[str, Provenance]
    shopping_related: bool = True
    decision: Literal["pending", "confirmed", "rejected"] = "pending"


class IntentView(StrictModel):
    draft_id: Identifier
    revision: int
    expires_at: int
    status: Literal[
        "needs_clarification", "awaiting_confirmation", "confirmed", "rejected", "invalid"
    ]
    fields: IntentFields
    provenance: dict[str, Provenance]
    max_budget: Money | None
    min_budget: Money | None
    criteria: SearchCriteria
    issues: list[Issue]
    next_question: str | None
    summary: list[SummaryLine]
    notices: list[str]
    search_performed: Literal[False] = False


class CreatedIntent(StrictModel):
    draft: IntentView
    access_token: str = Field(repr=False)
