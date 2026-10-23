# Shopping Journey

The application also registers the [Persian shopping intent API](intent/README.md):
model interpretation, validated drafts, clarification and explicit version-bound
confirmation before the existing recommendation flow. Frontend chat is not added.

Journey now maps validated requests to the actual Recommendation Task 03 service.
Read [INTEGRATION.md](INTEGRATION.md) for current interfaces, revision/comparison
rules, source ancestry and coordination requirements. The original offline
preparation functions remain available; `prepare_catalog_request` is still a
blocked legacy preparation envelope, never the dispatcher for recommendations.
The application integration registers `POST /api/v1/journey/recommendations`.
See the [public contract](../../../contracts/README.md) and the current status in
[API_HANDOFF.md](API_HANDOFF.md). The original wiring patch is a historical reference.

## Verification

```sh
uv run pytest tests src/torob/journey/tests
uv run ruff check .
uv run ruff format --check .
uv run python scripts/export_contracts.py --check
```

The main application tests use synthetic sample data and temporary databases.
The caller owns request revisions and comparison state. Alternative changes require
explicit acceptance and a fresh request; the HTTP API stores no consent or session state.
