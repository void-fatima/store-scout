"""Collect a local shopping brief without searching or interpreting product needs."""

from pydantic import ValidationError

from torob.catalog.contracts import ErrorDetail
from torob.journey.models import (
    JourneyOutcome,
    MissingInformation,
    ShoppingRequest,
    ShoppingState,
)


def _validation_failure(
    exc: ValidationError,
    *,
    state: ShoppingState | None = None,
    prefix: tuple[str, ...] = (),
    code: str = "invalid_request",
) -> JourneyOutcome:
    missing = []
    details = []
    for issue in exc.errors(include_input=False, include_context=False, include_url=False):
        location = (*prefix, *issue["loc"])
        if issue["type"] == "missing":
            missing.append(
                MissingInformation(
                    field=".".join(map(str, location)), message="Provide the required field."
                )
            )
        else:
            details.append({"loc": list(location), "message": issue["msg"], "type": issue["type"]})
    error = (
        ErrorDetail(code=code, message="Check shopping request fields.", details=details)
        if details
        else None
    )
    return JourneyOutcome(state=state, missing_information=tuple(missing), error=error)


def _collect(request: ShoppingRequest) -> JourneyOutcome:
    missing = tuple(
        MissingInformation(field=f"criteria.{field}", message=f"Provide {field}.")
        for field in ("q", "city")
        if (value := getattr(request.criteria, field)) is None or not value.strip()
    )
    state = ShoppingState(
        request_id=request.request_id,
        criteria=request.criteria,
        status="needs_information" if missing else "criteria_ready",
    )
    return JourneyOutcome(state=state, missing_information=missing)


def start_journey(payload: object) -> JourneyOutcome:
    """Validate request_id/criteria and create an identified shopping state.

    Query and city are locally required; budget and area are optional. Invalid
    shapes and values return structured errors. Missing identity creates no state.
    """
    try:
        request = ShoppingRequest.model_validate(payload)
    except ValidationError as exc:
        return _validation_failure(exc)
    return _collect(request)
