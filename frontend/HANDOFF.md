# Stage 1 shell and search handoff — 2026-10-22

This section supersedes the historical status notes below. Stage 1 implements
`Desktop/01-Landing-Search.png` and `Mobile/10-Landing-Search.png` from the supplied
StoreScout package. All remaining reference screens were reviewed for visual
language only. Results cards, explanations, alternatives, checklists and final
comparison visuals are deferred.

## Delivery and dependencies

- Branch: `feat/ui-shell-search`, based on
  `1c276967506e408d1329c43280c917fa47ea3022` (`feat/frontend-comparison-view`, PR #12).
- The draft PR is stacked on #12; #8–#12 keep their existing bases. Six focused
  Conventional Commits; no resets, stashes, rebases or force-pushes.
- All tracked changes are under `frontend/`. No files in the reserved
  `src/features/recommendation/**` directory, generated contracts, controller,
  backend, CORS or root dependencies changed.
- Fresh remote main `e105558` includes backend PR #7. Its runtime Python code is
  identical to the existing reviewed contract source pin
  `45cfe9815ebfd78b0423ca321c2f61e51ea7fbdd`; the pin remains deliberate.

## Shared integration

`App` now owns the one existing `useJourneyController()` instance and passes it
to the optional `JourneyFlow.controller` prop. Header count reads directly from
`state.comparison.length`. Standalone `<JourneyFlow Panel={...} client={...} />`
continues to create its own single controller. `JourneyFlow.Panel`,
`RecommendationPanelProps`, existing API contracts and controller behavior are
unchanged. Both route subtrees remain mounted. Criteria edits still invalidate
results, comparisons and plans and abort outstanding requests.

The horizontal RTL header includes working search and comparison routes and
`#guide`, which opens and focuses the actual three-step buying guide even from
comparison. Mobile has a keyboard-accessible menu with Escape returning focus
to its trigger. No account, notification or location-permission features exist.

`CriteriaForm` remains the actual controlled form. Units and starting criteria
are blank. Money is never formatted through floating point; Persian/Arabic
digits and decimal normalization remain unchanged. Native details/summary
reveals only supported payment, warranty and return-window fields. Closing the
disclosure retains values. Errors inside it reopen it; local and asynchronous
backend field errors focus their associated control. Stock and price caveats
remain visible; there is no permanent sample-data badge.

## Stable styling and assets

- `src/styles/tokens.css`: existing semantic token names, warm page/navy text/
  coral action colors, spacing, radii, typography, pastel and shadow tokens.
- `src/styles/global.css`: loaded once by `src/main.tsx`; inherited Persian
  typography/RTL, shell/search styles, focus and reduced-motion treatment.
- `src/assets/search-hero.jpg`: 887x290 illustration-only crop, 32,650 bytes.
- `src/assets/README.md`: crop coordinates, source provenance and font source.
- `public/fonts/Vazirmatn-Variable.woff2` and `public/fonts/OFL.txt`: self-hosted
  variable font and complete SIL Open Font License; no runtime CDN dependency.
- `src/shell/Icon.tsx`: small native SVG icons and compass mark.

### تحویل به ستایش

استایل مشترک یک‌بار در `src/main.tsx` بارگذاری می‌شود. در کامپوننت‌های خودت از
توکن‌های `src/styles/tokens.css` مثل `--color-text`، `--color-text-muted`،
`--color-surface`، `--color-accent`، `--color-border`، `--space-*` و `--radius-*`
استفاده کن. فونت وزیرمتن و جهت RTL از صفحه به ارث می‌رسند؛ فاصله‌ها را با ویژگی‌های
منطقی مثل `padding-inline` بنویس. استایل اختصاصی پیشنهادها را در پوشهٔ خودت نگه دار.
`RecommendationPanelProps` و `JourneyFlow.Panel` تغییری نکرده‌اند؛ برای اتصال خروجی
واقعی کامپوننتت نیازی به تغییر props، توکن‌ها یا تنظیمات مشترک نیست. ترتیب پاسخ،
شناسه‌ها و پیام‌های عدم قطعیت را حفظ کن و برچسب نمونه را فقط از context واقعی بخوان.

## Verification performed

Node 24.21.0 / npm 11.19.0, Windows, headless Google Chrome through Playwright:

- `npm run typecheck`, `npm run lint`, `npm run build`,
  `npm run contracts:check`: passed. Canonical bindings/fixtures unchanged.
- `npm test`: 52 passed, one opt-in live test skipped.
- `STORE_SCOUT_LIVE_API=http://127.0.0.1:8017 npm run test:live`: one passed
  separately against the disposable synthetic API. Covers real submission,
  selection, explicit scripted acceptance/fresh POST, canonical 422 and preflight.
- `npm run test:ui`: five passed. Real browser viewport sizes: 1440x900,
  768x1024, 390x844 and 360x844. Captured landing, field errors and expanded
  preferences at every size; inspected the rendered compositions and wrapping.
  No page-level horizontal overflow in initial or expanded states. Visible form
  controls and payment labels have at least 44x44 targets. Keyboard skip link,
  disclosure, menu Escape, route/guide focus, local/backend field focus, exact
  decimal retention and retry revision behavior passed. WCAG A/AA axe scans
  had zero violations in initial and expanded states at each size. The first
  scan found selected payment text contrast; it was corrected before delivery.
- The browser HTTP-failure test intercepts only its test request. Browser
  screenshots are not a claim of a deployed backend connection or seller contact.
  The separate opt-in live HTTP test exercises the actual pinned API.
- `git diff --check` and ownership-boundary diff checks: passed.

Reproduce browser checks after `npm ci`:

```sh
npx playwright install chromium
npm run test:ui
```

Or set `STORE_SCOUT_CHROMIUM` to an installed Chromium/Chrome executable (used
here: `C:/Program Files/Google/Chrome/Application/chrome.exe`). Playwright starts
Vite if needed. Browser-only tooling is in frontend devDependencies. Outputs,
traces and HTML reports go to gitignored `frontend/ui-artifacts/`.

Final local evidence copies (not committed) are in
`C:/Users/FATIMA/StoreScout-reference/verification/`:
`stage1-{desktop,tablet,mobile,narrow}-{landing,errors,preferences}.png`.
The reference archive/screenshots remain outside tracked source. Only the used
hero crop is committed.

## Remaining limitations

Setayesh's production Recommendation component is not yet published/mounted;
the existing reserved mount stays empty and received-results copy states this
truthfully. The search sends requests to the existing configured API origin;
set `VITE_API_BASE_URL` for the intended backend as before. No deployed API,
real seller inventory, travel-time/location lookup, Safari, Firefox or physical
mobile-device verification was performed. Final comparison visual redesign and
all later-stage screens remain deferred. No deployment was performed.

---
# Frontend Journey and comparison handoff

## Branches and ownership

The comparison view is on `feat/frontend-comparison-view`, based on the complete
parent-flow reference `6c4f6bfabc8c2034bf3a48fdb1b57db1ff015318` and stacked on
`feat/frontend-journey-flow` (draft PR #11). The complete parent flow is stacked on
`feat/frontend-journey-client`, which starts at the published foundation
`da70cee27a5730512f09f971c10c77f7b881a9e9` on
`feat/frontend-recommendation-contracts`. The final delivery message and draft
PRs supply the full pushed SHAs. No published history was rewritten.

- Setayesh exclusively owns `src/features/recommendation/**`. No files were
  created, edited, moved or duplicated there. No published component was present
  in the inspected remote branches, so production keeps its mounting boundary
  empty and clearly says that the result UI still needs connecting.
- Fatima owns `src/api/`, `src/journey/`, the shell, shared contracts/styles,
  parent state, comparison and explicit acceptance orchestration.
- Roham owns backend application wiring, CORS, shared API documentation and
  OpenAPI. This task changes only `frontend/` and does not manage backend PRs.

## Run and API configuration

Supported runtime: Node 24 LTS (>=24.21.0, <25), npm 11. Use `npm.cmd` if
PowerShell blocks the npm `.ps1` launcher.

```sh
cd frontend
npm ci
npm run dev
```

Copy `.env.example` to untracked `.env.local`. Set `VITE_API_BASE_URL` to the
HTTP(S) backend origin, optionally including a path prefix. For example, the
disposable sample server below uses `http://127.0.0.1:8017`. An empty value sends
same-origin requests to `/api/v1/journey/recommendations`. Restart Vite after
changing configuration. No deployed host is hard-coded; credentials are omitted.
Use `http://localhost:5173` for the frontend when exercising the backend's existing
default CORS origin. Cross-origin permission remains the backend owner's concern.

The form requires explicit query, budget unit and coordinates. It collects only
supported radius/payment/warranty/return-window preferences. Coordinates start
blank; there is no geocoding, intent parsing or assumed location. Persian/Arabic
digits and the Arabic decimal separator are normalized. Money stays an exact
decimal string; the backend owns currency conversion and authoritative bounds.
Basic field validation and safe backend field errors preserve entered values.

## Controller and component mounting

```tsx
import { JourneyFlow, useJourneyController } from './journey'
import type { RecommendationPanelProps } from './contracts'

// Once the teammate-owned component is published, import its real export and:
// <JourneyFlow Panel={RecommendationPanel} />
```

`JourneyFlow` accepts an optional `Panel: ComponentType<RecommendationPanelProps>`
and mounts it at the existing `#recommendation-root`. `App.tsx` currently renders
`<JourneyFlow />`. There are no substitute cards, explanations, alternatives or
checklists. The parent only acknowledges selection of a before-visit plan and
keeps it available in controller state; it never claims stock was verified.
That public integration interface is unchanged by the comparison work.

`useJourneyController({client?, requestId?, initialDraft?})` returns:

- `state`: stable request identity, revision, editable draft, validated current
  criteria, status/error, complete response, comparison, selected verification
  key/plan, field errors and an interaction notice.
- `changeDraft`, `submit`, `clearVerification`.
- `panelProps`: the **unchanged** agreed `RecommendationPanelProps` interface.

The request identity is stable for the mounted session; reload starts a new
stateless session. Editing criteria advances revision, aborts active work and
clears results/comparison/plan. Abort plus a generation guard prevents late
responses from overwriting newer input, including transports that ignore abort.
Retries use only the current identity/revision and clear old snapshot state.
Every new search starts with empty comparison; dataset replacement cannot retain
old selections. Complete responses retain ranking order, provenance, coverage,
warnings and uncertainty metadata.

Callback behavior:

- `onComparisonChange` validates max 10 unique dataset/product/offer identities
  against current results. Invalid or stale selections are rejected.
- `onViewVerification` resolves the existing owning plan by current identity;
  the supplied callback plan is never used as authority.
- `onRetry` ignores old identities/revisions and duplicate in-flight retries.
- `onAcceptAlternative` resolves the current suggestion, validates the canonical
  acceptance shape, request/revision/dataset and every disclosed change, applies
  only the actual changed query/budget/radius, validates the next request,
  advances revision, clears old results/comparison/plan and POSTs a fresh request.
  It neither calls an acceptance endpoint nor claims server-side consent storage.
  Setayesh's UI must display all changes and obtain explicit consent before
  invoking the callback. The callback payload cannot prove a user interaction.

## Comparison view and shell navigation

`src/journey/comparison/ComparisonView.tsx` is the owned, controlled comparison
view. It receives the controller's current response/status/selections and
`onComparisonChange`. It has no comparison store, cached offer snapshot, ranking,
API requests, or new selection limit. Removal goes through the existing controller
and `validComparison` validation (max 10 unique current identities).

`responseEntries` in `src/journey/operations.ts` now also returns each owning
`RecommendationResult` and `source` (`original` or `alternative`) alongside its
existing key and verification plan. Comparison resolves the full
`dataset_id/product_id/offer_id` tuple through this shared lookup. Identical titles
never merge offers. Selected column order is preserved. Only current ready
results are rendered; missing identities are explained and never filled with
old or same-title data. Zero and single selections have explicit Persian guidance.

The shell links to `#search` and `#comparison`. `useJourneyView` reads only the URL
fragment; no shopping state is stored there. `JourneyFlow` keeps one controller
and both route subtrees mounted, using `hidden` for the inactive route. Switching
views preserves entered values, current results, selected keys, request/revision
and the mounted Recommendation component. Returning from comparison does not
search again. Changes to criteria and snapshots still invalidate state through
the existing controller. Reload creates a new session as before.

The table shows recorded product identity/brand/model/category, price in toman,
seller identity/address, coordinates, direct distance, declared hours, payment,
warranty, and provenance. Unknown values are explicit. Requested return-window
preferences are never presented as an actual seller return policy; that policy
remains unknown in this schema. No distance is inferred from coordinates and no
travel time is calculated. Hours render only the canonical declared local-time
structure, without calculating whether the shop is open. Unrecognized JSON
structures remain unknown. Sample/synthetic identity and contact warnings,
unconfirmed inventory, limited coverage, and price-change-versus-verification
distinctions remain visible. Alternatives are identified as requiring acceptance;
the comparison does not accept them or reproduce their recommendation UI.

Keyboard navigation focuses the newly visible route. Removal controls include
the offer ID in their accessible names and move focus to a remaining removal
control or the comparison heading. The table lives in a named, focusable scroll
region with visible instructions and contained horizontal scrolling. Its column
sizes adapt at the existing mobile breakpoint; long identities wrap. This CSS
has not been visually verified in a real browser in this session.

## API client and contracts

`src/api/journey.ts` exports `createJourneyClient`, `JourneyClient`, `JourneyResult`
and `JourneyFailure`. Success is the real `JourneyRecommendations` envelope
(`state`, full `result`). Failures distinguish canonical API errors, unavailable
routes, network, cancellation, invalid responses and invalid configuration.
There is no fixture fallback or automatic retry.

Ajv validates unknown responses against generated schemas without coercion,
default insertion or field removal. Request/revision and returned criteria are
associated with the submitted request; exact decimal comparison never rounds
money through floating-point arithmetic. Unstructured responses and exceptions
are hidden. The API client preserves structured canonical errors; the controller
gives the panel reviewed local Persian messages and uses narrowed detail paths
for safe field errors, without displaying backend exception text.

Shared imports remain `src/contracts/index.ts` (from a component directly in the
reserved directory, `../../contracts`). `RecommendationPanelProps` is unchanged.
See [contract documentation](src/contracts/README.md) for nullability, defaults,
money, q/query differences and schema-generation authority.

```sh
npm run contracts:generate
npm run contracts:check
npm run typecheck
```

Generation needs Git, uv and the existing frozen Python environment. It reads
current canonical Recommendation/Catalog models and pending Journey source at
`45cfe9815ebfd78b0423ca321c2f61e51ea7fbdd` through Git objects. Fetch that commit
if it is missing. The source pin remains in `scripts/contract-source.json`.
Fixtures include a post-acceptance response generated through the real owning
acceptance helper and Recommendation service, with temporary synthetic data.

Shared RTL/design imports remain `src/styles/tokens.css` and
`src/styles/global.css` (loaded once in `src/main.tsx`); `index.html` sets
`lang="fa" dir="rtl"`. Use logical spacing and the existing semantic tokens.

## Tests and disposable real HTTP verification

Vitest, React Testing Library, user-event, jest-dom and jsdom retain the shared
setup in `src/test/setup.ts`. HTTP boundary tests mock fetch; the controller
consumer is test-only and lives outside the reserved feature directory.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run contracts:check
```

For live verification, use two terminals. This runs the **actual pending backend
application**, extracted read-only from its pinned Git commit, rather than adding
a route to this frontend or modifying the backend. The sample database lives in
a temporary directory and is removed when the server shuts down.

```sh
# Terminal 1, from frontend/: requires Git, uv and available pinned Git objects
npm run dev:sample-api
```

```powershell
# Terminal 2, from frontend/ (PowerShell)
$env:STORE_SCOUT_LIVE_API = 'http://127.0.0.1:8017'
npm.cmd run test:live
```

For POSIX shells: `STORE_SCOUT_LIVE_API=http://127.0.0.1:8017 npm run test:live`.
Without that environment variable, the live test is skipped. Only run it against
the disposable synthetic sample API; it checks sample identity. Default backend
CORS settings are used unchanged. Ctrl+C stops the sample server and cleans its
temporary data. No existing database is opened or replaced.

## Verified on 2026-10-22

- Clean npm lockfile installation; typecheck, Oxlint, production build and
  contract consistency checks passed on Node 24.21.0 / npm 11.19.0.
- Standard suite after comparison: 50 tests passed, one opt-in live test skipped. Coverage includes
  canonical success/errors, malformed/unavailable routes, exact-money input and
  association, validation, all callbacks, out-of-order responses, cancellation,
  snapshot/dataset invalidation and explicit acceptance followed by a fresh POST.
- Ten new comparison tests cover identical titles with distinct identities,
  controlled removal, unknown/zero values, provenance and synthetic warnings,
  stale offers/dataset replacement, zero/single selections, shell navigation
  preserving controller and component state, keyboard focus, criteria edits,
  loading invalidation and snapshot conflicts.
- Historical parent-flow HTTP verification (not repeated for this comparison
  task): the opt-in live test passed against the actual integration source at
  `45cfe9815ebfd78b0423ca321c2f61e51ea7fbdd`: parent submission, comparison,
  selected verification plan, explicit scripted acceptance/fresh result,
  canonical 422 error and allowed-origin POST preflight. No seller contact or
  inventory verification occurred. This is HTTP verification of that pending
  integration commit, not a claim that main or production has the route.
- Frontend Python scripts passed Ruff lint/format checks. The generated props
  interface and teammate-owned feature directory are untouched.
- The browser inventory exposed no browsers; creating an in-app browser returned
  `Browser is not available: iab`. Real mobile/desktop visual verification remains
  unperformed. jsdom tests and the earlier HTTP test do not establish end-to-end
  browser integration.

## Remaining coordination

Setayesh can mount her published component through `JourneyFlow.Panel` or consume
`useJourneyController().panelProps`. Confirm her actual named/default export
when it appears; do not create another Recommendation implementation. Rendering
the selected plan's checklist remains with her feature UI.

Roham still needs to complete the pending backend stack/application rollout and
confirm the intended API origin. During this task, adapter PR #5 was merged by
its owner into main `e50c25b`. The comparison task's fetch also found API PR #6
merged into main `2e16a88`; application integration PR #7 remains open.
The reviewed integration head is
`a3b94e2f06e51d7f06aa6998e9ff362c527771a3`. Its only differences from our pinned
source are documentation; runtime/model code and API_HANDOFF.md are identical.
The reproducible source pin therefore remains unchanged. Main still lacks the
application route wiring. Reconcile/regenerate contracts after further owning
backend changes land. No backend PR was merged or retargeted by this task. Full dashboard
visuals, maps, seller contact, stock verification and
deployment remain outside this task.
