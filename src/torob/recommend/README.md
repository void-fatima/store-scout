# Recommendation input/output contracts — Task 01

Setayesh owns this module. The active package is `torob.recommend` under
`C:\git\shared\store-scout\src\torob\recommend`. It uses the existing
Python 3.12+ project and Pydantic v2 environment. No extra dependencies or shared
configuration changes are required.

This delivery contains models, validation, mock examples and tests. It does not
publish an API route, retrieval client, ranking algorithm, alternatives, follow-up,
or UI integration. The untracked local `catalog.py`, `ranking.py` and
`service.py` belong to unfinished Task 02 and are not imported by `__init__.py`.

## Models

| Model | Purpose |
| --- | --- |
| `ShoppingCriteria` | Product query, explicit-unit budget, optional coordinates, radius, purchase preferences and aware shopping timestamp |
| `OfferCandidate` | Direct re-export of `torob.catalog.contracts.OfferCandidate`; no duplicate offer schema |
| `PurchaseConditions` | Requested payment methods, warranty preference and return window; unknown fields are null |
| `ScoreBreakdown` | Future normalized component scores; optional, unevaluated components remain null |
| `RecommendationResult` | Canonical candidate, matching identifiers, score, explanations, limitations and explicit before-visit uncertainty |
| `RecommendationResponse` | Results plus the required Catalog context, candidate coverage and count metadata |
| `BeforeVisitVerification` | Fixed unverified status, unconfirmed availability and required verification before visiting |
| `CandidateCoverage`, `CandidateBatch` | Input-set provenance, unique recorded offers, contiguous-page counts and explicit query coverage |
| `RankingStrategy`, `RetrievalPolicy` | Provisional future strategy/retrieval metadata only; neither performs retrieval or scoring |

`schema_version="2.0"` identifies this recommendation output shape, adapted from
the earlier standalone `1.0` shape. It does not change the Catalog's independent
`1.0.0-draft.1` contract version. The interface is for team review.

## Validation and uncertainty

- Queries support Persian and mixed Latin/Persian model names, are validated with
  Catalog's shared text normalizer, require letters/digits and allow at most 200
  characters. Text fields reject blank strings and unknown object keys.
- Budgets use finite positive `Decimal` values and serialize as strings for
  precision. Input units are `TOMAN` or `IRR`. `budget_toman` floors to whole
  toman; 10 rial equal 1 toman. Conversion never increases the spending limit.
  Budgets must cover at least 1 whole toman and cannot exceed the Catalog's
  9,000,000,000,000 toman ceiling in the input unit.
- Latitude and longitude must be supplied together and within world-valid bounds.
  Radius is positive, at most 100 km and requires coordinates. Coordinates,
  radius and scores reject booleans, numeric strings, NaN and infinity.
- Shopping timestamps must be timezone-aware; no current-clock or future-time
  inference is made. Purchase preferences use typed enums, strict booleans and
  nonnegative integer return windows.
- Catalog prices are nullable positive integer **toman**, not the legacy Decimal
  `recorded_price` field. A null price remains unknown. Canonical offer validation
  stays exactly as defined in the Catalog model.
- A recorded offer establishes only a product/shop association. Shop business
  categories do not establish that a shop sells a particular product. Availability
  remains `unconfirmed`, with `requires_verification_before_visit=true`.
  The recommendation must disclose `inventory_not_verified`.
- `last_price_changed_at` is a price-change timestamp, never a current-price,
  inventory or freshness verification. The reserved `price_freshness` score is
  null in this contract. Recorded hours, payment options and warranty descriptions
  remain data; unsupported formats and omitted days must not be inferred as
  favorable facts.
- `context` is the authoritative Catalog context and must travel with results.
  Its dataset ID, sample/provided source kind, incomplete Tehran coverage, and
  notices about synthetic/unverified shop identities and synthetic contacts remain
  available to consumers. `provided` does not mean independently verified.
- `complete_for_query` describes only the reported contiguous pages for the
  query. `full_dataset_ranking` is always false. Completing a filtered query
  does not establish complete dataset or geographic coverage.
- Result IDs must match the included canonical candidate. Duplicate offer IDs,
  malformed reasons/limitations and inconsistent response counts are rejected.
  Scores are finite numbers in [0, 1]. Metadata weights must sum to 1, but no
  aggregation, ordering or matching algorithm is executed by these models.
- Product/shop text is untrusted data, never executable instructions. Model
  construction does not execute descriptions, fetch links or contact sellers.

Validate edits from serialized data with `model_validate` or
`model_validate_json`; unchecked `model_copy(update=...)` is not validation.

## Mock examples and use

All four JSON examples have a `fixture_metadata.is_mock=true` label and a
`data` payload. The wrapper labels fixtures and is not an API envelope.
They are **not actual Torob records**. Catalog candidates come from the repository's
published synthetic sample; recommendation scores are hand-authored placeholders.
No ranking or catalog retrieval is performed to produce the examples.

| File | Payload |
| --- | --- |
| `examples/shopping_request.json` | `ShoppingCriteria` |
| `examples/catalog_candidates.json` | Canonical `CatalogPage`, including context and pagination |
| `examples/recommendation_response.json` | `RecommendationResponse` with manual example scores |
| `examples/missing_optional_data.json` | Canonical `OfferCandidate` with unknown price and optional facts |

Run from the repository root:

```python
import json
from pathlib import Path

from torob.recommend import RecommendationResponse, ShoppingCriteria

examples = Path("src/torob/recommend/examples")
request_data = json.loads(
    (examples / "shopping_request.json").read_text(encoding="utf-8")
)["data"]
request = ShoppingCriteria.model_validate(request_data)
assert request.budget_toman == 25000000

response_data = json.loads(
    (examples / "recommendation_response.json").read_text(encoding="utf-8")
)["data"]
response = RecommendationResponse.model_validate(response_data)
assert RecommendationResponse.model_validate_json(response.model_dump_json()) == response
schema = RecommendationResponse.model_json_schema()
```

These Pydantic models can be used as future FastAPI input/output annotations.
There is no new server or route in Task 01.

## Installation and checks

From `C:\git\shared\store-scout`:

```powershell
uv sync --locked
uv run pytest tests/test_recommend_contracts.py
uv run pytest tests/test_catalog.py tests/test_importer.py
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run python scripts/export_contracts.py --check
```

An environment already installed from `uv.lock` can use `uv run --no-sync`
for the same commands. Tests use the existing small sample fixtures and temporary
databases; no external service or original dataset is required. Importing this
package does not require the unfinished Task 02 implementation.

Untracked legacy or unfinished source may fail whole-workspace lint locally.
Keep it unchanged and outside Task 01 commits; validate the tracked project plus
the Task 01 files when assessing this branch. Do not change shared root settings
to hide these unrelated local files.

## Migration and next integration

The old `apps/torob/recommend/` snapshot stays untracked and unchanged. It is
not an installed package or an import dependency of this canonical module.

| Standalone Task 01 | Canonical contract |
| --- | --- |
| Flat product/shop IDs, title, brand and category | Nested `candidate.product` and `candidate.shop`; convenience result IDs are checked against them |
| `recorded_price` plus per-offer units | `price_toman` as nullable positive integer; explicit user-budget conversion only |
| `last_price_update` | `last_price_changed_at`, retaining its narrower meaning |
| Flat shop latitude/longitude | `shop.lat` and `shop.lon` |
| Typed opening/purchase structures | Preserve raw Catalog hours/payment/warranty values; typed preferences belong to the user request |
| Unknown or independently verified stock states | Canonical fixed `availability=unconfirmed`; no verified-stock claims |
| Results without Catalog provenance | Required `context` and explicit candidate/query coverage |

Before Task 02, confirm supported interpretations of raw hours/payment data and
review the provisional score names, weights and version metadata with the team.
Continue on `feat/torob-rec-ranking` only after safely bringing these contract
commits onto that branch while preserving its untracked implementation files.
