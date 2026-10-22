# Journey API handoff

## Application integration

The integration branch registers the Journey router in `torob.api.create_app` and
permits POST for the configured CORS origins. The current public contract is in
[contracts/README.md](../../../contracts/README.md) and its generated OpenAPI.
Main-app tests in `tests/test_journey_api.py` use temporary sample databases.
The supplied `shared-wiring.patch` is malformed (`git apply --check` reports a
corrupt patch at line 9); its three wiring changes were applied directly instead.
The patch is retained as a historical reference and should not be reapplied.

## Original pre-registration handoff

The remaining sections record the handoff before application integration; their
unregistered-route and unapplied-patch statements describe that earlier stage.

**Ready for registration, not registered in the production app.**
`POST /api/v1/journey/recommendations` and its envelope are proposals for team
coordination. Only the Journey router and test-owned apps expose it in this stage.
The existing production app still exposes Catalog and permits GET through CORS.

## Request, response and errors

The JSON body is the extended `ShoppingRequest`, not `ShoppingState`:

```json
{
  "request_id": "shopper-supplied-id",
  "revision": 0,
  "criteria": {
    "q": "گوشی سامسونگ",
    "max_budget": "200000009.123456789",
    "price_unit": "IRR",
    "latitude": 35.7,
    "longitude": 51.4,
    "max_distance_km": 5.0,
    "preferred_purchase_conditions": {"payment_methods": ["card"]},
    "shopping_time": "2026-10-24T15:30:00+03:30"
  },
  "comparison": null
}
```

An optional comparison is `{request_id, revision, keys: [{dataset_id, product_id,
offer_id}]}` and must match the request identity/revision. Selections are checked
against current results after retrieval. Send only `ShoppingRequest` fields
from returned state; `status` and `search_performed` are output-only.

Success (`200`) is `{state: ShoppingState, result: AlternativesResponse}`. A valid
empty result has `result.original.recommendations=[]`; inspect diagnoses,
suggestions and coverage. It is not an upstream failure or proof of market-wide
absence. [INTEGRATION.md](INTEGRATION.md) documents mapping and state rules.

The router uses Recommendation's default `AlternativePolicy` and calls Task 03
once. It reuses `request.app.state.catalog`, normally the existing
`CatalogRepository`. No new storage lifecycle, importer, ranking, retry loop or
seller contact is introduced.

| Status | Canonical error codes |
| --- | --- |
| 422 | `invalid_request`, `missing_information`, `unsupported_constraint`, `invalid_recommendation_input` |
| 409 | `catalog_snapshot_changed` |
| 502 | `catalog_invalid_response`, `invalid_recommendation_data` |
| 503 | `catalog_unavailable`, including an unconfigured app source |
| 504 | `catalog_time_limit` |
| 500 | `internal_error` for unexpected boundary failures |

All errors use `ErrorResponse = {error: {code, message, details}}`. Task 03's
response is preserved exactly, including its `retryable` detail. Input validation
includes location/message/type without raw input or exception context. Raw
upstream exceptions are never returned. On snapshot errors discard visible old
results/comparison and offer an explicit fresh retry; never combine snapshots.

There is no public acceptance endpoint or server revision store in this proposal.
The in-process `accept_alternative` helper consumes an actual service response
and current application state. HTTP consumers must obtain explicit acceptance
of all displayed changes, advance their controlled revision, clear comparison,
and POST complete, explicitly updated criteria. The server revalidates this fresh
request; it does not establish a persisted record of user consent. Do not display
an old relaxed suggestion as a freshly qualified original result.

## Exact shared wiring still requiring agreement

The minimal, unapplied patch is [shared-wiring.patch](shared-wiring.patch):

```diff
 from torob.data.database import initialize
+from torob.journey.router import router as journey_router

-        allow_methods=["GET"],
+        allow_methods=["GET", "POST"],

     app.include_router(catalog_router)
+    app.include_router(journey_router)
```

This preserves the existing Catalog source/lifespan and CORS origin/header list.
`git apply --check src/torob/journey/shared-wiring.patch` validates applicability
without changing shared files. The test-owned app exercises registration and
POST preflight using the proposed methods/origin/header behavior.

After route/envelope agreement, the shared-file owner can apply the patch, update
`contracts/README.md` with the agreed endpoint/envelope, and run:

```powershell
uv run --no-sync python scripts/export_contracts.py
uv run --no-sync python scripts/export_contracts.py --check
```

The existing exporter derives `contracts/openapi.json` from `create_app`; after
registration it will include Journey and canonical nested schemas. No exporter
implementation change is currently required. Review and commit the shared
artifact update as a coordinated change; do not hand-edit generated JSON.
Registration, CORS, shared docs and artifacts remain unchanged here, so the current
contract check still passes. No UI or deployment change is included.

## پیشنهاد اتصال رابط کاربری

بک‌اند فعلی با Python، FastAPI، Pydantic و SQLite تأیید شده است؛ React و TypeScript
فعلاً پیشنهاد فرانت‌اند هستند. مسیر POST بالا و envelope آن هم هنوز نیاز به توافق
دارند و در اپ اصلی ثبت نشده‌اند.

کامپوننت پیشنهادی controlled باشد: والد پاسخ کامل `AlternativesResponse`، شناسه و
revision درخواست، وضعیت بارگذاری/خطا و کلیدهای مقایسه را نگه دارد. تایپ‌های زیر پیشنهاد
قرارداد هستند؛ هنوز binding مشترک TypeScript تولید یا تصویب نشده است. تایپ‌های
`AlternativesResponse`، `AlternativeSuggestion`، `FollowupPlan` و `ErrorResponse`
باید مستقیماً از قرارداد واقعی و پس از توافق ساخته شوند، نه از snapshot قدیمی.

```typescript
type ComparisonKey = Readonly<{
  dataset_id: string;
  product_id: string;
  offer_id: string;
}>;

type AlternativeAcceptance = Readonly<{
  request_id: string;
  expected_revision: number;
  dataset_id: string;
  offer_id: string;
  accepted_changes: AlternativeSuggestion["changes"];
}>;

type RecommendationPanelProps = Readonly<{
  requestId: string;
  revision: number;
  response: AlternativesResponse | null;
  comparison: readonly ComparisonKey[];
  status: "idle" | "loading" | "ready" | "error";
  error: ErrorResponse | null;
  onComparisonChange: (keys: readonly ComparisonKey[]) => void;
  onViewVerification: (key: ComparisonKey, plan: FollowupPlan) => void;
  onRetry: (requestId: string, revision: number) => void;
  onAcceptAlternative: (acceptance: AlternativeAcceptance) => void;
}>;
```

- نتایج اصلی از `original.recommendations` و برنامه‌ها از `original_verification` می‌آیند؛
  برنامه با `offer_id` متناظر شود. جایگزین‌ها جدا و همراه با `suggestions[].changes`،
  `original_constraints` و `relaxed_constraints` نمایش داده شوند.
- ترتیب پاسخ حفظ شود؛ فقط بر اساس `overall_score` دوباره مرتب نکنید. برای مقایسه و
  callback برنامهٔ بازدید از کلید دیتاست/محصول/آفر استفاده کنید، نه عنوان کالا.
- `onAcceptAlternative` فقط پس از نمایش و پذیرش صریح همهٔ تغییرها اجرا شود. والد باید
  revision و دیتاست جاری را بررسی کند، معیارها را اعتبارسنجی کند و درخواست تازه بفرستد؛
  افزایش خودکار بودجه یا شعاع مجاز نیست. این callback به معنی وجود endpoint مستقل
  پذیرش یا ذخیرهٔ رضایت در سرور نیست.
- تغییر معیارها مقایسه را پاک و revision را زیاد می‌کند. پاسخ قدیمی را روی revision
  جدید ننشانید؛ تغییر دیتاست یا خطای snapshot نیاز به پاک‌کردن نمایش قدیمی دارد.
- قیمت ثبت‌شده و زمان تغییر آن، dataset/context، پوشش و سقف بازیابی، هشدار تماس ساختگی
  و موجودی تأییدنشده دیده شوند. checklistها هنوز `pending` و برنامه‌ها
  `awaiting_user_verification` هستند؛ نمایش برنامه هیچ موجودی‌ای را تأیید نمی‌کند.

## Actual ancestry and verification

The API branch starts exactly at adapter commit
`c0734bef1b36c5f318d3662343e106c5fc86cb82`. Its router commit is
`6ab04cc6760ca7c46661b26db77ddbae73c8c9f0`. The API draft targets
`feat/journey-recommendation-adapter`; the adapter draft targets
`feat/torob-rec-followup` (PR #3). Full source SHAs and required history merges
are recorded in [INTEGRATION.md](INTEGRATION.md).

No teammate PR was merged or changed and no original Journey ref was pushed.
Coordinate upstream stack landing before retargeting Journey drafts to main.
These drafts are not a production route rollout.

Run all checks in the integration document plus:

```powershell
uv run --no-sync python -m torob.journey.recommendation_example
git apply --check src/torob/journey/shared-wiring.patch
```

The new demo imports only the existing synthetic sample into a temporary directory,
labels its scripted explicit acceptance, performs a fresh search and cleans up.
The existing Journey example remains offline preparation-only. No existing
database is replaced and no full dataset is imported.

Verified on Windows / Python 3.13.15:

- Adapter branch: 449 tests passed (368 existing + 81 Journey).
- Completed API workspace: 470 tests passed (368 existing + 102 Journey).
- Whole-project Ruff lint and formatting passed (65 supported files).
- Existing shared contract verification passed; production schema is unchanged.
- Both Journey examples passed, including canonical JSON checks on fresh results.
- The unapplied wiring patch passed `git apply --check`.
- One existing Starlette/httpx deprecation warning remains; dependencies were not changed.
- Catalog/data/API/shared artifacts match main `876ec67`; Recommendation and root
  tests match the required upstream head `4410a277`. No teammate-owned edits.

These are local checks; they do not assert that remote CI or a production rollout
has completed. No Python 3.12 run is claimed for this local environment.
