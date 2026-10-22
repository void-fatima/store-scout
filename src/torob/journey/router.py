"""Proposed Journey POST boundary; deliberately unregistered in torob.api."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from torob.catalog.contracts import ErrorDetail, ErrorResponse
from torob.journey.adapter import JourneyRequestError
from torob.journey.models import ShoppingRequest
from torob.journey.recommendations import JourneyRecommendations, run_recommendations
from torob.recommend.catalog import CatalogSource
from torob.recommend.service import RecommendationServiceError

logger = logging.getLogger(__name__)


def _error(status: int, payload: ErrorResponse) -> JSONResponse:
    return JSONResponse(status_code=status, content=payload.model_dump(mode="json"))


class JourneyRoute(APIRoute):
    """Keep validation/dependency/service errors canonical without global app edits."""

    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request: Request):
            try:
                return await original(request)
            except RequestValidationError as exc:
                return _error(
                    422,
                    ErrorResponse(
                        error=ErrorDetail(
                            code="invalid_request",
                            message="Check Journey request fields.",
                            details=[
                                {
                                    "location": list(issue["loc"]),
                                    "message": issue["msg"],
                                    "type": issue["type"],
                                }
                                for issue in exc.errors()
                            ],
                        )
                    ),
                )
            except JourneyRequestError as exc:
                return _error(422, exc.response)
            except RecommendationServiceError as exc:
                status = {
                    "invalid_recommendation_input": 422,
                    "catalog_snapshot_changed": 409,
                    "catalog_unavailable": 503,
                    "catalog_time_limit": 504,
                    "catalog_invalid_response": 502,
                    "invalid_recommendation_data": 502,
                }.get(exc.response.error.code, 502)
                return _error(status, exc.response)
            except Exception:
                logger.exception("Unexpected Journey boundary failure")
                return _error(
                    500,
                    ErrorResponse(
                        error=ErrorDetail(
                            code="internal_error",
                            message="The Journey request could not be completed.",
                        )
                    ),
                )

        return handler


def catalog_source(request: Request) -> CatalogSource:
    """Reuse the application-owned Catalog source; never initialize storage here."""
    source = getattr(request.app.state, "catalog", None)
    if source is None or not callable(getattr(source, "search", None)):
        raise RecommendationServiceError(
            "catalog_unavailable", "Catalog is temporarily unavailable.", retryable=True
        )
    return source


router = APIRouter(
    prefix="/api/v1/journey",
    tags=["journey"],
    route_class=JourneyRoute,
    responses={
        422: {"model": ErrorResponse, "description": "Unprocessable Content"},
        409: {"model": ErrorResponse, "description": "Catalog snapshot changed; retry fresh"},
        502: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
        504: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)


@router.post("/recommendations", response_model=JourneyRecommendations)
def post_recommendations(
    payload: ShoppingRequest, source: Annotated[CatalogSource, Depends(catalog_source)]
) -> JourneyRecommendations:
    """Proposed stateless request; budget/radius changes must be explicitly supplied."""
    return run_recommendations(source, payload)
