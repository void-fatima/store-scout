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

Tool references: [Vite setup](https://vite.dev/guide/),
[Vitest environments](https://vitest.dev/guide/environment.html), and
[Testing Library setup](https://testing-library.com/docs/react-testing-library/setup/).
