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

From the repository root, after the existing `uv sync --locked` setup:

```powershell
uv run --no-sync pytest src/torob/journey/tests
```

Shared pytest discovery is configured for `tests/`; explicitly name this module's
tests without editing root configuration. Network access is unnecessary for tests.
