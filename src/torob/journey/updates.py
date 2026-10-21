"""Atomic, stateless criterion patches that preserve established request identity."""

from pydantic import ValidationError

from torob.catalog.contracts import ErrorDetail
from torob.journey.intake import _collect, _validation_failure
from torob.journey.models import JourneyOutcome, SearchCriteria, ShoppingRequest, ShoppingState


def update_criteria(state: ShoppingState, changes: object) -> JourneyOutcome:
    """Patch only selected criteria, revalidate, and return a new preparation state.

    Omitted values are retained; explicit null clears an optional bound/area or
    makes a required query/city missing again. Invalid patches retain old state.
    Every accepted patch discards any previous catalog preparation status.
    """
    if not isinstance(state, ShoppingState):
        return JourneyOutcome(
            error=ErrorDetail(code="invalid_state", message="Expected a ShoppingState.")
        )
    if not isinstance(changes, dict):
        return JourneyOutcome(
            state=state,
            error=ErrorDetail(code="invalid_update", message="Expected a criteria patch object."),
        )
    try:
        criteria = SearchCriteria.model_validate({**state.criteria.model_dump(), **changes})
    except ValidationError as exc:
        return _validation_failure(exc, state=state, prefix=("criteria",), code="invalid_update")
    return _collect(ShoppingRequest(request_id=state.request_id, criteria=criteria))
