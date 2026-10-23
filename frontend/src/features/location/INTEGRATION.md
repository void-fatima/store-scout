# Independent recorded shop location — 2026-10-23

Ready for integration in draft [PR #23](https://github.com/void-fatima/store-scout/pull/23).
Application mounting remains pending reconciliation with the conversational frontend session.

## Branch and ownership

- Branch: `feat/ui-recorded-location-map`.
- Base: `feat/ui-product-purchase-review`, draft #20, verified at
  `670f4b043b8c862506a272b9f3d57da86ab5aa57` after fetching origin.
- Ancestry: #20 → #19 (`965b51abf7704fe14e6860e0f9e686b4d3b21512`) → #18
  (`fb3617bab853ae147e5e272eb7c135d6c725d1a9`). No dependency was assumed merged.
- Implementation: `f9f91af`; final tested code/preview checkpoint:
  `ead6c3eb19d26d8462ee8a37d23956bff9c711bd`. The documentation-only commit
  follows that checkpoint; PR #23 records the final full branch SHA.
- Worktree: `C:/Users/FATIMA/GitHub/store-scout-recorded-location`.
- Every tracked change is inside `frontend/src/features/location/`.
  No applicable frontend/ancestor AGENTS.md was found; the unchanged backend
  Recommendation module's instructions are scoped to that module.
- Other worktrees and their running processes were left alone. No shared file,
  application entry point, routing, Journey/controller/state, Recommendation
  component/interface, generated contract, backend, dependency, lockfile, shared
  style/configuration or global README/HANDOFF was edited.

## Export and exact props

Import from `frontend/src/features/location/index.ts`:

```tsx
import { RecordedShopLocation } from '../location'
import type { RecordedShopLocationProps } from '../location'
```

```ts
import type { CatalogContext, OfferCandidate } from '../../contracts'

export interface RecordedShopLocationProps {
  shop: OfferCandidate['shop']
  context: CatalogContext
}
```

The shop is the existing generated `Shop` used by an `OfferCandidate`; no parallel
shop schema is introduced. Context is required, but the canonical empty object or
missing dataset is supported and explicitly labelled as unknown provenance.

Example for a future internal Recommendation consumer, using real existing types:

```tsx
import type { AlternativesResponse } from '../../contracts'
import type { ResponseEntry } from '../../journey/operations'
import { RecordedShopLocation } from '../location'

function CurrentRecordedLocation({ entry, response }: {
  entry: ResponseEntry
  response: AlternativesResponse
}) {
  // Resolve entry against the current response before rendering this component.
  return <RecordedShopLocation
    shop={entry.result.candidate.shop}
    context={response.original.context}
  />
}
```

The component has no fetches, callbacks, local shopping state or focus effects.
It derives everything from current props; replacing the shop immediately replaces
the marker/link, and invalidating coordinates removes the old iframe. The parent
still owns request/revision/dataset/product/offer association and stale-result
gating. Passing an unrelated shop and context is not prevented by this purely
presentational interface.

## Validation, provenance and external behavior

- Both lat/lon must be finite JavaScript numbers within inclusive ±90/±180.
  Zero is valid. Missing, null, partial, strings, NaN, infinities and out-of-range
  values produce explicit unavailable copy with no iframe or position link.
  Recorded address and region remain visible; absent text has labelled fallbacks.
- Exact coordinates are displayed and retained in URLs. Web Mercator cannot
  represent polar latitudes beyond ±85.05112878: retain the valid coordinates and
  external link, explain the projection limitation, and omit the embedded map.
  Viewport bounds are clipped at projection/dateline edges; the marker is never
  moved. This viewport is only a framing choice, not a radius or distance estimate.
- Source kind, limited canonical Tehran coverage, dataset identity/import time
  and context notices are preserved. Known canonical notice codes are translated
  to Persian; other supplied notices render unchanged as safe text. Data import
  time is explicitly separate from place verification.
- Names, address, area and notices are React text. No raw HTML, geocoding or URLs
  supplied by shop text are used. Contacts/website fields are never rendered as
  contact actions. Synthetic contacts and unverified identity remain explicit.
- Only validated numbers enter fixed HTTPS `www.openstreetmap.org` URLs.
  External links use `target="_blank" rel="noopener noreferrer"` and disclose the
  new window. The lazy iframe has a meaningful unique shop title, associated
  instructions, `referrerPolicy="no-referrer"` and a sandbox permitting scripts,
  same-origin provider resources and attribution popups.
- Address, exact coordinates and position link are outside the iframe. Persistent
  fallback copy explains external-service dependence; no iframe load event is
  treated as successful tiles, a verified location or an accurate route.
- The component imports its scoped stylesheet and inherits the host Persian font.
  The host must already load the existing semantic tokens and shared font, as the
  application does. CSS uses logical sizing/spacing, wraps narrow/long content,
  provides visible focus and ≥44px interactive targets, and avoids page-level IDs.

Verified official references before constructing URLs:
[OSM sharing/embedding documentation](https://wiki.openstreetmap.org/wiki/Export#Embeddable_HTML),
[official embed query construction](https://github.com/openstreetmap/openstreetmap-website/blob/master/app/assets/javascripts/leaflet.map.js),
[official sharing iframe construction](https://github.com/openstreetmap/openstreetmap-website/blob/master/app/assets/javascripts/leaflet.share.js).
The implementation uses `/export/embed.html`, bbox in west/south/east/north order,
`layer=mapnik`, and a latitude/longitude marker. OSM attribution remains visible.

## Checks actually executed

From this worktree's `frontend/`, with the existing Node 24/npm tooling:

```powershell
npm.cmd ci
npm.cmd test -- src/features/location/RecordedShopLocation.test.tsx --maxWorkers=2
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:STORE_SCOUT_CHROMIUM = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npx.cmd playwright test --config src/features/location/preview/playwright.config.mjs
```

- Clean install: 128 packages, zero audit vulnerabilities, no lockfile changes.
- Focused unit suite: **25 passed**, no skips. Covers valid/zero/missing/partial/
  invalid/address-only data, hostile text, safe fixed-host URLs, provenance,
  polar/dateline bounds, prop replacement, unique IDs and no success claim on load.
- Typecheck, lint and existing production build: passed. Final lint has no warnings.
  Build remains the existing application build, since application mounting is
  intentionally pending; the new TSX is checked and its preview runs through Vite.
- Isolated browser suite: **6 passed**, no skips, at 1440×1000, 768×1024, 390×844
  and 360×844. Includes keyboard entry/exit through the fixture frame, focus ring,
  details operation, ≥44px targets, contained overflow, long hostile text,
  unavailable/zero/polar states and blocked-frame fallback. Axe WCAG A/AA checks
  report zero violations in the checked fixture states. Initial checks caught
  contrast failures; using the existing darker accent token fixed them.
- Full-range whitespace and ownership-boundary checks pass.
  Stage 3B's full regression, contracts generation, backend/live API and existing
  Journey HTTP tests were not repeated for this isolated component task.

All external requests in browser tests are intercepted with a conspicuously
labelled HTML test frame or aborted. The fixture buttons establish frame keyboard
access, not the behavior/accessibility of the actual OSM map. No automated test
depends on a public tile server. Actual external-map loading, tile availability,
public-map keyboard behavior, physical devices, other browsers and deployed CSP
have **not** been verified. No seller contact, stock, identity, opening status,
route accuracy or technical-use-case verification is implemented.

## Isolated development preview and screenshots

No temporary package, shared configuration or application-entry edit is required:

```powershell
# From frontend/; independent port, never reuse another session's server.
npm.cmd run dev -- --host 127.0.0.1 --port 5187 --strictPort
```

Open `http://127.0.0.1:5187/src/features/location/preview/index.html`.
The preview uses the existing generated sample fixture; its select offers recorded,
zero, partial, invalid, polar and long-text variants. Manual preview normally
requests the real external iframe; automated browser tests intercept it. The owned
Playwright config starts/stops its own port-5187 server with `reuseExistingServer:
false`; an occupied port fails instead of attaching to someone else's process.

Seven final screenshots were visually inspected and copied locally to:
`C:/Users/FATIMA/GitHub/store-scout-recorded-location/frontend/ui-artifacts/location/evidence/`.

- `recorded-location-{desktop,tablet,mobile,narrow}-intercepted.png`
- `recorded-location-unavailable-360.png`
- `recorded-location-long-text-360-intercepted.png`
- `recorded-location-blocked-frame-360.png`

These are ignored local evidence, not tracked product assets. Browser execution
regenerates screenshots in `frontend/ui-artifacts/location/results/`.

## Precise integration step still pending

After reconciling the parallel frontend branches, the integration owner should
mount `RecordedShopLocation` beside the existing recorded visit conditions in
`VerificationContent.tsx` and the valid owning-plan purchase/checklist flows.
Thread the current owning `response.original.context` through internal consumers
where necessary; use the same resolved `entry.result.candidate.shop`. Keep existing
plan guards, pending states, reminder resets and navigation/focus behavior intact.
Avoid duplicating the existing address/coordinate rows. Preserve public panel
contracts and controller ownership, and test the mounted routes and deployed
frame policy separately. This PR does not edit any of those mounting points.
