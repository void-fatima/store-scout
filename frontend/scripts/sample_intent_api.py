"""Actual pinned HTTP API + disposable Catalog, with fixture-only interpretation."""

import argparse
import sys
import tempfile
from contextlib import asynccontextmanager, nullcontext
from pathlib import Path

from pinned_intent import REFERENCE, ROOT, FixtureInterpreter, pinned_source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8018)
    parser.add_argument(
        "--current-source", action="store_true", help="Exercise this checkout's API"
    )
    args = parser.parse_args()
    if args.current_source:
        sys.path.insert(0, str(ROOT / "src"))
    with (
        nullcontext() if args.current_source else pinned_source(),
        tempfile.TemporaryDirectory(prefix="store-scout-intent-http-") as directory,
    ):
        import uvicorn

        from torob.api import create_app
        from torob.config import Settings
        from torob.data.importer import import_dataset

        db = Path(directory) / "sample.sqlite3"
        import_dataset(ROOT / "datasets/sample", db, source_kind="sample")
        app = create_app(
            Settings(db_path=db, cors_origins=("http://localhost:5173", "http://localhost:5189"))
        )
        original_lifespan = app.router.lifespan_context

        @asynccontextmanager
        async def fixture_lifespan(application):
            async with original_lifespan(application):
                application.state.intent._interpreter_factory = FixtureInterpreter
                yield

        app.router.lifespan_context = fixture_lifespan

        @app.middleware("http")
        async def fixture_marker(request, call_next):
            response = await call_next(request)
            response.headers["X-StoreScout-Interpretation"] = "fixture-only-18756bf"
            return response

        source = "current checkout" if args.current_source else f"pinned {REFERENCE}"
        print(f"Fixture interpretation only; {source} HTTP API; disposable sample Catalog.")
        uvicorn.run(app, host="127.0.0.1", port=args.port, access_log=False)


if __name__ == "__main__":
    main()
