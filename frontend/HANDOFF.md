# UI Stage 2 complete: alternatives, checklist and comparison — 2026-10-23

This section supersedes the previous stage and first-topic status below. Stage 2
is complete and stops here. Only tracked `frontend/` paths changed. Public props,
generated contracts, API client, controller implementation and backend behavior
are unchanged. No dependency upgrade, main merge, force-push or deployment.

## Published stack and verified commits

| Topic | Draft PR / base | Verified commit |
| --- | --- | --- |
| `feat/ui-alternatives-checklist` | [#15](https://github.com/void-fatima/store-scout/pull/15) → `feat/ui-recommendation-experience` / #14 | `5d629dcf2dc7054ed9b1f3e0f270b63ba7c90bf2` (complete first-topic head) |
| `feat/ui-comparison-polish` | [#16](https://github.com/void-fatima/store-scout/pull/16) → `feat/ui-alternatives-checklist` / #15 | `3f069ebcaec09209f225dd6933daad8c5213fc85` (verified implementation checkpoint) |

The second topic adds this final handoff commit after the implementation checkpoint;
its final published head is recorded in PR #16 metadata and the delivery report.
Five meaningful Conventional Commits span both topics: three on #15, two on #16.
All prior PR #8–#14 bases and published ancestry remain intact. The starting origin
head was confirmed at `4ea6034a2368954ab310232dfc5560005173d7d7` and had not advanced.

## Completed flows

- Alternatives retain backend order, identity, explanations and limitations,
  separate from original matches. Review shows current/proposed query, exact
  budget/unit and radius. Native modal acknowledgement is explicit; Escape/cancel
  restore focus and change nothing. Duplicate and stale confirmations are guarded.
  The existing callback/controller owns revision advancement and the fresh request.
  Failure/retry uses accepted criteria and the current revision without old matches.
- Checklist routes select the canonical owning plan through the existing callback
  and controller. A read-only provider exposes that selection without another store.
  Backend questions remain pending; personal reminders are separate and reset on
  request/revision/snapshot/identity changes. Recorded price/change time, declared
  hours, unknown conditions, synthetic contacts and direct distance stay distinct
  from verification, current opening or travel claims. No contact action is enabled.
- The existing controlled comparison table now has clear recorded product/seller
  headers, shared safe media/neutral placeholders, exact prices, prominent price/
  distance rows, explicit unknowns, offer limitations and source warnings. Complete
  identity and selection order remain intact. Zero/single guidance, removal,
  returned selections and the ten-selection maximum work. Opening an alternative's
  review/checklist does not accept it. Narrow tables scroll inside a named keyboard
  region with sticky feature labels. Comparison-to-detail navigation now focuses
  the actual detail heading instead of overriding it with outer-route focus.

## Final checks performed on the complete stack

Windows, Node 24, installed Google Chrome via Playwright:

- `npm ci`: clean installation, zero audit vulnerabilities, lockfile unchanged.
- `npm run typecheck`, `npm run lint`, `npm run build`,
  `npm run contracts:check`: passed. Schemas/bindings/fixtures match the unchanged
  source pin `45cfe9815ebfd78b0423ca321c2f61e51ea7fbdd`.
- `npm test`: 74 passed; one opt-in live test skipped in that standard run.
- Separate `STORE_SCOUT_LIVE_API=http://127.0.0.1:8017 npm run test:live`:
  one passed against the existing disposable synthetic API.
- `npm run test:ui` with the live API environment: all 27 passed, none skipped.
  Five landing/form, nine results/request-state/media, eight alternative/checklist
  and five comparison scenarios, including all existing browser regressions.
- Four browser journeys use actual disposable HTTP without interception: desktop/
  mobile search/results/explanation/comparison, and desktop/mobile alternative
  consent/fresh accepted request/checklist. HTTP 200s, criteria and revision are
  checked. Other scenarios explicitly intercept transport for UI behavior only.
  They do not establish backend ranking, real failures, seller facts or inventory.
- Coverage includes cancel versus consent, exactly one fresh request, failed
  acceptance-request retry, stale controls/plans, same-title identity, retained
  state, comparison-to-checklist focus, removal to zero and eleven-offer stress
  fixtures enforcing the existing ten-selection maximum.
- Rendered layouts were checked at 1440, 768, 390 and 360 pixels. Keyboard Enter/
  Space, native modal containment/Escape, restored focus, table ArrowLeft scrolling
  and 44×44 labelled action targets pass. Axe WCAG A/AA reports zero violations in
  checked states. Page/dialog overflow checks pass; table scrolling stays contained.
- `git diff --check` and the tracked frontend-only boundary check pass. Screenshots
  were opened against Desktop 04/05/06 and Mobile 12/13. Earlier focus issues were
  corrected before the final complete passing browser run.

Reproduction commands are in the first-topic section below. Let Playwright start
Vite with `VITE_API_BASE_URL=http://127.0.0.1:8017` and set `STORE_SCOUT_LIVE_API`
to the same disposable API. Pages use `http://localhost:5173` for existing CORS.
Without the opt-in variable, HTTP tests skip; those runs are not HTTP verification.

## Final screenshot evidence

Untracked copies are preserved at
`C:/Users/FATIMA/GitHub/store-scout-ui-stage2/frontend/ui-artifacts/evidence/`:

- `stage2-live-{alternatives,checklist}-{desktop,mobile}.png`: actual HTTP.
- `stage2-{alternatives,review,consent,checklist}-{desktop,tablet,mobile,narrow}.png`:
  intercepted canonical UI scenarios.
- `stage2-comparison-{desktop,tablet,mobile,narrow}.png` and
  `stage2-comparison-{single,empty}-{desktop,tablet,mobile,narrow}.png`:
  intercepted comparison scenarios.

The complete browser run regenerates originals in `frontend/ui-artifacts/results/`
and the report in `frontend/ui-artifacts/report/`. References/reports/screenshots
are not committed application assets. Production copies no sample phone photos,
ratings or invented offers.

## Remaining limitations and next approved stage

No physical-device, Safari, Firefox or deployed-backend verification was performed.
Seller contact, live inventory and route/travel estimates remain unsupported.

Next, separately scoped: «مشخصات کالا»، «تناسب با نیاز من»، «قبل از خرید بررسی کن».
Use recorded specifications and backend-supported explanations, preserve explicit
unknowns, and do not invent suitability scores. This product-detail feature is
approved for a future stage and is not implemented in Stage 2.

---
# UI Stage 2: alternatives and before-visit checklist — 2026-10-23

This section supersedes the previous stage's deferred-screen notes. This first
topic implements Desktop 05/06 and Mobile 12/13 from the supplied archive.
Comparison polish follows on a separate stacked topic. Authorization covers all
frontend paths. Public panel props, API client, generated contracts, controller,
ranking and acceptance behavior remain unchanged.

## History and dependency

Verified clean Stage 1/results head and origin at
`4ea6034a2368954ab310232dfc5560005173d7d7` (`feat/ui-recommendation-experience`,
draft PR #14). Fresh origin refs had no newer feature implementation. Read the
current handoff and applicable instruction locations; there are no frontend or
ancestor AGENTS.md files. Existing PR #8–#14 bases were verified through GitHub.

Isolated worktree: `C:/Users/FATIMA/GitHub/store-scout-ui-stage2`.
Branch: `feat/ui-alternatives-checklist`, targeting `feat/ui-recommendation-experience`.
Three coherent commits: alternatives with tests, checklist with tests, and browser
verification/focus fixes/handoff. Only tracked `frontend/` paths change. No
main merge, rebase, force-push, dependency upgrade or deployment.

## Alternatives and explicit acceptance

Original results and alternatives remain separate. `#alternatives` lists backend
suggestions in their returned order. `#alternative/<dataset>/<product>/<offer>`
resolves a current alternative independently of original-only explanation lookup.
Each review shows original/proposed query, exact budget and currency, and radius;
changed and unchanged fields are explicit. Backend explanation, reasons,
limitations and complete canonical identities are retained.

A native modal reviews these values again. Its initial focus is the heading;
Escape/cancel restore the triggering control without changing criteria or results.
Confirmation requires an acknowledgement and calls the unchanged callback with
request ID, expected revision, dataset ID, offer ID and all canonical changes.
A synchronous guard prevents duplicate confirmation. Review state is bound to
the request/revision/snapshot and is discarded when context changes. The existing
controller advances revision, clears old results/comparison/plan and POSTs fresh
criteria. A failed fresh request retries the accepted criteria and same revision;
it does not re-accept the old suggestion or display old matches.

## Canonical checklist and personal reminders

`#checklist/<dataset>/<product>/<offer>` supports current original and alternative
offers. Resolving that route invokes the real `onViewVerification` callback once
per route/request context. `JourneyFlow` exposes its existing selected plan via a
read-only React context; no second verification or selection store exists. The
production screen only displays that controller-selected owning plan. Standalone
panel consumers can display the owning response plan through the unchanged props.
Missing plans and stale identities have explicit return paths.

All backend questions, evidence paths and warnings remain available. Local checks
are labelled personal reminders, never canonical verification; every question
remains pending. Reminders reset on request, revision, plan/snapshot or identity
changes and when leaving the checklist. The screen distinguishes recorded price,
last price change, unconfirmed stock, declared hours, unknown conditions, synthetic
contacts and direct distance. No call, navigation estimate or stock verification
is performed. No contact action is enabled for synthetic information.

## Verification and evidence

- Clean `npm ci`: passed; zero audit vulnerabilities, lockfile unchanged.
- `npm run typecheck`, `npm run lint`, `npm run build`,
  `npm run contracts:check`, `git diff --check`: passed.
- `npm test`: 72 passed, one opt-in live test skipped.
- Separate disposable API `npm run test:live`: one passed.
- `npm run test:ui -- stage2.browser.ts`: eight passed. Four viewport journeys
  at 1440x900, 768x1024, 390x844 and 360x844 cover alternatives, dialog cancellation,
  keyboard/focus restoration, controller checklist, personal reminders and comparing
  an unaccepted alternative. Two intercepted desktop/mobile journeys cover exactly
  one fresh request, failure, accepted-criteria retry and revision invalidation.
  Two desktop/mobile journeys use real disposable HTTP for consent/fresh results
  and controller-selected checklist, with no route interception.
- Existing landing/results browser scenarios also passed in the full browser run;
  that run identified checklist focus replacement while the canonical selection
  arrived. The final focused rerun includes the correction. The complete stack is
  checked again with comparison polish. No skipped check is counted as passed.
- Axe WCAG A/AA scans on alternatives, native dialog and checklist report zero
  violations at all four sizes. No page overflow or dialog-content overflow in
  checked states; labelled reminder/link targets are at least 44×44.

Actual HTTP uses the unchanged disposable helper, source pin
`45cfe9815ebfd78b0423ca321c2f61e51ea7fbdd`. The two live browser journeys start with
180,000,000 IRR, query «گوشی سامسونگ», coordinates 35.7/51.4 and radius 5. They
receive two real HTTP 200 responses, with revision advanced once and returned
criteria equal to the selected backend proposal. No seller contact occurs.
Other scenarios explicitly intercept the transport and are UI evidence only.

Reproduce from `frontend/` in two terminals:

```powershell
npm.cmd run dev:sample-api
```

```powershell
$env:VITE_API_BASE_URL = 'http://127.0.0.1:8017'
$env:STORE_SCOUT_LIVE_API = 'http://127.0.0.1:8017'
$env:STORE_SCOUT_CHROMIUM = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm.cmd run test:live
npm.cmd run test:ui
```

Let Playwright start Vite, using `http://localhost:5173` for existing CORS.
Stop any earlier Vite before changing API environment. Without the live API
variable the opt-in HTTP tests skip. All other checks remain independent.

Screenshots were opened against the reference layouts and preserved, untracked,
at `frontend/ui-artifacts/evidence/` in this worktree:
`stage2-{alternatives,review,consent,checklist}-{desktop,tablet,mobile,narrow}.png`
are intercepted scenarios; `stage2-live-{alternatives,checklist}-{desktop,mobile}.png`
are actual HTTP. Tests regenerate originals in `ui-artifacts/results/`.
Mobile questions precede the longer recorded-location details; exact long amounts
stack at the narrow breakpoint. Chromium viewport testing only; no physical
devices, Firefox, Safari or deployed backend was tested.

## Next topics

`feat/ui-comparison-polish` will be based on this completed topic and preserve the
existing table's controlled selection, identity and scroll behavior.

The next separately scoped product-detail stage is approved as:
«مشخصات کالا»، «تناسب با نیاز من»، «قبل از خرید بررسی کن».
It must use recorded specifications and backend-supported explanations, with
explicit unknowns and no fabricated suitability scores. It is not implemented here.

---
# Recommendation experience handoff — 2026-10-23

This section supersedes historical ownership and unmounted-feature notes below.
The current user request authorizes all frontend paths, including
`src/features/recommendation/**`. This delivery implements Desktop 02/03/07/08/09
and Mobile 11 from the existing design archive and stops at this stage.

## Branch and integration

- Branch: `feat/ui-recommendation-experience`, stacked on `feat/ui-shell-search`
  at `7d786ed3f10b83c8a2ec134615f3daed4dcc07f6` (draft PR #13).
- Preserved existing planning commit `51280d8` and reused the partial uncommitted
  cards, provenance, media, presentation and icon work in this worktree.
  Five Conventional Commits include that planning commit. All tracked changes
  stay under `frontend/`; prior PR bases and published history are preserved.
- `App` mounts `RecommendationPanel` through the unchanged `JourneyFlow.Panel`
  boundary. `RecommendationPanelProps`, generated contracts, API client,
  controller implementation, operations and comparison view are unchanged.
- The one existing controller still owns response identity, revision, abort/stale
  guards, comparison validation (up to 10) and snapshot invalidation. Cards send
  complete dataset/product/offer tuples through `onComparisonChange`. Header,
  tray and comparison table read that same state. No second selection store.
- Fresh fetch found main `e105558` and no newer compatible frontend feature.
  The reviewed contract source pin remains
  `45cfe9815ebfd78b0423ca321c2f61e51ea7fbdd`; consistency checks pass.

## Results and explanations

Original recommendations render in backend array order. Suggestions are never
relabelled as matching original criteria. Cards show recorded product/seller,
location, direct distance, price, last price-change time and unconfirmed stock.
Budget strings use exact decimal formatting with no monetary float conversion;
recorded numeric offer prices receive no additional fractional rounding. Unknown
prices stay unknown and zero stays zero. Only canonical product image URLs may
load; missing, unsupported or failed media uses a neutral package illustration.

`#explanation/<dataset>/<product>/<offer>` encodes the complete identity and
resolves only against the current original result. Invalid/stale identities show
a current-data message. Backend reasons and data limitations appear verbatim;
no browser ranking or model-match guarantees are added. A disclosure includes
recorded address, IDs, payment, warranty, declared hours and explicit unknown
return policy. It never infers current opening, inventory or travel time.
Source provenance, coverage and all returned notices/warnings remain available.
Synthetic/unverified identities, limited coverage, recorded-price uncertainty and
unconfirmed stock also appear outside the source disclosure.

Desktop uses three cards, tablet two columns and mobile one. On mobile, ready
results replace the large form/hero with current criteria and a working edit
button. `#edit-search` reveals/focuses the same mounted form; submitted searches
return to results. Explanation hides search controls without clearing them.
Browser Back restores the owning result-action focus. Search/comparison routes
stay mounted. Error/retry retains criteria and uses the current request/revision;
loading/idle/error never show old cards or selection controls. No fixture fallback.

## Verification performed

After a clean `npm ci` (zero audit vulnerabilities), on Windows with Node 24 and
Google Chrome driven by Playwright:

- `npm run typecheck`, `npm run lint`, `npm run build`,
  `npm run contracts:check`: passed. Generated files and source pin unchanged.
- `npm test`: 62 passed; one opt-in live test skipped.
- Separate `STORE_SCOUT_LIVE_API=http://127.0.0.1:8017 npm run test:live`:
  one passed against the actual disposable synthetic API. Covers parent submit,
  canonical acceptance/fresh POST, selection, verification-plan state, canonical
  422 and allowed-origin preflight. Scripted test acceptance is not UI consent.
- `npm run test:ui` with both API environment variables below: 14 passed.
  Five existing landing/form tests; four rendered results/explanation journeys
  at 1440x900, 768x1024, 390x844 and 360x844; two desktop/mobile state journeys;
  two real HTTP browser journeys; one long-record/unknown-price/broken-media case.
- Keyboard Space selects the actual checkbox; Enter opens reasons/explanation;
  Back restores the owning result action; comparison removal updates cards;
  editing preserves exact criteria and invalidates old results/selections.
  No page-level horizontal overflow in checked results, expanded reasons,
  explanation or loading/error/empty states. Long identities and text also wrap.
- WCAG A/AA axe scans report zero violations for results/explanation at all four
  sizes, loading/error/empty at desktop/mobile, and existing landing/preferences.
  The initial state scan found edit/retry contrast; token-based colors were
  corrected before the final passing run.
- `git diff --check` and the tracked frontend-only boundary check passed.
  Rendered desktop/mobile results, explanation and states were opened for visual QA.

### Actual HTTP versus intercepted browser evidence

The two `disposable API real browser` tests issue actual browser POSTs to
`http://127.0.0.1:8017`, receive HTTP 200, render the sample API's three original
offers, open their real reasons and carry selection into comparison without
another request. No route interception is installed in those tests.

The other browser request scenarios explicitly intercept the transport. The
three-card fixture scenario duplicates canonical facts with distinct offer IDs to
check ordering/identity/layout. Loading, service failure, retry, empty, long text,
null prices and broken image scenarios are deterministic UI checks, not evidence
of a live service failure, real seller data or backend ranking behavior.

### Reproduce

```powershell
# Terminal 1, frontend/: actual existing disposable API helper
npm.cmd run dev:sample-api

# Terminal 2, frontend/: let Playwright start Vite with the intended API origin
$env:VITE_API_BASE_URL = 'http://127.0.0.1:8017'
$env:STORE_SCOUT_LIVE_API = 'http://127.0.0.1:8017'
$env:STORE_SCOUT_CHROMIUM = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm.cmd run test:live
npm.cmd run test:ui
```

Browser pages use `http://localhost:5173`, matching the backend's existing CORS
origin. Stop any previously started Vite before changing its API environment.
Omit `STORE_SCOUT_CHROMIUM` after `npx playwright install chromium` if preferred.
Without `STORE_SCOUT_LIVE_API`, the two browser HTTP tests and opt-in unit HTTP
test skip. API base configuration remains the existing `VITE_API_BASE_URL`.

### Screenshots

Final screenshots are local, gitignored, and preserved in
`frontend/ui-artifacts/evidence/` in the current worktree:

- `stage-live-http-results-{desktop,mobile}.png` and
  `stage-live-http-explanation-{desktop,mobile}.png`: actual disposable HTTP.
- `stage-results-{desktop,tablet,mobile,narrow}.png` and
  `stage-explanation-{desktop,tablet,mobile,narrow}.png`: intercepted UI scenarios.
- `stage-{loading,error,empty}-{desktop,mobile}.png`: intercepted UI scenarios.

Absolute directory:
`C:/Users/FATIMA/GitHub/store-scout-ui-complete/frontend/ui-artifacts/evidence/`.
`npm run test:ui` regenerates screenshots under `ui-artifacts/results/` and HTML
reports under `ui-artifacts/report/`. Reference screens remain outside tracked
source. The design package's example phones/ratings/offers were not copied into
production data.

## Remaining Stage 2 work

- Alternatives presentation with all original/proposed changes and explicit
  acceptance through the existing callback/fresh request.
- Canonical before-visit checklist presentation through the existing controller
  callback; any local reminder state must preserve canonical pending/unverified
  states and synthetic-contact policy.
- Final comparison visual styling, retaining its controlled state and semantics.

These are intentionally absent from this stage's controls. No seller contact,
stock verification, deployment, main merge or history rewrite was performed.
Chromium desktop/mobile viewports were tested; physical devices, Safari and
Firefox were not tested.

---
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
# Stage 3A complete: recorded product details — 2026-10-23

This section supersedes the product-detail deferral below. Recommendation cards
now open «مشخصات کالا» for a current original or unaccepted-alternative offer.
The existing Persian RTL tokens, Vazirmatn, ProductVisual, exact price formatting,
source/provenance and controlled comparison are reused. Only tracked `frontend/`
paths change. Backend, Journey request contracts, RecommendationPanelProps,
controller implementation, dependency lockfile and reviewed source pin are unchanged.

## Verified starting point and delivery stack

Fetched origin first; inspected working trees, worktrees, remote refs and GitHub
dependencies. PR #16 remains open/draft at the expected compatible
`3991c09190d779f1fec56717a3b81c9da81cadbd`, based on #15. No stack merges were
assumed and no tracked branch needed fast-forwarding. No frontend or ancestor
AGENTS.md applies. The existing clean `store-scout-product-details` worktree was
already at that base. The supplied archive contains PNG references, not additional
implementation instructions; the user's pasted Stage 3A request defines scope.

| Topic | Draft PR / base | Verified implementation SHA |
| --- | --- | --- |
| `feat/frontend-product-detail-client` | [#17](https://github.com/void-fatima/store-scout/pull/17) → `feat/ui-comparison-polish` / #16 | `4cb66289a1074bdc5d8569569e6f12fa5c27d691` |
| `feat/ui-product-details` | [#18](https://github.com/void-fatima/store-scout/pull/18) → `feat/frontend-product-detail-client` / #17 | `1d8817ac8249e7ed728e63a8afb94188ec72a91b` |

The UI tip adds the final documentation commit after this tested implementation
checkpoint; final published tip is available in PR #18 metadata and the delivery
report. Four meaningful Conventional Commits span the two topics: canonical
client/contracts with tests, detail UI with tests, responsive/live regression
coverage and fixes, then documentation. Existing #8–#16 dependencies are intact.
No merge, force-push, published-history rewrite or deployment was performed.

## Data integration and identity safety

Read the canonical Catalog models/router, sample CSV and existing exporter first.
`ProductDetail`/`Product` now come from that exporter, with Ajv runtime validation;
generated files and the sample fixture were regenerated, not hand-edited. The
Journey pin stays `45cfe9815ebfd78b0423ca321c2f61e51ea7fbdd`.
The small GET client shares API origin validation/error types and omits credentials.
IDs are encoded as a URL segment. It rejects unexpected product IDs, absent dataset
context and mismatched full dataset identity, import timestamp/hash, contract or
currency. Invalid JSON and unsupported top-level specs are explicit failures.

`#product/<dataset>/<product>/<offer>` resolves against current original and
alternative entries. Selected/candidate product and offer identities must agree.
Fetch state remains local to the detail component, bound to request/revision,
tuple, context and owning response. Rendering hides results from a replaced owner
immediately; effect cleanup aborts and invalidates late responses even when a
transport ignores cancellation. Committed-effect scheduling avoids an extra GET
during React development replay. Criteria edits invalidate through the unchanged
controller. Missing/stale tuples show an unavailable state.

Opening details does not call acceptance, verification selection, criteria mutation
or Journey retry/search. Returning restores the owning card action's focus. Browser
back from comparison recognizes the product route and focuses its heading.
Comparison selection/removal stays controlled; return navigation retains criteria.
Revisiting a detail after leaving it may issue a fresh GET; there is no detail cache
or second Journey/comparison store.

## Recorded presentation

Product title, brand, model, category and canonical media/neutral placeholder appear
with a distinct specification surface. Flexible JSON records retain insertion
order, repeated entries, zero, false, recorded units and arbitrary nested fields.
Null, empty strings, arrays and objects are explicit; deeply nested values use
escaped JSON text rather than unbounded indentation. No HTML injection, external
product enrichment, guessed hardware specs or suitability claims are introduced.

A separate selected-offer surface retains the actual seller, recorded price/change
time, warranty, payment, unknown return conditions and declared hours. Unconfirmed
stock, synthetic contacts and limited coverage remain explicit. The existing
canonical checklist is linked; there are no contact or inventory-confirmation
actions and no inactive future tabs. Loading, empty specs, 404, 503, invalid or
incompatible responses and local retry leave the shopping journey available.

## Final verification and reproduction

Windows, Node 24, installed Chrome through existing Playwright infrastructure:

- `npm.cmd ci`: passed, zero audit vulnerabilities; lockfile unchanged.
- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`,
  `npm.cmd run contracts:check`: passed. Lint has no warnings.
- `npm.cmd test`: 90 passed; 2 opt-in HTTP tests skipped in this standard run.
- Separate `STORE_SCOUT_LIVE_API=http://127.0.0.1:8017 npm.cmd run test:live`:
  2 passed. Actual GETs for original/alternative products return the sample specs
  and matching dataset context; actual unknown-product GETs return 404.
- Full `npm.cmd run test:ui` with live API variables: **35 passed, none skipped**,
  including all 27 existing browser regressions and 8 Stage 3A scenarios.
- Six browser journeys use actual disposable HTTP without interception: four
  existing search/acceptance/checklist journeys plus new desktop/mobile detail
  journeys. The new journeys GET both an unaccepted alternative and an original
  offer (HTTP 200), assert returned sample specs, and show that opening details
  itself performs no fresh recommendation POST or acceptance.
- Other browser scenarios explicitly intercept transport: nested/escaped/long
  records, repeat/zero/false values, failure/retry/empty, dataset mismatch, delayed
  product switching and criteria edits. One navigation scenario combines existing
  canonical entries only to exercise both result sources; it proves no ranking or
  constraint-satisfaction behavior. Interception is UI evidence, not HTTP evidence.
- Checked screenshots at 1440×900, 768×1024, 390×844 and 360×844; keyboard
  Enter/Space, restored return focus, selected-offer identity, comparison retention,
  labelled 44×44 targets and contained overflow pass. Axe WCAG A/AA reports zero
  violations in checked detail states. Browser checks exposed and fixed white-
  background placeholder/link contrast and the product-route return allowlist.
- Existing backend regression `uv run --frozen pytest`: **368 passed**; one
  Starlette/httpx deprecation warning from installed dependencies. No backend edit.
- Final `git diff --check`, clean-tree and frontend-only boundary checks pass.

From `frontend/`, start the disposable sample API in one terminal:

```powershell
npm.cmd run dev:sample-api
```

In another terminal, let Playwright start Vite with the matching API origin:

```powershell
$env:VITE_API_BASE_URL = 'http://127.0.0.1:8017'
$env:STORE_SCOUT_LIVE_API = 'http://127.0.0.1:8017'
$env:STORE_SCOUT_CHROMIUM = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm.cmd run test:live
npm.cmd run test:ui
```

Use `http://localhost:5173` for the existing CORS configuration. Without the live
variable, opt-in HTTP tests skip; that does not count as HTTP verification.

## Preserved screenshot evidence and limitations

Untracked evidence in this worktree:
`C:/Users/FATIMA/GitHub/store-scout-product-details/frontend/ui-artifacts/evidence/`.

- `stage3a-product-{desktop,tablet,mobile,narrow}.png`: intercepted recorded-JSON
  presentation and controlled selection at all four widths.
- `stage3a-{loading-desktop,not-found-mobile,empty-mobile}.png`: intercepted states.
- `stage3a-live-{alternative,original}-{desktop,mobile}.png`: actual sample HTTP.

The full browser run regenerates originals under `ui-artifacts/results/` and the
HTML report under `ui-artifacts/report/`. Evidence is not production media.
Only synthetic sample records were fetched; sample specs describe the recorded
synthetic data, not verified physical-device specifications. No physical-device,
Safari, Firefox, deployed-backend or broad real-dataset verification was performed.

Next task, **Stage 3B**: «تناسب با نیاز من» using backend-supported explanations,
and «قبل از خرید بررسی کن» reusing the canonical verification flow. No invented
suitability scores or duplicate ranking logic. These are not completed by Stage 3A.

---
