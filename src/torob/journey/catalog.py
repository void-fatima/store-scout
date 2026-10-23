"""Prepare a catalog handoff without executing search or dropping location intent."""

from pydantic import ValidationError

from torob.catalog.contracts import CONTRACT_VERSION, CatalogQuery, ErrorDetail
from torob.journey.intake import _collect, _validation_failure
from torob.journey.models import CatalogRequest, JourneyOutcome, ShoppingRequest, ShoppingState


def prepare_catalog_request(state: ShoppingState) -> JourneyOutcome:
    """Produce a provisional, preparation-only wrapper around supported filters.

    City/area have no representation in the current draft catalog query. Preserve
    them alongside the supported parameter subset and explicitly block handoff.
    Never dispatch that subset alone or treat a prepared request as search results.
    """
    if not isinstance(state, ShoppingState):
        return JourneyOutcome(
            error=ErrorDetail(code="invalid_state", message="Expected a ShoppingState.")
        )
    collected = _collect(
        ShoppingRequest(
            request_id=state.request_id,
            revision=state.revision,
            criteria=state.criteria,
            comparison=state.comparison,
        )
    )
    if collected.missing_information:
        return collected

    parameters = {
        key: value
        for key in ("q", "min_price_toman", "max_price_toman")
        if (value := getattr(state.criteria, key)) is not None
    }
    try:
        query = CatalogQuery.model_validate(parameters, strict=True)
    except ValidationError as exc:
        return _validation_failure(
            exc, state=collected.state, prefix=("catalog_query",), code="invalid_query"
        )
    prepared = CatalogRequest(
        request_id=state.request_id,
        criteria=state.criteria,
        catalog_contract_version=CONTRACT_VERSION,
        parameters=query.model_dump(mode="json", exclude_unset=True),
        unresolved_filters=tuple(
            key
            for key in (
                "city",
                "area",
                "max_budget",
                "price_unit",
                "latitude",
                "longitude",
                "max_distance_km",
                "preferred_purchase_conditions",
                "shopping_time",
            )
            if getattr(state.criteria, key) is not None
        ),
        limitations=(
            "The current draft catalog query has no city/area filter; Roham's location "
            "interface or mapping is needed before dispatch.",
            "Catalog data readiness has not been checked; no search has run.",
        ),
    )
    return JourneyOutcome(
        state=collected.state.model_copy(update={"status": "catalog_request_prepared"}),
        catalog_request=prepared,
    )
