"""Actual pinned HTTP API + disposable Catalog, with fixture-only interpretation."""

import argparse
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from pinned_intent import REFERENCE, ROOT, FixtureInterpreter, pinned_source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8018)
    args = parser.parse_args()
    with (
        pinned_source(),
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
        print(
            f"Fixture interpretation only; pinned HTTP API {REFERENCE}; disposable sample Catalog."
        )
        uvicorn.run(app, host="127.0.0.1", port=args.port, access_log=False)


if __name__ == "__main__":
    main()
