# StoreScout

Catalog search and shopping recommendations for the Torob dataset, built with Python, FastAPI and SQLite.

## Run

Requires Python 3.12+ and uv.

```sh
uv sync --locked
uv run store-scout import-data datasets/sample --source-kind sample --db var/sample.sqlite3
uv run store-scout serve --reload --db var/sample.sqlite3
```

API documentation: http://127.0.0.1:8000/docs

The application exposes Catalog GET routes and `POST /api/v1/journey/recommendations`.
See [API contracts](contracts/README.md) for requests, responses and errors.
Sample data is synthetic; product availability requires verification.

## Verify

```sh
uv run pytest tests src/torob/journey/tests
uv run ruff check .
uv run ruff format --check .
uv run python scripts/export_contracts.py --check
```

The test command includes Catalog, Recommendation, Journey and application integration tests.
Tests use temporary databases. To regenerate contracts after a reviewed API change, run
`uv run python scripts/export_contracts.py`.

With the sample API running, `uv run python scripts/smoke_journey.py` checks the live
HTTP flow, comparison, explicit sample alternative acceptance, validation and CORS.
The report is saved to `var/reports/latest-journey-smoke.json`.
