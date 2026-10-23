# Persian conversational Journey

`Conversation` is mounted inside a native disclosure in the existing search
controls. The typed search form remains available. Its module is split from the
initial application bundle; the mounted component survives comparison and panel
navigation, as the existing Journey route subtrees do.

The flow is message → canonical draft → clarification/explicit field edits → full
summary and notices → revision-specific consent checkbox/button → server confirm
→ server intent recommendations → existing Journey results. A draft preview is
never POSTed to the legacy recommendation endpoint. Natural-language agreement is
ordinary clarification, not consent. Every edit/refresh removes the UI's consent;
an unsent local edit also blocks confirmation until saved or explicitly discarded.

`useConversation` holds only draft presentation, operation state and the per-draft
capability in memory. No token is placed in storage, links, DOM text or logs.
Reload starts a new conversation. Server expiry/stale/not-found responses remain
explicit; ambiguous network outcomes require a GET refresh. Requests never retry
or repair automatically. Confirm/create/revise/execute races are cancelled or
ignored on reset/unmount. Editing/submitting the typed form during confirmation
changes the Journey operation epoch and prevents the old confirm from executing.

The existing `useJourneyController` owns all recommendation loading/results,
comparison and selected verification. Its internal `submitConfirmedIntent` method
uses the verified persisted draft ID/revision/criteria and an injected execution
function; panel retry reuses that execution function, never the legacy endpoint.
Its generation/abort protection remains active. Explicit acceptance of an owning
alternative continues the established separately reviewed typed-search flow with
fresh criteria/revision. Public `RecommendationPanelProps` is unchanged.

`IntentEditor` sends only fields changed by the user; clearing is an explicit null
or empty preferences list. Unsupported minimum budgets/mandatory preferences are
retained and exposed for deliberate revision, never silently removed. Every scalar
field from the contract can be corrected. Backend raw values, evidence, summary,
notices and questions render as React text; budget normalization and ranking stay
backend-owned. Technical suitability/contact/stock are never asserted.

The center is currently entered as an explicit coordinate pair, with Persian/Arabic
digit support, bounds checks, zero allowed, and a separate user acknowledgment.
There is no geocoding, invented center, default radius, user-location picker or
circle visualization. A retained location label is sent unchanged as
`coordinates.for_location`. Changing the label without replacement coordinates
lets the backend invalidate its previous point. Radius text requires a unit and
is normalized/validated by the backend. The independent recorded-shop map in PR
#23 is untouched and is a separate later integration; it is not a user-center
picker.

Canonical intent models are generated separately from immutable PR #22 source;
see `../../contracts/intent/README.md`. Existing Catalog/Recommendation contracts,
the reviewed legacy source pin and dependency versions remain unchanged.

From `frontend/`:

```powershell
npm.cmd test -- src/api/intent.test.ts src/features/conversation --maxWorkers=2
npm.cmd run intent:check
npm.cmd run dev:sample-intent-api
# Separate terminal; this is fixture interpretation, actual local HTTP/Catalog.
$env:VITE_API_BASE_URL = 'http://127.0.0.1:8018'
$env:STORE_SCOUT_INTENT_API = 'http://127.0.0.1:8018'
$env:STORE_SCOUT_LIVE_API = 'http://127.0.0.1:8018'
$env:STORE_SCOUT_CHROMIUM = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm.cmd test -- src/api/intent.live.test.ts src/journey/journey.live.test.tsx --maxWorkers=2
npx.cmd playwright test --config playwright.intent.config.ts
```

The separate config owns Vite port 5189 and refuses to attach to an existing
server. The disposable API owns port 8018 and temporary Catalog/draft databases;
Ctrl+C stops it and cleans them up. Fixture messages are explicitly allowlisted
in `scripts/pinned_intent.py`. The new HTTP checks require a loopback origin and
the runner's fixture marker before submitting text. They never read provider
configuration or access credentials. These fixtures do not evaluate model quality.

Browser tests block all external assets and do not mount the map. Future map
integration tests must intercept external frames. Playwright failure traces can
contain disposable per-draft capability headers; retain/share only fixture-server
artifacts, never traces of a real/private draft. No provider credentials exist in
the fixture runner.
