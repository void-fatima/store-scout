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

`SearchLocationPicker` makes explicit map selection the primary center input.
Click/tap a point, or focus the map with Tab, pan with arrow keys, zoom with +/−,
and press Enter/Space (or the labelled center button) to select the viewport's
center. The initial Tehran viewport is never a selection. One marker represents
the candidate. Opening, panning, zooming, cancelling or Escape never calls the
editor's change handler. This is an inline disclosure with ordinary Tab navigation,
not a modal/focus trap; closing returns focus to its trigger.

Only «تأیید این مکان» changes unsaved editor state. Only the existing editor submit
sends a single canonical `IntentPatch` through `useConversation.revise`, including
`coordinates: { latitude, longitude, for_location }`. The exact applicable retained
location label is bound at confirmation. Editing that label invalidates the binding,
even if reverted: reconfirm the existing point or choose another. Saving without
reconfirmation explicitly clears the old coordinates, with a visible explanation.
Radius and all other criteria remain independent; overall revision consent must be
renewed before recommendations. The existing stale-response/revision guards remain.

Manual coordinate entry is a collapsed advanced/accessibility fallback inside the
picker, with Persian/Arabic digit support, finite-pair/bounds validation and zero
allowed. Tile errors, initialization failure and a 12-second loading timeout explain
the fallback. Existing out-of-area points are retained; only the *viewport* clamps
polar latitudes to the basemap's projection, with an explicit projection notice.
No address is inferred, geocoding/geolocation invoked, or radius/center invented.
There is no automatic search/confirmation or circle/routing computation.

Leaflet 1.9.4 is used directly with bundled CSS, `@types/leaflet` and its GeoJSON
types; no React wrapper. Every exploration session creates/removes its own map;
cleanup also disconnects its ResizeObserver and clears the loading timer. Resizing
or showing a previously hidden parent calls `invalidateSize({ pan: false })`.
No user text enters Leaflet HTML/popups; labels render only as React text.

Official references checked 2026-10-23:
[Leaflet API](https://leafletjs.com/reference.html) (`remove`, `invalidateSize`,
tile events, keyboard) and [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).
The basemap uses the specified HTTPS `tile.openstreetmap.org/{z}/{x}/{y}.png`
endpoint, visible on-map copyright attribution, browser User-Agent, origin Referer
via `strict-origin-when-cross-origin`, normal browser caching and demand-only tiles.
No offline download/prefetch or cache-bypass headers. Hosting must continue to allow
that Referer. Public tiles are best effort; the fallback is usable without them.
The independent, read-only `RecordedShopLocation` and its cross-origin iframe are
unchanged and remain mounted in purchase/checklist flows; no iframe clicks are read.

Canonical intent models are generated separately from immutable PR #22 source;
see `../../contracts/intent/README.md`. Existing Catalog/Recommendation contracts,
the reviewed legacy source pin and existing dependency versions remain unchanged.

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

Browser tests intercept tiles with visibly synthetic TEST TILE images or abort
them; external recorded-map frames remain blocked. This verifies interaction and
failure handling, not live public tiles/geographic coverage. The isolated
`playwright.location-picker.config.ts` owns port 5196 without server reuse; run the
fixture API with `--current-source --port 8036 --frontend-origin http://localhost:5196`
and set the three API variables above to `http://127.0.0.1:8036` to reproduce the
full suite on that config. Playwright failure traces can
contain disposable per-draft capability headers; retain/share only fixture-server
artifacts, never traces of a real/private draft. No provider credentials exist in
the fixture runner.
