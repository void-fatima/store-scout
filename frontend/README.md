# StoreScout frontend

React + TypeScript + Vite. All frontend commands run from this directory.
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

Tool references: [Vite setup](https://vite.dev/guide/),
[Vitest environments](https://vitest.dev/guide/environment.html), and
[Testing Library setup](https://testing-library.com/docs/react-testing-library/setup/).
