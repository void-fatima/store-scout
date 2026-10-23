# Shared frontend contracts

Import from `src/contracts/index.ts` (from Setayesh's directory:
`import type { RecommendationPanelProps } from '../../contracts'`).
Transport models are generated; `panel.ts` only defines the controlled UI
boundary and readonly wrappers around the owning backend types.

## Authority and regeneration

- Recommendation: current `src/torob/recommend/{models,alternative_models,followup_models}.py`.
- Catalog, offers and errors: current `src/torob/catalog/contracts.py`.
- Pending Journey: `src/torob/journey` at
  `45cfe9815ebfd78b0423ca321c2f61e51ea7fbdd`, on
  `feat/journey-app-integration` ([PR #7](https://github.com/void-fatima/store-scout/pull/7)).
  Its `API_HANDOFF.md` supersedes the pre-registration header on the API branch.
  PR #5 landed during parent-flow work; PRs #6 and #7 remain open. Latest reviewed
  integration head `a3b94e2f06e51d7f06aa6998e9ff362c527771a3` has identical runtime
  models/code to this pin (only documentation changed). No backend branch was
  merged or retargeted by this frontend task.

From the repository root, fetch the source objects if needed:

```sh
git fetch origin 45cfe9815ebfd78b0423ca321c2f61e51ea7fbdd
cd frontend
npm ci
npm run contracts:generate
npm run contracts:check
npm run typecheck
```

Generation requires Git, uv and the repository's Python environment (Python
3.13 selected by `.python-version`; project supports Python >=3.12). The Node
runner uses `uv run --project .. --frozen --no-dev` with the existing backend
lockfile. It extracts pending Journey Python files to a temporary import path
from their Git objects, and imports Recommendation/Catalog from this worktree.
It never checks out or merges backend branches or calls an HTTP service.
`scripts/contract-source.json` pins the pending source; update it deliberately
after reviewing the owning contracts and handoff, then regenerate and review.

`scripts/export_contracts.py` exports Pydantic JSON Schemas separately for request
validation and response serialization. `json-schema-to-typescript` produces the
bindings. Committed JSON Schemas retain runtime constraints that TypeScript
cannot enforce. `contracts:check` regenerates in memory and fails on differences
in schemas, bindings or fixtures, without modifying them. Normal component work
uses committed bindings and needs no Python command.

Fixtures under `src/test/fixtures/contracts.ts` are generated from the canonical
Recommendation examples after Pydantic validation, plus a real Journey envelope
produced with the synthetic sample database in a temporary directory. A fixed
import timestamp makes that fixture deterministic. Input, error and acceptance
fixtures are validated with their owning models too. No stock verification or
seller contact occurs.

## Exact contract details and differences from UI shorthand

- The HTTP input is `ShoppingRequest`; the success envelope is
  `JourneyRecommendations = { state, result }`. Pass `result`, the complete
  `AlternativesResponse`, to the panel. Do not POST output-only state fields.
- Journey uses `criteria.q`, while Recommendation's `ShoppingCriteria` uses
  `query`. Journey's adapter requires coordinates; standalone Recommendation
  schemas and examples allow them to be null. Do not wrap such examples in a
  fabricated successful Journey state. City/area text and minimum-price filters
  are rejected by the current adapter rather than silently applied.
- Response decimal budgets are strings. Input schemas admit number or string;
  Journey's model validator rejects floating-point money. Send exact decimal
  strings (including IRR fractional amounts), or safe integers. Recorded
  `price_toman` remains a nullable integer number, capped at 9,000,000,000,000.
- Required, defaulted/optional and nullable fields follow Pydantic's schemas.
  Default values do not mean every field is marked required in a serialization
  schema. Optional properties must be handled by consumers. Array bounds,
  identifiers, ranges and cross-field rules still require backend validation.
- `ErrorResponse.error.code` is a canonical string, not a closed enum.
  `details` is an array of JSON-valued records. The owning Pydantic export emits
  `{}` for `JsonValue`; generated bindings safely retain `unknown` there.
  Narrow values before displaying them; no invented error-detail model is added.
- `AlternativeAcceptance` comes from Journey's actual model. Its
  `accepted_changes` requires at least one change; a suggestion's `changes` is
  bounded to one through three. Passing the exact displayed suggestion changes
  is compatible with the owning acceptance model.
- Comparison identity is `{dataset_id, product_id, offer_id}`. A whole
  `ComparisonState` also binds keys to request ID and revision (max 10 unique
  keys, checked against current results by Journey). The panel gets readonly
  selected keys and returns proposed selection through its callback.

## Controlled panel responsibilities

The proposed `RecommendationPanelProps` is compatible with these models. It
includes request identity/revision, full nullable response, readonly comparison
selection, loading/error status, and callbacks for comparison, verification,
retry and explicit alternative acceptance. No feature component is implemented.

Preserve the response order. Match `original_verification` by `offer_id`; retain
dataset/product/offer identity in callbacks. Keep relaxed suggestions separate
from `original.recommendations` and show every change and both constraint sets.
Verification plans remain `awaiting_user_verification`, checklist items `pending`,
and availability `unconfirmed`. Displaying a plan does not verify stock.

Call acceptance only after the user explicitly agrees to all disclosed changes.
The parent must check current request/revision/dataset, validate updated criteria,
increment revision, clear comparison and old results, and POST a fresh complete
request. There is no HTTP acceptance endpoint or persisted server consent store.
Discard stale responses and clear visible results/comparison on snapshot errors.
Those parent state/API behaviors now live in `src/journey/` and `src/api/`;
see `frontend/HANDOFF.md` for the controller and mounting boundary. The panel
props interface itself is unchanged. The post-acceptance test fixture is also
derived through the owning helper and a fresh service call.
# Catalog product details (Stage 3A)

`ProductDetail` / `Product` are generated by the existing exporter from
`torob.catalog.contracts`, alongside Journey responses. The reviewed Journey pin
is unchanged. `productDetailFixture` comes from the real disposable sample import.
Run `npm run contracts:generate`; never edit generated types, schemas or fixtures.

The read-only `api/productDetail.ts` client uses the configured API origin and
canonical runtime validation. It rejects product or complete dataset identity
mismatches (including import timestamp/hash), absent provenance and invalid JSON.
Journey requests, public panel props and controller behavior remain unchanged.

