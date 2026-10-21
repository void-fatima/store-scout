# Recommendation contracts and deterministic ranking

Setayesh owns this module. The active package is `torob.recommend` under
`C:\git\shared\store-scout\src\torob\recommend`. It uses the existing
Python 3.12+ project and Pydantic v2 environment. No extra dependencies or shared
configuration changes are required.

Task 01 supplies the canonical models, validation and mock examples. Task 02 adds
bounded Catalog retrieval, deterministic ranking, Persian explanations and an
in-process service. No new API route, alternatives, follow-up or UI integration
is included. Implementation modules are not imported by `__init__.py`.

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
request_data = json.loads((examples / "shopping_request.json").read_text(encoding="utf-8"))["data"]
request = ShoppingCriteria.model_validate(request_data)
assert request.budget_toman == 25000000

response_data = json.loads((examples / "recommendation_response.json").read_text(encoding="utf-8"))[
    "data"
]
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
contract package does not load retrieval, ranking or service implementation modules.

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

Review supported interpretations of raw hours/payment data and the explicit
scoring policy with the team. Task 03 can build structured follow-up and a
before-visit verification checklist on these results; it must retain provenance,
coverage and inventory uncertainty.

## Task 02 — deterministic ranking and Catalog retrieval

Use explicit implementation imports; package initialization remains model-only:

```python
from torob.recommend import ShoppingCriteria
from torob.recommend.service import RecommendationServiceError, recommend


def shopping_recommendations(source):
    criteria = ShoppingCriteria(
        query="گوشی سامسونگ Galaxy A55",
        max_budget="25000000",
        price_unit="TOMAN",
        latitude=35.7,
        longitude=51.4,
    )
    try:
        result = recommend(source, criteria)
    except RecommendationServiceError as exc:
        return exc.response.model_dump(mode="json")
    return result.model_dump(mode="json")
```

`source` can be the existing `CatalogRepository`, or
`CatalogAPIClient(transport, timeout_seconds=5)` with an HTTP client configured
for the Catalog base URL. The client calls only `GET /api/v1/catalog/offers`.
The caller owns the transport lifecycle. No new API routes, Journey dependencies,
seller contact calls or production dependencies are added.

### Scoring policy: lexical-v1

Results sort by **product relevance descending, weighted score descending,
offer ID ascending**. Consumers should preserve that order rather than sorting
by `overall_score` alone. Both strategy version and weights are returned.

| Component | Normalization | Default weight |
| --- | --- | --- |
| Product relevance | Prefix token matches in normalized product title/brand/model get 1; product-category-only matches get 0.5; divide by unique query token count | 0.60 |
| Budget fit | `1 - price_toman / budget_toman`, after excluding missing or over-budget prices | 0.20 |
| Distance fit | `max(0, 1 - straight_line_km / scale)`; scale is the requested radius, otherwise 10 km | 0.15 |
| Opening hours | 1 for a supported declared shift containing the requested time, 0 outside known shifts; otherwise null | 0.025 |
| Purchase preferences | A supported payment-code match divided by the number of requested preference dimensions; unsupported dimensions get no bonus | 0.025 |

A small documented Persian/English noun vocabulary distinguishes known primary
products from accessories. A phone query excludes a case, charger or other known
incompatible product type even when every query token appears in its title.
The first recognized product noun also permits a phone bundled with a case.
For ambiguous brand/model-only queries, accessories receive 25% of their lexical
relevance rather than being assumed to be the requested main product.
This is a conservative lexical heuristic, not semantic identification or a
complete product taxonomy. Partial matches remain possible and are explained.

Only the **product's** recorded category contributes to relevance; shop activity
categories, seller descriptions and seller titles do not. Descriptions remain
untrusted data in the preserved canonical candidate and never become instructions.

Budgets are inclusive and use the validated whole-toman limit. Unknown prices
cannot qualify for a budget. Radius is a hard filter and uses recomputed full
precision geographic distance, not the rounded Catalog `distance_km`. With a
radius, missing coordinates exclude an offer; without one, unknown distance stays
null and receives no bonus. Distance is not road distance or travel time.

Missing components remain null and contribute zero to the weighted total;
weights are never renormalized over the available data. Unknown stock and
price-change timestamps never earn a freshness/availability bonus.

Only exact recorded payment tokens `cash`, `card` and `installments` support a
preference match. Raw Persian payment prose, warranty descriptions and return
windows are not inferred. For hours, only `status=declared` day records with
nonempty, valid same-day `start_time`/`end_time` shifts are supported; closing
times are exclusive. Omitted days, overnight/offset conventions and unsupported
records stay unknown. Tehran time conversion uses the IANA timezone database;
if unavailable, the hours component stays unknown. Recorded hours and payment
terms never guarantee the shop's actual state at a future visit.

### Retrieval and coverage

Defaults are 3 pages of 100 candidates, with hard configuration bounds of 10 pages
and 100 candidates per page. Queries use the user's exact product search terms,
inclusive maximum price, optional location/radius, and Catalog `price_asc` order.
There is no automatic query broadening or alternative search. The HTTP adapter
passes a finite timeout (default 5 seconds, configurable up to 30) to each request;
there are no automatic retries.

Retrieval validates schema version, pagination/counts, ascending price/ID order,
unique offer IDs and consistent Catalog context across pages. A changed snapshot,
malformed page or failed later request discards the whole batch. Partial results
are never presented as a successful complete retrieval.

Coverage describes the **retrieved price-sorted prefix of a filtered query**,
not the whole dataset. A page cap may hide stronger matches, including main
products behind cheaper accessories. Empty ranked results under a page cap do
not establish that no qualifying products exist elsewhere. Dataset coverage
remains incomplete even when all pages of one query have been retrieved.
Exclusion counters describe retrieved candidates and their first failed guard;
records filtered upstream by Catalog are not counted as locally excluded.

### Errors, empty results and uncertainty

`recommend` returns the canonical recommendation response on success, including
valid empty results. `no_eligible_offers` and coverage notices describe empty
results; `catalog_has_no_imported_dataset` distinguishes an empty/uninitialized
Catalog from a known imported dataset.

Failures raise `RecommendationServiceError` with a canonical
`ErrorResponse` at `exc.response`. Public messages are Persian and do not echo
raw upstream errors or descriptions.

| Error code | Retryable |
| --- | --- |
| `invalid_recommendation_input` | false |
| `catalog_unavailable` | true |
| `catalog_snapshot_changed` | true; start a fresh bounded request |
| `catalog_invalid_response` | false |
| `invalid_recommendation_data` | false |

Persian reasons cite recorded product text matches, recorded prices, computed
straight-line distance and supported recorded terms. Every result keeps
`availability=unconfirmed`, requires before-visit verification, and discloses
price/inventory limitations. Canonical candidates and source context are retained;
the engine creates no new offers, seller identities or contact details.

Run focused behavior tests with:

```powershell
uv run pytest tests/recommend
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run python scripts/export_contracts.py --check
```

The historical `apps/torob/recommend/` snapshot remains untracked and untouched.
For local whole-workspace Ruff commands, use
`--exclude apps/torob/recommend` when that preserved snapshot is present.
CI on the published branch checks the full tracked project without that snapshot.
The existing Starlette/httpx deprecation warnings belong to the current locked
test environment; this module does not change shared dependencies.
