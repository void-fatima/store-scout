# Shopping Journey — Stage 1 (Fatima)

This is a module-local proposal inside the existing StoreScout Python package.
It reuses Pydantic and pytest from the repository; it introduces no dependencies,
HTTP endpoints, storage, search, geographic calculation, ranking, or recommendations.
All implementation, tests, examples, and documentation belong in this directory.

The existing catalog contracts explicitly identify themselves as draft
`1.0.0-draft.1`, not approved team agreements. Journey models reuse their strict
extra-field convention, `Identifier`, `Price` (positive integer toman, capped at
9,000,000,000,000), and structured `ErrorDetail`. Local criteria are strict and
immutable: strings/floats/booleans are not coerced into monetary amounts.

Provisional fields: `request_id`; `criteria.q`, `min_price_toman`,
`max_price_toman`, `city`, and optional `area`. Budget units are explicit in the
field names; no currency inference or conversion occurs. Absent optional values
are `None`. Nonblank text is preserved verbatim. Query length follows the
current catalog limit of 200 characters. Journey requires a query and city for
preparation; this local collection rule does not imply catalog city-filter support.

The current catalog query cannot represent city/area constraints. A future
prepared request must retain these constraints and identify that gap rather than
silently dispatching a broader query or inventing coordinates.

`intake.start_journey({"request_id": "sample-1", "criteria": {...}})` returns a
`JourneyOutcome`. Absent/blank `q` or `city` creates `needs_information` with an
identified state; a complete brief creates `criteria_ready`. Missing identity is
reported without generating one or creating a state. Malformed input returns an
existing-format `error` (`code`, `message`, `details`) instead of an exception.
Pydantic input/context objects are excluded from errors to keep output JSON-safe.
Use `.model_dump(mode="json")` or `.model_dump_json()` for application output.

`updates.update_criteria(state, {"max_price_toman": 25000000})` merges a flat
criteria patch into a new immutable state. It preserves identity and all omitted
criteria, including query and selected area. The whole merged budget is checked;
invalid patches return `invalid_update` and the unchanged accepted state. Check
`error` before using an update. Explicit `None` clears an optional value; clearing
query/city returns to `needs_information`. Identity and workflow flags are not
criteria and cannot be patched. No state or query is cached. A changed city does
not silently reset the selected area; geographic consistency is not asserted.

From the repository root, after the existing `uv sync --locked` setup:

```powershell
uv run --no-sync pytest src/torob/journey/tests
```

Shared pytest discovery is configured for `tests/`; explicitly name this module's
tests without editing root configuration. Network access is unnecessary for tests.
