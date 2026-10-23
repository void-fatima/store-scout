"""Journey-owned composition. Recommendation owns retrieval, ranking and planning."""

from pydantic import Field, ValidationError, model_validator

from torob.catalog.contracts import Identifier
from torob.journey.adapter import JourneyRequestError, adapt_criteria
from torob.journey.models import (
    ComparisonKey,
    ComparisonState,
    JourneyModel,
    ShoppingRequest,
    ShoppingState,
)
from torob.journey.updates import update_criteria
from torob.recommend.alternative_models import (
    AlternativePolicy,
    AlternativesResponse,
    ConstraintChange,
)
from torob.recommend.alternatives import find_alternatives
from torob.recommend.catalog import CatalogSource


def comparison_keys(result: AlternativesResponse) -> tuple[ComparisonKey, ...]:
    """Keep upstream result order; same titles never collapse distinct products/offers."""
    dataset = result.original.context.dataset
    if dataset is None:
        return ()
    results = [*result.original.recommendations, *(s.result for s in result.suggestions)]
    return tuple(
        ComparisonKey(
            dataset_id=dataset.dataset_id, product_id=item.product_id, offer_id=item.offer_id
        )
        for item in results
    )


def _selection_matches(comparison: ComparisonState, result: AlternativesResponse) -> bool:
    available = set(comparison_keys(result))
    return all(key in available for key in comparison.keys)


class JourneyRecommendations(JourneyModel):
    """Proposed transport envelope; `result` is the complete owning service response."""

    state: ShoppingState
    result: AlternativesResponse

    @model_validator(mode="after")
    def consistent_request(self):
        if self.state.status != "recommendations_ready" or not self.state.search_performed:
            raise ValueError("recommendation state must identify a performed search")
        if adapt_criteria(self.state.criteria) != self.result.original_constraints:
            raise ValueError("results must describe the state's accepted criteria")
        if self.state.comparison is not None and not _selection_matches(
            self.state.comparison, self.result
        ):
            raise ValueError("comparison must reference results from the current dataset")
        return self


class AlternativeAcceptance(JourneyModel):
    request_id: Identifier
    expected_revision: int = Field(ge=0)
    dataset_id: Identifier
    offer_id: Identifier
    accepted_changes: tuple[ConstraintChange, ...] = Field(min_length=1, strict=False)


def run_recommendations(
    source: CatalogSource,
    request: ShoppingRequest,
    *,
    policy: AlternativePolicy | None = None,
) -> JourneyRecommendations:
    """Invoke Task 03 once; never pre-call recommend or automatically apply suggestions.

    Callers own the Catalog source lifecycle. No database is initialized or replaced.
    RecommendationServiceError retains its canonical ErrorResponse unchanged.
    """
    if not isinstance(request, ShoppingRequest):
        raise JourneyRequestError("invalid_request", "Expected an identified Journey request.")
    try:
        checked = ShoppingRequest.model_validate(
            request.model_dump(include=set(ShoppingRequest.model_fields))
        )
    except ValidationError as exc:
        raise JourneyRequestError("invalid_request", "Check Journey request fields.") from exc
    criteria = adapt_criteria(checked.criteria)
    result = find_alternatives(source, criteria, policy=policy)
    comparison = checked.comparison
    if comparison is not None and not _selection_matches(comparison, result):
        comparison = None
    state = ShoppingState.model_validate(
        checked.model_dump()
        | {"comparison": comparison, "status": "recommendations_ready", "search_performed": True}
    )
    return JourneyRecommendations(state=state, result=result)


def select_for_comparison(
    response: JourneyRecommendations, keys: tuple[ComparisonKey, ...]
) -> JourneyRecommendations:
    """Selection is local UI/session state, verified against actual result identities."""
    response = JourneyRecommendations.model_validate(response.model_dump())
    try:
        comparison = ComparisonState(
            request_id=response.state.request_id, revision=response.state.revision, keys=keys
        )
    except ValidationError as exc:
        raise JourneyRequestError("invalid_comparison", "Check comparison identities.") from exc
    if not _selection_matches(comparison, response.result):
        raise JourneyRequestError(
            "invalid_comparison", "Select dataset/product/offer keys from this response."
        )
    state = ShoppingState.model_validate(
        response.state.model_dump() | {"comparison": comparison if keys else None}
    )
    return JourneyRecommendations(state=state, result=response.result)


def accept_alternative(
    response: JourneyRecommendations,
    acceptance: AlternativeAcceptance,
    *,
    current_state: ShoppingState,
) -> ShoppingState:
    """Validate explicit disclosed acceptance and return a fresh, unsearched revision.

    This in-process helper consumes an actual service response, not a client-provided
    relaxed criteria object. It performs no retrieval and makes no seller contact.
    The caller must issue a fresh run_recommendations with the returned state.
    """
    response = JourneyRecommendations.model_validate(response.model_dump())
    acceptance = AlternativeAcceptance.model_validate(acceptance.model_dump())
    current_state = ShoppingState.model_validate(current_state.model_dump())
    dataset = response.result.original.context.dataset
    if (
        acceptance.request_id != response.state.request_id
        or acceptance.expected_revision != response.state.revision
        or current_state.request_id != response.state.request_id
        or current_state.revision != response.state.revision
        or current_state.criteria != response.state.criteria
        or dataset is None
        or acceptance.dataset_id != dataset.dataset_id
    ):
        raise JourneyRequestError(
            "stale_alternative", "Refresh the current request before accepting an alternative."
        )
    suggestion = next(
        (s for s in response.result.suggestions if s.result.offer_id == acceptance.offer_id), None
    )
    if suggestion is None or [c.model_dump() for c in acceptance.accepted_changes] != [
        c.model_dump() for c in suggestion.changes
    ]:
        raise JourneyRequestError(
            "alternative_acceptance_required", "Explicitly accept every disclosed change."
        )
    patch = {}
    for change in suggestion.changes:
        if change.field == "query":
            patch["q"] = suggestion.relaxed_constraints.query
        elif change.field == "max_distance_km":
            patch["max_distance_km"] = suggestion.relaxed_constraints.max_distance_km
        elif response.state.criteria.max_price_toman is not None:
            patch["max_price_toman"] = suggestion.relaxed_constraints.budget_toman
        else:
            patch["max_budget"] = suggestion.relaxed_constraints.max_budget
    updated = update_criteria(current_state, patch)
    if updated.error is not None or updated.state is None:
        raise JourneyRequestError("invalid_update", "Accepted criteria could not be validated.")
    adapt_criteria(updated.state.criteria)
    return updated.state
