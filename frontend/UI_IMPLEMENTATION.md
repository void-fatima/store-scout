# UI Stage 2 implementation — 2026-10-23

The current user request supersedes the deferred alternatives/checklist/comparison
scope below. Delivered on two stacked draft topics: `feat/ui-alternatives-checklist`
(#15) from the verified PR #14 head, then `feat/ui-comparison-polish` (#16) from
the completed first topic. Public interfaces and controller behavior are preserved.
Only frontend source changes; the archive's sample facts remain visual references.
Five meaningful commits span the two topics.

Desktop 05/06 and Mobile 12/13 use the existing palette, cards, tokens, typography
and assets. Alternatives show full current/proposed query, budget/unit and radius,
explicit modal consent and the existing callback/fresh POST. Checklist renders
the existing controller-selected canonical plan, with pending questions and
clearly separate personal reminders. Contact and inventory claims remain
unverified. Comparison polish retains the existing table and controlled state,
adds readable product headers and exact prices, and keeps horizontal scrolling
contained on mobile. No best-choice scores or unsupported facts are introduced.

Final complete verification: 74 standard tests passed (one opt-in HTTP test skipped
in that run), separate live HTTP test passed, all 27 Chromium browser tests passed,
including four actual HTTP browser journeys. Typecheck/lint/build/contracts and
frontend-boundary/whitespace checks pass. Four-size screenshot, keyboard, focus,
touch-target, accessibility and overflow evidence is recorded in HANDOFF.md.

See the newest HANDOFF section for exact checks, screenshot paths and dependency
details. Product details («مشخصات کالا»، «تناسب با نیاز من»، «قبل از خرید بررسی کن»)
remain the next separately scoped stage, using recorded facts/backend explanations
with unknowns and no invented suitability scores.

---
# Recommendation experience stage — 2026-10-23

## Current authorization and delivery scope

The current user request authorizes implementation of all frontend paths,
including `src/features/recommendation/**`. This replaces the historical folder
reservation below. This delivery stops at recommendation results, explanation,
loading, empty and error/retry states: Desktop 02/03/07/08/09 and Mobile 11.
Alternatives, checklist presentation and final comparison styling remain Stage 2.
The archive contains image references only; its illustrated sample facts are not
application data or implementation instructions.

## Base and preserved work

Use the complete Stage 1 history at
`7d786ed3f10b83c8a2ec134615f3daed4dcc07f6` on `feat/ui-shell-search` (PR #13).
The existing `feat/ui-recommendation-experience` worktree contained planning
commit `51280d8`, a modified Icon and six untracked recommendation helper files.
These were inspected, preserved and extended. Their unfinished checklist links
were removed for this stage. Fresh origin refs contain no newer compatible
recommendation implementation. The #8?#13 stack remains unchanged.

## Design and implementation

Opened the supplied desktop results, explanation, empty, error and loading
images and mobile results image. Reuse Stage 1 tokens, warm canvas, coral/navy
palette, self-hosted Vazirmatn, header, hero and icons. Desktop has three ordered
cards, tablet has two columns and mobile stacks cards with compact search context.
The edit action reveals/focuses the existing controlled form, preserving values.
Explanation has the owning offer alongside returned reasons and limitations.
Use native controls and details disclosures, real selected count and a working
comparison link. There are no inactive future-action buttons.

`App` mounts the production panel through `JourneyFlow.Panel`. One existing
controller owns all request data, revision invalidation and comparison state.
Presentation fragments contain only view and encoded canonical identities;
explanations resolve against current original results. Backend order is never
recomputed. Exact budget strings are formatted without monetary float conversion;
recorded numeric prices receive no additional fractional rounding. Null is unknown,
zero is zero. Only recorded product media may load; unavailable media uses a
neutral package illustration. No stock, ratings, images or offers are invented.

## Verification and next stage

See `HANDOFF.md` for checks, actual HTTP versus intercepted scenarios, screenshots,
reproduction commands and Stage 2 boundaries. This implementation changes only
frontend source; generated contracts, API client, controller and backend algorithms
remain unchanged. No merge, deployment or published-history rewrite.

---
# Stage 1 visual implementation

## Design brief (before component edits)

Use the supplied StoreScout desktop 01 and mobile 10 landing screens as the
composition reference: warm ivory canvas, navy Persian type, coral primary
search action, pastel hero artwork, rounded white search surface, fine borders
and three instructional steps. Desktop pairs right-aligned copy with artwork
on the left; mobile puts artwork above centered copy and a stacked form. Keep
all text and controls native. Retain blank initial criteria and explicit units.
Expand only supported payment, warranty and return-window preferences.

## Ownership and screen map

| Surface | Owner / implementation |
| --- | --- |
| Shared tokens, typography, assets | Fatima; src/styles/, public/fonts/, src/assets/ |
| Header, search/comparison navigation, useful guide | Fatima; App.tsx, src/shell/ |
| Landing hero, three steps, limitations | Fatima; src/shell/ |
| Existing criteria form and parent orchestration | Fatima; src/journey/ |
| Existing comparison | Preserve functional view; final redesign deferred |
| Recommendation results, explanations, alternatives, checklist | Setayesh only; src/features/recommendation/** untouched |
| API / generated props | Preserve contracts and controller behavior |
| Backend / CORS / root dependencies | Outside scope; no edits |

## Repository decision

All five existing worktrees were clean. Fresh fetch on 2026-10-22 found no
newer frontend: origin/feat/frontend-comparison-view at
1c276967506e408d1329c43280c917fa47ea3022 is the complete reference.
Stage 1 uses isolated worktree store-scout-ui-shell-search, branch
feat/ui-shell-search, stacked on PR #12. PRs #8–#12 retain their bases.
Main e105558 now includes backend PR #7; this does not replace the frontend
history. Keep the reviewed contract-source pin and check its consistency.

## Reference and asset policy

The archive was opened from the supplied Desktop path and extracted outside
Git to C:/Users/FATIMA/StoreScout-reference. Overview, desktop landing and
mobile landing were opened at full size; other screens inform shared style
only. Reuse only the clean illustration area of mobile 10 (no UI text or
controls), resized/compressed for the hero. Reference screens are not committed.
A small native SVG compass mark and line icons remain code-native assets.
Self-host Vazirmatn with its SIL Open Font License and documented source.

## Verification plan

Run the existing behavioral suite, typecheck, lint, build and contract check.
Use real Chromium via local Playwright to inspect 1440x900, 768x1024, 390x844
and 360px layouts, overflow, disclosure, keyboard navigation and field errors.
Keep actual screenshots outside tracked source and report exact limitations.

## Completed verification

Implemented the desktop 01 and mobile 10 landing screens with shared tokens,
self-hosted Persian typography, native SVG branding/icons, cropped decorative
hero art, live selection count, useful guide navigation and the existing real
controlled form. The controller and contract files are unchanged. App passes
its one controller to JourneyFlow; standalone Panel/client usage remains valid.
All other screens were reviewed directly or in the external contact sheet.

Final checks: 52 standard tests passed (one opt-in test skipped), separate real
sample-API test passed, five Chromium browser tests passed, zero WCAG A/AA axe
violations in initial/expanded states at all four sizes, typecheck/lint/build/
contract consistency passed. The selected payment label was darkened after
contrast testing. See HANDOFF.md for reproducible commands, local screenshot
paths, remaining boundaries and the Persian component handoff.
# Stage 3A: functional recorded product details — 2026-10-23

This supersedes the deferred product-detail status below. The supplied PNG archive
continues to guide the existing visual language; it supplies no product-detail
mockup or application facts. The user's Stage 3A request defines this implementation.

Cards open the current dataset/product/offer detail route for original and
unaccepted-alternative results. The generated canonical Catalog client supplies
recorded specs, with full snapshot checks and local request/revision cancellation.
Responsive Persian RTL surfaces separate product identity/media/specifications
from the selected seller's recorded price, warranty, payment and declared hours.
Flexible JSON remains escaped, repeated and explicit about empty/null values.
Comparison is controlled by the existing parent; return navigation restores focus.
No inactive tabs, suitability scores, contact actions or invented specifications.

Stacked draft PRs: #17 (client) on #16, then #18 (UI) on #17. Public panel props,
Journey request contracts/controller, backend and dependency versions are unchanged.
Final checks: 90 standard tests passed, two separate live tests passed, all 35
browser tests passed, and 368 existing backend regressions passed. Typecheck,
lint/build/contracts/whitespace checks pass. Four-width screenshots and actual
sample HTTP versus intercepted UI evidence are documented in the newest HANDOFF.

Stage 3B remains separate: «تناسب با نیاز من» from backend-supported explanations
and «قبل از خرید بررسی کن» through the canonical verification flow.

---
