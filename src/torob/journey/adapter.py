"""Map retained Journey intent into Recommendation's owning criteria model."""

from pydantic import ValidationError

from torob.catalog.contracts import ErrorDetail, ErrorResponse
from torob.journey.models import SearchCriteria
from torob.recommend.models import ShoppingCriteria


class JourneyRequestError(ValueError):
    """Safe public error; no raw input or upstream exceptions in its response."""

    def __init__(self, code: str, message: str, *, details: list[dict] | None = None):
        super().__init__(message)
        self.response = ErrorResponse(
            error=ErrorDetail(code=code, message=message, details=details or [])
        )


def adapt_criteria(criteria: SearchCriteria) -> ShoppingCriteria:
    """No geocoding, parsing, defaults for money, or silently ignored constraints."""
    try:
        criteria = SearchCriteria.model_validate(criteria.model_dump())
    except ValidationError as exc:
        raise JourneyRequestError("invalid_request", "Check Journey criteria.") from exc
    missing = []
    if criteria.q is None or not criteria.q.strip():
        missing.append({"field": "criteria.q", "message": "Provide an explicit product query."})
    if criteria.max_price_toman is None:
        if criteria.max_budget is None:
            missing.append({"field": "criteria.max_budget", "message": "Provide a maximum budget."})
        if criteria.price_unit is None:
            missing.append({"field": "criteria.price_unit", "message": "Choose TOMAN or IRR."})
    if criteria.latitude is None:
        missing.append(
            {
                "field": "criteria.latitude/longitude",
                "message": "Provide coordinates; this service cannot geocode city/area text.",
            }
        )
    if missing:
        raise JourneyRequestError(
            "missing_information", "Complete the recommendation request.", details=missing
        )
    unsupported = [
        {"field": f"criteria.{field}", "message": message}
        for field, message in (
            (
                "city",
                "City text cannot be enforced; agree on a coordinate/radius replacement.",
            ),
            (
                "area",
                "Area text cannot be enforced; agree on a coordinate/radius replacement.",
            ),
            (
                "min_price_toman",
                "Recommendation has no minimum-budget constraint; agree on support before search.",
            ),
        )
        if getattr(criteria, field) is not None
    ]
    if unsupported:
        raise JourneyRequestError(
            "unsupported_constraint",
            "Retained constraints cannot be enforced.",
            details=unsupported,
        )
    try:
        return ShoppingCriteria.model_validate(criteria.recommendation_fields())
    except ValidationError as exc:
        raise JourneyRequestError(
            "invalid_request",
            "Check the canonical shopping criteria.",
            details=[
                {"location": list(issue["loc"]), "message": issue["msg"], "type": issue["type"]}
                for issue in exc.errors(
                    include_input=False, include_context=False, include_url=False
                )
            ],
        ) from exc
