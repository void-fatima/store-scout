# StoreScout integration — 2026-10-23

Main combines the Catalog/Recommendation/Journey backend, BoxAPI client and
persisted intent revisions with the Persian RTL shopping application. Typed search
works independently of conversational interpretation. Conversation creation and
clarification produce a draft; explicit confirmation of that stored revision
precedes execution. Existing result association, explicit alternative acceptance,
comparison, product details and verification plans remain controller-owned.

## Dependency reconciliation

Fresh inspection found #21, #22, #8 and #9 already merged, with their exact heads
present in main. Remaining intended order: #10 → #11 → #12 → #13 → #14 → #15 →
#16 → #17 → #18 → #19 → #20 → #23 → #24 → #25, then the map mounting PR.
Prerequisite #26 repairs a backend integration issue discovered during this run:
Python 3.12/3.13 supply different default HTTP 413/422 phrases. Explicit intent
response descriptions preserve the published OpenAPI and make both checks pass.
Frontend exporter formatting/import order is corrected without changing generated
schemas. Merge commits preserve the complete stacked history; no force-push,
historical rewrite, dependency branch deletion or existing-worktree cleanup occurs.

## Recorded location mounting

`RecordedShopLocation` retains its established `shop` and `context` props. Both
the purchase tab and standalone checklist pass the current resolved candidate's
shop and `response.original.context` through `RecordedVisitConditions`. It checks
the owning plan, shop and dataset identity. Current controller selection and
request/revision guards continue to gate these views; invalidation removes the
old iframe. The component replaces the prior address/region/coordinate rows.
Personal reminders, canonical pending verification states, alternative consent,
tab focus and keyboard navigation are unchanged.

## Executed validation

Windows / Python 3.13.15 / Node 24 / npm 11, frozen lockfiles:

| Check | Result |
| --- | --- |
| `uv run --no-sync pytest tests src/torob/journey/tests src/torob/journey/llm/tests` | 749 passed; one existing Starlette/httpx deprecation warning |
| `uv run --no-sync ruff check --no-cache .` | Passed |
| `uv run --no-sync ruff format --check .` | Passed; 110 Python files at the integrated checkpoint |
| `uv run --no-sync python scripts/export_contracts.py --check` | Passed |
| Python 3.12 isolated contract check | Passed; prerequisite also passes Linux/Windows GitHub CI |
| `npm.cmd ci` | 128 packages installed; audit: 0 vulnerabilities; lockfile unchanged |
| `npm.cmd run typecheck` / `npm.cmd run lint` | Passed |
| `npm.cmd test -- --maxWorkers=2` | 168 passed; 3 opt-in HTTP tests skipped in this default run |
| Opt-in Journey/Catalog and intent HTTP tests | 3 passed; none skipped |
| `npm.cmd run build` | Passed |
| `npm.cmd run contracts:check` / `npm.cmd run intent:check` | Passed; schemas, bindings and fixtures match |
| `npx.cmd playwright test --config playwright.intent.config.ts` | 53 passed; none skipped |
| Isolated location Playwright config | 6 passed; none skipped |

The complete browser suite includes four-width Persian input → ambiguous money
clarification → explicit coordinate edits → stored-revision confirmation → real
Journey HTTP results → product purchase tab → checklist → associated map. It also
covers typed search, comparison, product details, alternatives, explicit fresh
acceptance, pending states, personal-reminder resets, keyboard/focus and errors.
Four widths are 1440, 768, 390 and 360 px. Checked Axe WCAG A/AA states have zero
violations; duplicate-ID, target-size and horizontal-overflow assertions pass.
Desktop purchase and 360px checklist screenshots were visually inspected.

Final HTTP/browser evidence uses this checkout's actual API, temporary synthetic
Catalog/draft databases and `FixtureInterpreter`; no provider configuration or
credentials are loaded. Earlier source-pinned checks are separate historical
evidence. Public map requests are aborted in application tests. Isolated map
tests fulfill a labelled fixture frame or abort it to verify accessible fallback.
These checks do not establish public tile availability, provider extraction
accuracy, real inventory, seller identity, physical-store status, opening hours,
geocoding or route accuracy. No deployment or paid BoxAPI request was performed.

Ignored screenshots/reports remain in `frontend/ui-artifacts/intent/` and
`frontend/ui-artifacts/location/` in the isolated release worktree. Other local
worktrees and prior evidence directories are preserved.

## Run the complete app locally without provider calls

From the repository root, install the frozen Python environment:

```powershell
uv sync --locked
```

Terminal 1, from `frontend/`, starts the current checkout's API on a disposable
sample Catalog with deterministic interpretation (port 8028):

```powershell
npm.cmd ci
npm.cmd run dev:sample-intent-api -- --current-source --port 8028
```

Terminal 2, from `frontend/`:

```powershell
$env:VITE_API_BASE_URL = 'http://127.0.0.1:8028'
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open `http://localhost:5173`. For the fixture conversation, start with
«گوشی سامسونگ تا ۳۰ تومن», clarify with «منظورم ۳۰ میلیون تومان بود», explicitly
enter/acknowledge coordinates and radius, then confirm the current revision.
Only the runner's allowlisted example messages are interpreted. Typed search
uses the real sample Catalog independently. Ctrl+C stops each task-owned server.

For actual provider interpretation, use the normal API server and existing
[intent configuration guide](../src/torob/journey/intent/README.md). Server-side
provider configuration is required; it was not read or exercised during this
integration. Do not put credentials in frontend configuration.

## Reproduce HTTP and browser verification

With Terminal 1 running, from `frontend/`:

```powershell
$env:STORE_SCOUT_INTENT_API = 'http://127.0.0.1:8028'
$env:STORE_SCOUT_LIVE_API = 'http://127.0.0.1:8028'
npm.cmd test -- src/api/intent.live.test.ts src/journey/journey.live.test.tsx --maxWorkers=2
$env:VITE_API_BASE_URL = 'http://127.0.0.1:8028'
$env:STORE_SCOUT_CHROMIUM = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npx.cmd playwright test --config playwright.intent.config.ts
npx.cmd playwright test --config src/features/location/preview/playwright.config.mjs
```

Browser configs own ports 5189/5187 and refuse to reuse another session's server.
Use an available Chromium installation, or omit the executable variable when
Playwright's bundled browser is installed.
