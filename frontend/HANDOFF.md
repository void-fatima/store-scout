# Frontend foundation handoff

## Base for component work

Branch from the pushed `feat/frontend-recommendation-contracts` tip. It contains
the complete foundation, contracts and component test setup. Its parent PR targets
`feat/frontend-foundation`; the foundation PR targets `main`. Both are drafts.
The final delivery message supplies the immutable full commit SHA; use that SHA
when creating your own feature branch. No backend PR was merged or retargeted.

```sh
git fetch origin
git switch -c feat/recommendation-panel origin/feat/frontend-recommendation-contracts
cd frontend
npm ci
npm run dev
```

Supported local runtime: Node 24 LTS (>=24.21.0, <25), npm 11. The pinned local
Node version is in `.node-version` and npm version in `package.json`.
Use `npm.cmd` instead of `npm` if PowerShell blocks npm's `.ps1` launcher.
The frontend starts without a backend and does not issue API requests yet.

## Ownership and imports

- Setayesh exclusively owns `src/features/recommendation/**`: recommendation
  cards, ranking explanations, alternatives and before-visit checklists.
  The directory is reserved and no files, including placeholders, were created
  there. Mount the future panel at `#recommendation-root` in `src/App.tsx`.
- Fatima owns frontend tooling, shared styles/contracts, shell, Journey state,
  API calls, filters, comparison and the parent acceptance workflow.
- Roham owns backend app registration, CORS, shared API docs and OpenAPI wiring.

Shared design tokens: `src/styles/tokens.css`. RTL/global rules:
`src/styles/global.css`, imported once by `src/main.tsx`. Document direction and
language are in `index.html` (`lang="fa" dir="rtl"`). Use the semantic CSS
variables, local Persian font stack and logical spacing/sizing properties.
Shared focus outlines, keyboard skip link and reduced-motion rules are included.
The current white/gray shell uses a restrained red accent; dashboard visuals are
deferred.

Stable contract import: `src/contracts/index.ts`. For a component directly in
`src/features/recommendation/`:

```tsx
import type {
  RecommendationPanelProps,
  AlternativesResponse,
  AlternativeAcceptance,
  ComparisonKey,
  FollowupPlan,
} from '../../contracts'
```

The complete agreed props type includes request ID/revision, full nullable
response, selected comparison keys, status/error, and the four callbacks:
`onComparisonChange`, `onViewVerification`, `onRetry`, `onAcceptAlternative`.
Backend models are generated; the props and readonly wrappers are UI-specific.
See [contract details](src/contracts/README.md) for source authority, precise
optional/null/money semantics and all integration constraints.

## Contract generation and checks

The generator reads current canonical Recommendation/Catalog Python models and
pending Journey source at `45cfe9815ebfd78b0423ca321c2f61e51ea7fbdd`
(`feat/journey-app-integration`, PR #7), including its latest API handoff.
No stale hand-authored transport snapshot or duplicate offer model is used.

```sh
# Fetch once from the repository root if these Git objects are missing:
git fetch origin 45cfe9815ebfd78b0423ca321c2f61e51ea7fbdd
cd frontend
npm run contracts:generate
npm run contracts:check
```

Regeneration needs Git and uv; it uses the existing frozen Python lockfile and
temporarily imports pending Journey source without merging it. Normal component
development uses the committed generated types and does not require regeneration.
Review `scripts/contract-source.json` when advancing the pending Journey source.

Important boundaries: HTTP accepts `ShoppingRequest` and returns
`JourneyRecommendations = {state, result}`. Give the panel `result`. Journey
requires coordinates and uses `q`; Recommendation uses `query` and can permit
missing coordinates. Send decimal money as exact strings; response budgets
remain strings and recorded toman prices remain nullable integer numbers.
Error codes are strings; detail values require narrowing from `unknown`.

Explicit acceptance is a local callback, not an HTTP endpoint or server consent
record. Show every change first. The parent must validate request/revision and
dataset, apply only explicitly accepted criteria, advance revision, clear
comparison/results and request a fresh response. Never silently relax criteria,
mix datasets or treat the old relaxed suggestion as a new original result.

## Component testing

Vitest + React Testing Library + user-event + jest-dom run in jsdom. Shared
matchers and after-test cleanup are configured in `src/test/setup.ts` through
`vite.config.ts`. Tests import Vitest APIs explicitly. Typecheck includes tests.

```sh
npm test
npm run test:watch
npm test -- src/test/RecommendationPanelConsumer.test.tsx
npm run typecheck
npm run lint
npm run build
```

Use `src/test/RecommendationPanelConsumer.test.tsx` as a wiring example only.
It tests props and callback payloads and is never mounted by the application.
`src/test/fixtures/contracts.ts` is generated from owning models: canonical
Recommendation examples, validated requests/errors/acceptance, and a real
Journey response from a temporary synthetic sample database. It does not contact
sellers. Add component tests within your owned feature directory.

## Verification on 2026-10-22

- Clean `npm ci`: 118 packages installed; npm reported zero vulnerabilities.
- Typecheck, Oxlint and production build passed on Node 24.21.0 / npm 11.19.0.
- Vitest: 11 passing tests across four files, covering the semantic shell,
  keyboard focus/navigation, RTL document, shared matchers/cleanup, callback
  identities, explicit acceptance, exact money and canonical fixtures.
- Contract consistency check passed. A temporary generated-schema edit was
  correctly rejected; after restoring the exact bytes, the check passed again.
- Frontend Python exporter passed Ruff lint and formatting checks.
- Local development and production preview returned HTTP 200 for the Persian
  RTL HTML and their entry/built assets. Both commands started successfully.
- Browser inventory exposed no browsers and creating an in-app browser reported
  `Browser is not available: iab`. Mobile/desktop visual rendering and real
  browser keyboard behavior were therefore **not verified**. jsdom checks are
  not a visual or browser-layout test.
- All changed files are under `frontend/`; no Recommendation feature or backend
  files changed. No deployment or merge was performed.

## Remaining integration

Setayesh can now build her components against the shared props and fixtures.
Fatima still needs to implement Journey state/API orchestration, filters,
comparison state and the explicit acceptance/retry workflow, then mount the
panel. Backend owners must finish landing the pending Journey stack and shared
application integration before end-to-end HTTP use. Reconcile the pinned source
and regenerate when that lands. Retain ranking order, coverage/provenance and
unconfirmed inventory/price notices; a verification checklist remains a plan.
Full Journey screens, maps, comparison screens, seller contact, stock
verification, dashboard mockups and deployment are outside this delivery.
