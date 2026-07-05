# Issue #685 Verification Evidence

Date: 2026-07-05
Branch: `spike/685-verify-heroui-pilot-impact`

## Scope

- Verified the merged Equipments HeroUI pilot from #684 against the #679 baseline.
- Kept HeroUI scoped to `src/components/equipment/heroui-pilot/`.
- Fixed the Equipments command filter hover label contrast by using primary text on hover.
- Did not migrate additional shadcn code and did not remove dead shadcn code.

## Verification Results

| Check                                                         | Result                     | Evidence                                                                                                                                                                   |
| ------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/npm-run.js run format:check`                    | Failed, baseline unrelated | Existing repo-wide Prettier warnings outside this diff.                                                                                                                    |
| Changed-file Prettier check                                   | Passed                     | `prettier --check --ignore-unknown src/components/shared/table-filters/FacetedMultiSelectFilter.tsx src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx` |
| `node scripts/npm-run.js run verify:heroui-boundary`          | Passed                     | No HeroUI imports found outside the approved Equipments pilot boundary.                                                                                                    |
| `node scripts/npm-run.js run verify:no-explicit-any`          | Passed                     | No explicit `any` found in changed TypeScript files.                                                                                                                       |
| `node scripts/npm-run.js run verify:dedupe`                   | Passed                     | No SonarJS duplicate-code findings in changed JS/TS files.                                                                                                                 |
| `node scripts/npm-run.js run typecheck`                       | Passed                     | `tsc --noEmit` exited successfully.                                                                                                                                        |
| Focused Equipments toolbar tests                              | Passed                     | 2 files, 18 tests passed.                                                                                                                                                  |
| `node scripts/npm-run.js run react-doctor`                    | Passed                     | React Doctor diff scan found no issues, score 100/100.                                                                                                                     |
| `NEXT_TELEMETRY_DISABLED=1 node scripts/npm-run.js run build` | Passed                     | Next build compiled successfully.                                                                                                                                          |

Regression proof for the hover label fix:

- RED: `equipment-toolbar.filters.test.tsx` failed on missing `hover:text-primary`.
- GREEN: same focused test passed after adding `hover:text-primary` to command filter triggers.

## Screenshots

Baseline from #679:

- Desktop list: `/root/images/screenshots/equipment-desktop-list.png`
- Desktop detail dialog: `/root/images/screenshots/equipment-desktop-detail.png`
- Mobile list: `/root/images/screenshots/equipment-mobile-list.png`
- Mobile detail dialog: `/root/images/screenshots/equipment-mobile-detail.png`
- Desktop controls open: `/root/images/screenshots/equipment-desktop-controls-open.png`

Post-#684 / #685 supplied screenshot:

- `/root/images/Screenshot 2026-07-05 213440.png`

Visual assessment:

- The post-#684 screenshot shows the approved desktop top-controls slice only: HeroUI card shell, search row, five command filter triggers, and desktop action buttons.
- Data table, department chips, nav, and row actions remain outside the pilot scope.
- The #685 hover contrast fix changes command filter trigger hover text to primary color for readable labels on the muted hover background.

## CSS And Bundle Delta

Baseline from #679:

- `/equipment` route: `61.8 kB`; First Load JS: `310 kB`.
- CSS assets: 3 files, `122.6 kB` raw / `22.2 kB` gzip.
- Largest CSS asset: `115.9 kB` raw / `20.3 kB` gzip.
- Equipment app manifest JS assets: 30 files, `1029.7 kB` raw / `302.7 kB` gzip.
- Own Equipment page chunk: `224.0 kB` raw / `56.9 kB` gzip.

Current after #684 plus #685 hover fix:

- `/equipment` route: `109 kB`; First Load JS: `376 kB`.
- CSS assets: 3 files, `559.4 kB` raw / `62.4 kB` gzip.
- Largest CSS asset: `552.7 kB` raw / `60.5 kB` gzip.
- Equipment app manifest JS assets: 31 files, `1247.2 kB` raw / `367.5 kB` gzip.
- Own Equipment page chunk: `209.4 kB` raw / `52.8 kB` gzip.

Delta:

- `/equipment` route: `+47.2 kB`; First Load JS: `+66 kB`.
- CSS assets: `+436.8 kB` raw / `+40.2 kB` gzip.
- Equipment app manifest JS assets: `+1` file, `+217.5 kB` raw / `+64.8 kB` gzip.
- Own Equipment page chunk: `-14.6 kB` raw / `-4.1 kB` gzip.

## Assessment

Functional gate: pass. The pilot stays inside the approved boundary, focused tests pass, typecheck passes, build passes, and React Doctor reports no changed-file issues.

Visual gate: pass for the approved desktop top-controls slice after the #685 hover label contrast fix.

Bundle/CSS gate: mixed. The own Equipment page chunk is smaller, but First Load JS, route size, Equipment manifest assets, and especially CSS gzip increased materially. This does not justify broad HeroUI adoption yet.

Recommendation: keep the pilot evidence and defer any wider HeroUI proposal until CSS import strategy, tree-shaking, and route-level package cost are understood. Do not promote HeroUI to shared primitives from this result alone.
