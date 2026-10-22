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
