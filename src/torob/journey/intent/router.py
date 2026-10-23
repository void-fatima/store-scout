"""Small callable API with safe errors, body bounds, and per-draft capabilities."""

import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Security
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import ValidationError

from torob.catalog.contracts import ErrorDetail, ErrorResponse
from torob.journey.llm.errors import ErrorCode, LLMError
from torob.journey.recommendations import JourneyRecommendations
from torob.journey.router import catalog_source
from torob.recommend.catalog import CatalogSource
from torob.recommend.service import RecommendationServiceError

from .errors import IntentError
from .models import (
    ConfirmIntent,
    CreatedIntent,
    CreateIntent,
    Identifier,
    IntentView,
    ReviseIntent,
    VersionRequest,
)
from .service import IntentService


class IntentRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request: Request):
            try:
                body = bytearray()
                async for chunk in request.stream():
                    if len(body) + len(chunk) > 16_384:
                        raise IntentError("request_too_large")
                    body.extend(chunk)
                request._body = bytes(body)
                response = await original(request)
            except IntentError as exc:
                response = JSONResponse(status_code=exc.status, content=exc.response.model_dump())
            except (RequestValidationError, ValidationError):
                exc = IntentError("invalid_intent_request")
                response = JSONResponse(status_code=exc.status, content=exc.response.model_dump())
            except LLMError as exc:
                status = (
                    429
                    if exc.code == ErrorCode.RATE_LIMIT
                    else 504
                    if exc.code == ErrorCode.TIMEOUT
                    else 502
                    if exc.code
                    in {
                        ErrorCode.MALFORMED_RESPONSE,
                        ErrorCode.INCOMPLETE_RESPONSE,
                        ErrorCode.RESPONSE_TOO_LARGE,
                    }
                    else 503
                )
                response = JSONResponse(
                    status_code=status,
                    content=ErrorResponse(
                        error=ErrorDetail(
                            code=f"llm_{exc.code.value}",
                            message="تفسیر مدل انجام نشد؛ تنظیمات یا دسترسی سرویس را بررسی کنید.",
                        )
                    ).model_dump(),
                )
            except RecommendationServiceError as exc:
                status = {
                    "catalog_snapshot_changed": 409,
                    "catalog_time_limit": 504,
                    "catalog_unavailable": 503,
                }.get(exc.response.error.code, 502)
                response = JSONResponse(status_code=status, content=exc.response.model_dump())
            except sqlite3.Error:
                exc = IntentError("intent_unavailable")
                response = JSONResponse(status_code=exc.status, content=exc.response.model_dump())
            except Exception:
                # Never log traceback locals or exception data from this boundary.
                exc = IntentError("intent_unavailable")
                response = JSONResponse(status_code=exc.status, content=exc.response.model_dump())
            response.headers["Cache-Control"] = "no-store"
            return response

        return handler


def intent_service(request: Request) -> IntentService:
    service = getattr(request.app.state, "intent", None)
    if not isinstance(service, IntentService):
        raise IntentError("intent_unavailable")
    return service


_bearer = HTTPBearer(
    auto_error=False,
    scheme_name="IntentDraftCapability",
    description="Per-draft access token returned once on creation. Never use the BoxAPI key here.",
)


def capability(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(_bearer)],
) -> str:
    if credentials is None or len(credentials.credentials) > 200:
        raise IntentError("intent_not_found")
    return credentials.credentials


Service = Annotated[IntentService, Depends(intent_service)]
Token = Annotated[str, Depends(capability)]
Source = Annotated[CatalogSource, Depends(catalog_source)]

router = APIRouter(
    prefix="/api/v1/journey/intents",
    tags=["shopping-intent"],
    route_class=IntentRoute,
    responses={
        code: {
            "model": ErrorResponse,
            **({"description": "Content Too Large"} if code == 413 else {}),
            **({"description": "Unprocessable Content"} if code == 422 else {}),
        }
        for code in (404, 409, 413, 422, 429, 502, 503, 504)
    },
)


@router.post("", response_model=CreatedIntent, status_code=201)
def create(payload: CreateIntent, service: Service):
    return service.create(payload.message)


@router.get("/{draft_id}", response_model=IntentView)
def get(draft_id: Identifier, service: Service, token: Token):
    return service.get(draft_id, token)


@router.post("/{draft_id}/revise", response_model=IntentView)
def revise(draft_id: Identifier, payload: ReviseIntent, service: Service, token: Token):
    return service.revise(
        draft_id, token, payload.expected_revision, message=payload.message, changes=payload.changes
    )


@router.post("/{draft_id}/confirm", response_model=IntentView)
def confirm(draft_id: Identifier, payload: ConfirmIntent, service: Service, token: Token):
    return service.confirm(draft_id, token, payload.expected_revision)


@router.post("/{draft_id}/reject", response_model=IntentView)
def reject(draft_id: Identifier, payload: VersionRequest, service: Service, token: Token):
    return service.reject(draft_id, token, payload.expected_revision)


@router.post("/{draft_id}/recommendations", response_model=JourneyRecommendations)
def recommendations(
    draft_id: Identifier, payload: VersionRequest, service: Service, token: Token, source: Source
):
    return service.recommendations(draft_id, token, payload.expected_revision, source)
