# StoreScout frontend

React + TypeScript + Vite. All frontend commands run from this directory.
See [HANDOFF.md](HANDOFF.md) for ownership, contract imports, source pins and
remaining integration work.

API configuration: copy `.env.example` to untracked `.env.local` and set
`VITE_API_BASE_URL` to an HTTP(S) backend origin (optionally with a path prefix).
Leave it empty for same-origin `/api/v1/journey/recommendations`. Restart Vite
after changing it. No deployed address or credentials are configured; requests
omit credentials. Cross-origin use requires the backend owner's existing CORS
configuration to allow your frontend origin. An unavailable route is reported
explicitly; the client never substitutes fixtures or mock data.

`src/api/journey.ts` exports `createJourneyClient`, `JourneyClient`,
`JourneyResult`, and `JourneyFailure`. Responses are narrowed using Ajv and the
generated canonical schemas ([Ajv type guards](https://ajv.js.org/guide/typescript.html)).
Canonical errors remain typed; user-facing text comes from a reviewed local
message mapping. Exceptions and unstructured HTTP bodies are never displayed.
Supported runtime: Node 24 LTS, version 24.21.0 or newer within major 24;
npm 11. The lockfile is authoritative. On Windows with restricted PowerShell
execution policy, use `npm.cmd` in place of `npm`.

```sh
cd frontend
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

`npm test` runs Vitest once; `npm run test:watch` watches changes.
Components use React Testing Library, user-event, jest-dom matchers and jsdom.
Shared cleanup/matchers live in `src/test/setup.ts`; tests use explicit Vitest
imports. Type checking includes test files under `src/`.

`index.html` sets Persian language and RTL direction. Import
`src/styles/global.css` once at the app entry point; it imports
`src/styles/tokens.css`. Components use semantic `--color-*`, typography,
spacing, border and radius tokens and logical properties (`margin-inline`,
`padding-block`, `inline-size`). Tahoma provides locally available Persian
typography with no remote font dependency. Focus outlines, a skip link and
reduced-motion rules are shared. The shell reserves `#recommendation-root` for
the future RecommendationPanel; its feature directory is exclusively owned
by Setayesh and is intentionally absent from this foundation.

The parent Journey flow is now wired into the shell. Its form and controller live
in `src/journey/`; mount the future teammate component with
`<JourneyFlow Panel={RecommendationPanel} />`. The controller exposes the existing
`RecommendationPanelProps` without modifying that interface. See the handoff for
the disposable real backend (`npm run dev:sample-api`) and opt-in HTTP test
(`npm run test:live` with `STORE_SCOUT_LIVE_API` set).

Use the shell's **مقایسه** link (`#comparison`) to compare current selected
offers, and `#search` to return without resetting Journey state. The controlled
view is in `src/journey/comparison/`; selection still comes from the existing
controller and future Recommendation panel. Until that component is published,
selection entry is exercised only by a test consumer outside its owned directory.

Tool references: [Vite setup](https://vite.dev/guide/),
[Vitest environments](https://vitest.dev/guide/environment.html), and
[Testing Library setup](https://testing-library.com/docs/react-testing-library/setup/).
# Stage 3A product details

Recommendation cards now link to recorded product specifications, preserving the
selected offer and existing Journey/comparison state. `src/api/productDetail.ts`
exports a read-only Catalog client using the same `VITE_API_BASE_URL` configuration
as Journey. `#product/<dataset>/<product>/<offer>` contains encoded presentation
identity only; the current result and fetched Catalog snapshot must agree.
See the newest [HANDOFF.md](HANDOFF.md) for the stacked draft PRs, full validation
results, screenshot evidence and Stage 3B boundary. Earlier stage notes follow.

---
