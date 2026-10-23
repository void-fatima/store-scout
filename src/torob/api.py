"""Application composition for Catalog and Journey recommendation routes."""

import logging
import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from torob.catalog.contracts import CONTRACT_VERSION
from torob.catalog.repository import CatalogRepository
from torob.catalog.router import router as catalog_router
from torob.config import Settings
from torob.data.database import initialize
from torob.journey.intent.router import router as intent_router
from torob.journey.intent.service import IntentService
from torob.journey.intent.store import IntentStore
from torob.journey.router import router as journey_router

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        initialize(settings.db_path)
        app.state.catalog = CatalogRepository(settings.db_path)
        intent_store = IntentStore(
            settings.db_path.with_name(settings.db_path.stem + ".intent.sqlite3")
        )
        intent_store.initialize()
        app.state.intent = IntentService(intent_store)
        yield

    app = FastAPI(
        title="StoreScout Catalog API",
        version=CONTRACT_VERSION,
        lifespan=lifespan,
        description="Draft team contract. All prices are toman; stock is unconfirmed.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "invalid_query",
                    "message": "Check query parameters",
                    "details": [
                        {"location": list(e["loc"]), "message": e["msg"], "type": e["type"]}
                        for e in exc.errors()
                    ],
                }
            },
        )

    @app.exception_handler(HTTPException)
    async def http_error(_request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            headers=exc.headers,
            content={
                "error": {
                    "code": "not_found" if exc.status_code == 404 else "http_error",
                    "message": str(exc.detail),
                    "details": [],
                }
            },
        )

    @app.exception_handler(sqlite3.Error)
    async def database_error(_request: Request, exc: sqlite3.Error):
        logger.error("Catalog database error", exc_info=exc)
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "catalog_unavailable",
                    "message": "Catalog is temporarily unavailable",
                    "details": [],
                }
            },
        )

    @app.get("/health", tags=["operations"])
    def health(request: Request):
        context = request.app.state.catalog.context()
        return {
            "status": "ok",
            "data_ready": context.dataset is not None,
            "contract_version": CONTRACT_VERSION,
        }

    app.include_router(catalog_router)
    app.include_router(journey_router)
    app.include_router(intent_router)
    return app
