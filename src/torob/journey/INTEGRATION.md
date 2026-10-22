# Journey / Recommendation integration proposal

Application integration now registers the Journey POST router. The current
[public contract](../../../contracts/README.md) and
[API handoff status](API_HANDOFF.md) supersede the pre-registration statements below.

This branch reuses Catalog and Recommendation implementations in `src/torob/`.
There is no dependency on the historical `apps/torob/recommend` snapshot.
All new implementation, tests and documentation are Journey-owned. No shared
configuration, dependency, dataset, contract, Catalog or Recommendation source
was edited. Their required existing histories were merged without conflicts.

## Confirmed backend and proposed boundary

The existing backend is Python 3.12+, FastAPI, Pydantic v2, SQLite, pytest and Ruff
with uv-locked dependencies. Local checks use the available Python 3.13 interpreter.
The exact Journey envelope and route remain coordination proposals. React and
TypeScript are frontend proposals, not an established team-wide stack decision.
No UI is implemented here.

`SearchCriteria` remains Journey's partial collection model. `adapt_criteria`
maps it into Recommendation's owning `ShoppingCriteria`; canonical offer,
ranking, alternative and follow-up models are imported, never redefined.

| Journey input | Mapping / behavior |
| --- | --- |
| `q` | Explicit product query; no second free-text parser or semantic/geographic inference |
| `max_price_toman` | Existing strict positive integer maximum; mapped to `TOMAN` |
| `max_budget` + `price_unit` | Canonical exact Decimal amount plus explicit `TOMAN` / `IRR`; send money as a string or integer, never a float |
| Both maximum formats | Rejected as ambiguous; clear the old maximum when switching formats |
| `latitude`, `longitude`, `max_distance_km` | User-supplied coordinates, optional radius; valid coordinates need no textual city |
| `preferred_purchase_conditions`, `shopping_time` | Owning typed preferences and timezone-aware timestamp preserved |
| Missing query, budget/unit or coordinates | Canonical `ErrorResponse`, `missing_information`, actionable field details; no search |
| Any retained `city`, `area` or `min_price_toman` | `unsupported_constraint`; no search, even alongside coordinates |

Textual geography is retained as a constraint, not silently recast as a label.
Catalog supports coordinate/radius filtering; it cannot enforce arbitrary city
or neighborhood text. A user must agree to a coordinate/radius replacement
before explicitly clearing that textual requirement. Recommendation currently
has no minimum-price field even though Catalog does. Coordinating that support
is preferable to silently dropping the existing Journey lower bound.

Incomplete criteria can still be collected with `start_journey`. Legacy intake
accepts city or coordinates for its local preparation status; only the adapter
establishes recommendation readiness. `prepare_catalog_request` stays blocked,
retains its unsupported fields and never executes a partial query.

## Composition and state

```python
from torob.journey import start_journey
from torob.journey.recommendations import run_recommendations

state = start_journey(
    {
        "request_id": "user-supplied-id",
        "revision": 0,
        "criteria": {
            "q": "گوشی سامسونگ",
            "max_budget": "200000009.123456789",
            "price_unit": "IRR",
            "latitude": 35.7,
            "longitude": 51.4,
            "max_distance_km": 5.0,
        },
    }
).state
response = run_recommendations(existing_catalog_repository, state)
payload = response.model_dump(mode="json")
```

`source` implements the documented `CatalogSource.search(CatalogQuery)` protocol;
the existing `CatalogRepository` already qualifies. The caller owns its lifecycle.
The adapter does not initialize/import/replace a database or retrieve a full dataset.

`run_recommendations` invokes `find_alternatives` exactly once per request. It
does not pre-call `recommend` and retrieve the originals twice. Task 03 controls
bounded pagination, diagnostics, snapshot consistency and verification plans.
The optional in-process `AlternativePolicy` is Recommendation's actual model;
product alternatives come only from explicit caller-curated queries. The public
boundary will use the default policy rather than accept arbitrary retrieval controls.

The proposed success shape is `{state: ShoppingState, result: AlternativesResponse}`.
`result` is serialized intact: original dataset/context and notices, original vs
relaxed criteria, rank order, per-query coverage and limits, pending verification,
synthetic contacts, and unconfirmed inventory all remain available. A valid empty
result is successful; a source failure or mixed snapshot is an error, never a
partial success. `RecommendationServiceError.response` is the canonical error.

Every accepted `update_criteria` patch advances `revision` by one, preserves
identity and omitted preferences, clears comparison and resets search/preparation
state. This includes accepted no-op patches; rejected patches preserve all state.
There is no server session, persistence or global revision registry. The caller
owns the latest state and must discard in-flight responses for older revisions.

`comparison_keys(result)` exposes `(dataset_id, product_id, offer_id)` identities
in original/suggestion order. `select_for_comparison(response, keys)` accepts
only actual returned identities, at most ten, with no duplicates. Same-title
products stay distinct. Re-running validates retained selections against the
current dataset and returned offers; any obsolete selection clears the whole
comparison. Criteria updates clear it immediately. On a failed refresh, callers
must clear visible stale results/comparison until a successful explicit retry.

## Explicit alternative acceptance

```python
from torob.journey.recommendations import AlternativeAcceptance, accept_alternative

# Show the suggestion and EVERY change first; this action follows user acceptance.
suggestion = response.result.suggestions[0]
acceptance = AlternativeAcceptance(
    request_id=response.state.request_id,
    expected_revision=response.state.revision,
    dataset_id=response.result.original.context.dataset.dataset_id,
    offer_id=suggestion.result.offer_id,
    accepted_changes=tuple(suggestion.changes),
)
fresh_state = accept_alternative(response, acceptance, current_state=latest_state)
fresh_response = run_recommendations(existing_catalog_repository, fresh_state)
```

The helper validates request/revision, dataset, offer and the exact ordered list
of disclosed changes against the actual service response and current application
state. It preserves the original explicit money unit, purchase preferences and
shopping time. It returns a new unsearched revision with comparison cleared;
only a fresh service request can establish results under the accepted criteria.
It does not silently increase money/radius or mark inventory verified. This is
an in-process helper, not an acceptance endpoint or a server-side consent log.

## Source ancestry and review bases

Original integration sources (full SHAs):

- Initial main: `876ec67c194267e3bc473dfa089d39d7ec94f1fd`.
- Preserved Journey tip: `87287668ec37e7b648c7cd49b45d458d70fa7d82`.
- Required Recommendation Task 03 tip: `4410a2774cdf17be7b7ca06a2d825535914b1d65`.
- Their prior common base: `a8f64ed96223984e8f62a10a7bb71925b0edc69e`.

`feat/journey-recommendation-adapter` starts at that initial main, merges the preserved
Journey tip (`3929622fd0726cfd62e1cff075c51b11b1dc0d31`), then the required
Recommendation head (`730c3ab797b3197eaf9906e1041c25e50402e3cd`), before adding
Journey-only changes. Existing topic tips and main are not rewritten. Historical
Journey refs retain their original commits.

PRs #1 through #6 are merged. Main `2e16a88` incorporates adapter PR #5 and
standalone API PR #6. The application integration branch includes that main
through a normal merge, preserving published history and resolving the
documentation conflict.

`feat/journey-recommendation-api` originally stacked on adapter commit
`c0734bef1b36c5f318d3662343e106c5fc86cb82` and later incorporated main in
`1b18068` before PR #6 landed. The standalone router belongs to #6. Application
registration, POST CORS support and shared OpenAPI integration belong to PR #7
(`feat/journey-app-integration`), now targeting main for review. No upstream
branch or PR is modified by the application integration work.

## Checks

Root pytest discovery covers `tests/`, so Journey tests must be named explicitly:

```powershell
uv run --no-sync pytest tests src/torob/journey/tests
uv run --no-sync ruff check .
uv run --no-sync ruff format --check .
uv run --no-sync python scripts/export_contracts.py --check
uv run --no-sync python -m torob.journey.example
git diff --check origin/main HEAD
```

Journey integration tests import only `datasets/sample` into per-test temporary
databases, exercise the actual Recommendation service and canonical serialization,
and verify that a missing database is never created by the adapter. The legacy
four-step preparation example remains deliberately offline and blocked.
`recommendation_example.py`, introduced by #6, demonstrates sample recommendations,
explicit scripted acceptance and a fresh search. See [API_HANDOFF.md](API_HANDOFF.md)
for current application registration status and the historical wiring proposal.
