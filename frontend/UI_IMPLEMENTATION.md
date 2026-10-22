# Complete frontend implementation — 2026-10-23

## Updated authorization and scope

The user explicitly authorizes all frontend implementation, including
src/features/recommendation/**. This supersedes Stage 1's task-specific exclusive
ownership and waiting notes. Backend services, wiring, contracts and all paths
outside frontend/ remain outside ownership. No compatible published feature
implementation exists in the freshly fetched refs. Every existing worktree was
clean; preserve all published history and the PR #8–#13 dependency chain.

Base: 7d786ed3f10b83c8a2ec134615f3daed4dcc07f6, PR #13.
First topic: feat/ui-recommendation-experience. Completion/verification will
stack on it. Main remains e105558 with PR #7 merged. Its runtime Python source
matches the existing contract pin; no regeneration/source change is needed.

## Visual and contract adaptations

All desktop 01–09 and mobile 10–13 images were opened. Keep the existing warm
canvas, Persian typography, horizontal header, native hero/search and pastel
surfaces. Results use ordered three-column desktop cards and stacked mobile
cards, with a navy controlled comparison tray. Explanation and alternative
views pair the current offer with reasons/constraint changes. Checklist uses
canonical pending questions. Comparison retains its scrollable native table.

Images come only from the matched product's image_urls; absent/broken images
use a neutral package illustration, never the example phone. Canonical reasons,
limitations, diagnoses, warnings, provenance and coverage are displayed. Budget
strings are formatted exactly without numeric monetary conversion. No browser
ranking, invented policies, generated explanations or assumed stock.

Presentation routes store only view/key in URL fragments; current response
resolves every key. Browser Back, focus restoration and response invalidation
must work without another request/comparison store. Acceptance requires explicit
consent to all returned changes before the existing parent callback/fresh POST.
Checklist marks are local reminders only; all canonical states stay pending.

## Ordered implementation checkpoints

A. Production RecommendationPanel, safe media, original order, canonical reasons,
provenance and controlled selections; explanation navigation.
B. Returned alternatives with complete original/proposed criteria and explicit
acceptance; canonical before-visit checklist through the existing callback.
C. Reference comparison, persistent navigation and production request states.
D. Clean install, unit/contracts/build checks, actual disposable API HTTP and
browser journey, deterministic intercepted edge states, all viewport screenshots,
accessibility and final source/run handoff. Continue through completion.

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
