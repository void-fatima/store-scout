# Shopping Journey

Journey now maps validated requests to the actual Recommendation Task 03 service.
Read [INTEGRATION.md](INTEGRATION.md) for current interfaces, revision/comparison
rules, source ancestry and coordination requirements. The original offline
preparation functions remain available; `prepare_catalog_request` is still a
blocked legacy preparation envelope, never the dispatcher for recommendations.
The stacked API branch adds [API_HANDOFF.md](API_HANDOFF.md) with the proposed
POST router, exact unapplied wiring patch and Persian controlled-props handoff.

## Historical Stage 1 record

The following records the original offline foundation. Its capability statements,
verification counts and branch publication status describe that checkpoint;
the integration handoff supersedes them for current work.

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

The current catalog query cannot represent city/area constraints. Prepared
requests retain these constraints and identify that gap rather than silently
dispatching a broader query or inventing coordinates.

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

`prepare_catalog_request(state)` prepares a `CatalogRequest` and changes the
returned state's status to `catalog_request_prepared`. The whole original
criteria object and identity are retained. `parameters` contains only the
explicit `q` and non-null budget bounds, validated with the existing read-only
draft `CatalogQuery`. No sort, pagination, location, or budget defaults are added.
Catalog-specific invalid text returns `invalid_query` without rewriting the need.

This is a **prepared request, not search results**. City and selected area remain
in `criteria` and are listed in `unresolved_filters`, with `handoff_ready=false`.
The current catalog has no textual city/area filter. Do not dispatch the partial
`parameters` alone: doing so would discard user location constraints. No dataset
is opened, readiness assumed, coordinates generated, or ranking performed.
`search_performed=false` appears on the outcome, state, and prepared request.
The dataset/catalog implementation exists upstream, but its readiness is not
inspected here; the unresolved location interface is explicitly a Roham dependency.

From the repository root, after the existing `uv sync --locked` setup:

```powershell
uv run --no-sync pytest src/torob/journey/tests
uv run --no-sync python -m torob.journey.example
```

Shared pytest discovery is configured for `tests/`; explicitly name this module's
tests without editing root configuration. Network access is unnecessary for tests.

## Application-facing usage

```python
from torob.journey import prepare_catalog_request, start_journey, update_criteria

initial = start_journey({"request_id": "sample-1", "criteria": {"q": "گوشی"}})
completed = update_criteria(initial.state, {"city": "تهران", "area": "ونک"})
changed = update_criteria(completed.state, {"max_price_toman": 25000000})
prepared = prepare_catalog_request(changed.state)
payload = prepared.model_dump(mode="json")
```

Input for creation is an object with `request_id` and a nested `criteria` object.
Updates take a typed `ShoppingState` plus a flat criteria object. Callers keep
the returned state and check `error`/`missing_information` before continuing.
There are no HTTP handlers, sessions, accounts, or persistence. A successful
criteria patch resets catalog preparation; call `prepare_catalog_request` again
to obtain a request reflecting the new constraints. Rejected patches preserve
the last accepted state and never partially apply valid sibling fields.

The single runnable example prints four labeled steps: create an incomplete
request, supply its city, change its budget, and prepare the catalog request.
Sample query/city/area values come from explicit illustrative inputs; there are
no sample offers or fabricated search results. Each snapshot is independent;
old budget values remain unchanged. `handoff_ready=false` is intentional, because
the current catalog cannot apply the retained city/area constraints.

## Verification

The existing stack uses Python 3.13, Pydantic, pytest, Ruff, and locked uv
dependencies. The clone was initialized with the existing `uv sync --locked`;
no dependencies were added and no manifest or lockfile was edited. Checks run
locally on Windows/Python 3.13.15. The 56 existing tests passed before changes.
Journey adds 43 collected test cases covering strict amounts/types, missing
information, exact criteria preservation, atomic updates, JSON output, and
catalog preparation. Two end-to-end regressions guard against network/database/
file/process use and reusing old prepared criteria after an update.

Run the complete relevant verification from the repository root:

```powershell
uv run --no-sync pytest tests src/torob/journey/tests
uv run --no-sync ruff check .
uv run --no-sync ruff format --check .
uv run --no-sync python scripts/export_contracts.py --check
uv run --no-sync python -m torob.journey.example
git diff --check a8f64ed HEAD
```

No live API smoke test, dataset import, production ZIP inspection, geographic
calculation, or recommendation test is part of this module. Existing catalog
tests use their upstream temporary fixtures. The existing Starlette/httpx
deprecation warning was present at baseline and is outside journey ownership.

## Repository and branch ancestry

The starting local workspace contained Liara-only `infra-pilot`; it was not
modified. The verified separate repository is `void-fatima/store-scout`, cloned
to `C:\Users\FATIMA\GitHub\store-scout`. Actual Git history superseded stale
repository-list size metadata; this was an established project, not an empty
bootstrap. `origin` is its only configured remote. No applicable `AGENTS.md` was
found in the repository or its local ancestor directories.

Synchronization completed successfully:

```powershell
git fetch --all --prune --tags
git pull --ff-only
```

The pull ran on clean `main`, tracking `origin/main`, and reported already up to
date. Verified starting commit: `a8f64ed96223984e8f62a10a7bb71925b0edc69e`.
Other remote branches were fetched, with no unrelated branch merges or rebases.

Three topic branches partition this single stage by actual work. They are
**stacked**, not independent changesets:

| Branch | Base | Scope |
| --- | --- | --- |
| `feat/torob-fatima-journey-foundation` | `a8f64ed` (`main`) | Models, validation, request intake and missing information. |
| `feat/torob-fatima-journey-updates` | Foundation tip `37e7a1c` | Atomic updates preserving identity and unrelated criteria. |
| `feat/torob-fatima-journey-catalog-preparation` | Updates tip `1f4d6ff` | Catalog preparation, offline regression coverage, example and handoff. |

The final catalog-preparation branch includes all changes from the earlier two.
Review the complete stage and precise commit history with:

```powershell
git diff a8f64ed HEAD -- src/torob/journey/
git log --reverse --oneline a8f64ed..HEAD
```

All edits are in `src/torob/journey/`: package exports, `models.py`, `intake.py`,
`updates.py`, `catalog.py`, `example.py`, this README, and module-local tests.
No protected files, shared configuration, CI, root README, data, catalog,
recommendation, Liara, or Wallex files were changed. Nothing is pushed or merged.

## Team decisions and remaining dependencies

- Agree on journey identity, `q` semantics, required city/optional area, optional
  budget bounds, null-clearing, and local preparation statuses. Zero budgets are
  currently rejected to match the existing catalog `Price`; no unit is guessed.
- With Roham, agree how to represent/apply city and area before dispatch. The
  relevant read-only contract is `src/torob/catalog/contracts.py::CatalogQuery`,
  with generated documentation in `contracts/`. City/area filters or an explicit
  mapping interface must be provided by the catalog owner; no changes to those
  protected paths are required to finish this preparation-only stage.
- Dataset readiness and actual result retrieval remain catalog-owned and are
  not inspected here. The original ZIP is unnecessary for these offline tests.
- No Setayesh implementation is needed for Stage 1. Ranking, alternatives,
  recommendation explanations, and recommendation components remain hers.

All journey models remain local proposals. Reusing the existing draft catalog
schema is not a claim of team approval or end-to-end search compatibility.
The smallest next Fatima backend task is a module-local JSON application boundary
for retained journey states, preserving these validation and update rules.
Comparison coordination, RTL/mobile UI, and deployment are later work; they are
not started in this stage.
