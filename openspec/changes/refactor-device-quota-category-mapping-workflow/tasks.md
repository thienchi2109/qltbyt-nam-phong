## Delivery Rules

- Each phase is a separate reviewable PR unless the user explicitly approves combining adjacent phases.
- Every PR must be independently deployable and must preserve all production workflows available before that phase.
- Production UI must not expose an incomplete assignment mode.
- The legacy Mapping tab and route remain available until the unified manual workflow has shipped and passed focused production smoke checks.
- The facility-wide suggestion workflow must remain functional throughout every phase.
- The Phase 1 category-pane layout and long-name behavior are canonical workspace contracts. Later phases must reuse them and keep their regression tests passing rather than replacing them with a second category-tree implementation.
- No phase may add a database migration, RPC, API payload change, generated DB type change, or live database write.

## Phase 0 - Characterization and Regression Baseline

**Purpose:** Lock current behavior before production refactors.

- [ ] 0.1 Add or update page-level tests that characterize the current Categories master-detail behavior.
- [ ] 0.2 Characterize the current Mapping manual-selection, preview-cancel, preview-confirm, success, and error behavior.
- [ ] 0.3 Characterize the current facility-wide suggestion trigger, role behavior, grouped preview, unmatched section, exclusions, retry, and batch apply behavior.
- [ ] 0.4 Preserve the existing `CategoryActionMenu` deferred dropdown-to-dialog regression coverage.
- [ ] 0.5 Characterize the role matrix: equipment-manager access to both current tabs, `regional_leader` Mapping access and preview-only suggestions, and another non-manager Mapping role.
- [ ] 0.6 Characterize parent and leaf categories as valid targets in the current Mapping tree and record the current leaf-only Categories detail presentation.
- [ ] 0.7 Record focused desktop screenshots or equivalent visual baselines for the current Categories and Mapping pages.

**Deploy-safe boundary:** Tests and reference artifacts only; no production behavior changes.

**Exit gate:** Current Categories, Mapping, and suggestion workflows are covered well enough to detect behavioral drift in later phases.

## Phase 1 - Category Pane Readability

**Purpose:** Deliver the long-name readability fix independently before workflow consolidation.

- [ ] 1.1 Add a failing regression test for the new 46% / 54% wide-desktop split contract.
- [ ] 1.2 Add a non-breaking `46-54` split-pane option or Categories-scoped override. Do not redefine the existing shared `40-60` option because both current Categories and Mapping compositions consume it.
- [ ] 1.3 Change the current Categories wide-desktop allocation to approximately 46% category pane and 54% detail pane.
- [ ] 1.4 Give code, classification, usage/progress, and row actions bounded widths while allowing the category name to consume flexible space.
- [ ] 1.5 Preserve two-line category names and add a failing `user-event` test that opens the complete value by pointer hover and keyboard focus.
- [ ] 1.6 Verify wrapping does not overlap indentation, progress data, menus, or adjacent rows.
- [ ] 1.7 Preserve horizontal scrolling and minimum table width in the assigned-equipment pane.
- [ ] 1.8 Verify 1440x900, 1920x1080, narrower desktop, and mobile layouts.

**Deploy-safe boundary:** Existing Categories behavior is unchanged except for layout and full-text readability. Mapping and suggestion workflows are untouched.

**Exit gate:** The panel-width and long-name P0 requirement is production-ready and can ship without waiting for the unified workflow.

## Phase 2 - Route-Agnostic Manual Mapping Components

**Purpose:** Prepare reusable frontend ownership while preserving the existing Mapping page.

- [ ] 2.1 Run code-deduplication discovery before creating or moving shared hooks, utilities, or split-pane components.
- [ ] 2.2 Extract or adapt the unassigned-equipment filters, pagination, page-only selection, and manual preview trigger so they do not depend on Mapping page composition.
- [ ] 2.3 Keep the existing `/device-quota/mapping` page as the active consumer of the refactored components.
- [ ] 2.4 Preserve current query keys, mutation payloads, selection semantics, tenant scope, role behavior, and visible labels.
- [ ] 2.5 Keep new and modified source files below the repository file-size ceilings.
- [ ] 2.6 Prove with existing and focused tests that the Mapping page behaves identically after the refactor.

**Deploy-safe boundary:** Internal frontend refactor only. Both top-level tabs, routes, and user workflows remain unchanged.

**Exit gate:** Manual mapping components can be embedded by another route without copying logic or changing current Mapping behavior.

## Phase 3 - Unified Manual Assignment in Categories

**Purpose:** Add the complete category-first manual workflow while retaining the legacy Mapping fallback.

- [ ] 3.1 Add failing `user-event` coverage for category selection → assignment mode → equipment selection → preview cancel.
- [ ] 3.2 Add failing `user-event` coverage for category selection → assignment mode → preview confirm → return to the same category detail.
- [ ] 3.3 Introduce a focused workspace owner for selected category and `detail` / `assign` mode without merging unrelated server-state hooks.
- [ ] 3.4 Reuse the existing Categories tree, category-row rendering, Phase 1 split-pane contract, detail pane, assigned-equipment query, tenant selection, and category CRUD dialogs.
- [ ] 3.5 Keep the Phase 1 layout and long-name regression suites unchanged and passing in both `detail` and `assign` modes; switching modes may replace only the right work surface.
- [ ] 3.6 Embed the Phase 2 manual mapping components in the right-pane assignment mode.
- [ ] 3.7 Preserve parent and leaf categories as valid assignment targets.
- [ ] 3.8 Show direct parent assignments with `dinh_muc_thiet_bi_by_nhom` separately from aggregate descendant counts and quota.
- [ ] 3.9 Preserve the selected category while entering assignment mode and opening or cancelling the manual preview.
- [ ] 3.10 On a nonzero `dinh_muc_thiet_bi_link` result, invalidate existing unassigned, filter-option, category-list, and compliance queries.
- [ ] 3.11 Await an exact `dinh_muc_thiet_bi_by_nhom` refetch for the selected category and tenant, or keep detail loading until it resolves.
- [ ] 3.12 Return to the same category detail, clear stale manual selection, and distinguish only confirmed IDs present in the refreshed result.
- [ ] 3.13 Add deferred-query regression coverage proving stale cached detail is not presented as reconciled before the exact refetch completes.
- [ ] 3.14 Define and test full success, count-based partial success, zero affected, and error feedback without inventing failed-item reasons.

**Deploy-safe boundary:** Equipment-manager Categories gains a complete manual assignment path, but the existing Mapping tab and route remain available as a fallback. Mapping-only roles and suggestion entry remain on their existing surface.

**Exit gate:** Users can complete and verify manual assignments entirely inside Categories, with focused tests and smoke checks passing, before any navigation cutover.

## Phase 4 - Suggestion Entry Preservation

**Purpose:** Add the existing facility-wide suggestion entry to the unified workspace without removing the legacy surface.

- [ ] 4.1 Re-run suggestion characterization tests before moving its trigger.
- [ ] 4.2 Add the existing facility-wide suggestion trigger to the unified page-level action area without coupling it to selected-category state.
- [ ] 4.3 Continue opening the existing `SuggestedMappingPreviewDialog`.
- [ ] 4.4 Preserve `regional_leader` preview-only behavior and all existing mutation-role guards.
- [ ] 4.5 Preserve group/device-name exclusions, unmatched results, disclaimer, retry behavior, and `dinh_muc_thiet_bi_link_batch` payload semantics.
- [ ] 4.6 Keep the existing Mapping suggestion entry for roles that do not have category-manager access.

**Deploy-safe boundary:** The suggestion implementation remains the same component and orchestration. The legacy Mapping tab and route remain available, so the new entry can be smoke-tested before cutover.

**Exit gate:** The unified workspace can open and complete the existing suggestion workflow with no behavior or permission drift.

## Phase 5 - Navigation Cutover and Legacy Redirect

**Purpose:** Make the proven unified workspace canonical in a small route/navigation-only PR.

- [ ] 5.1 For equipment-manager roles, replace the separate module tabs with one `Danh mục & phân loại` navigation entry.
- [ ] 5.2 Keep `/device-quota/categories` as the canonical route for equipment-manager roles.
- [ ] 5.3 Redirect equipment-manager requests from `/device-quota/mapping` to `/device-quota/categories`.
- [ ] 5.4 Preserve `/device-quota/mapping` and its `Phân loại` entry for mapping-only roles.
- [ ] 5.5 Update manager-facing in-repo links that point to the legacy Mapping page.
- [ ] 5.6 Add route/navigation tests for an equipment manager, `regional_leader`, and another non-manager role.
- [ ] 5.7 Verify manager-only category CRUD controls remain unavailable to mapping-only roles.
- [ ] 5.8 Verify category CRUD, manual assignment, and facility-wide suggestions remain reachable for their existing authorized roles after cutover.

**Deploy-safe boundary:** Navigation and routing change only after both manual assignment and suggestion workflows are already proven on Categories.

**Exit gate:** Canonical navigation and legacy bookmarks resolve to a fully functional unified workspace.

## Phase 6 - Redundant Composition Cleanup

**Purpose:** Remove obsolete ownership only after cutover is stable.

- [ ] 6.1 Remove only Mapping composition that is no longer used by equipment-manager routes; retain the Mapping page required by mapping-only roles.
- [ ] 6.2 Retain route-agnostic components still used by the unified workspace.
- [ ] 6.3 Remove obsolete tests only when equivalent canonical-workspace coverage exists.
- [ ] 6.4 Retain the Phase 1 split-pane and long-name regression tests as canonical coverage through cleanup.
- [ ] 6.5 Verify no equipment-manager imports, links, or tests still expect the removed duplicate composition.
- [ ] 6.6 Confirm no suggestion orchestration, API route, job-store, provider, or RPC file changed during cleanup.

**Deploy-safe boundary:** Dead frontend composition cleanup only; canonical behavior does not change.

**Exit gate:** No duplicated top-level category-selection workflow remains, and all retained mapping components have active consumers.

## Phase 7 - Final Verification and Rollout Closeout

- [ ] 7.1 Run `openspec validate refactor-device-quota-category-mapping-workflow --strict`.
- [ ] 7.2 Run `node scripts/npm-run.js run format:check`.
- [ ] 7.3 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 7.4 Run `node scripts/npm-run.js run verify:dedupe`.
- [ ] 7.5 Run `node scripts/npm-run.js run typecheck`.
- [ ] 7.6 Run focused Categories, Mapping compatibility, manual preview, suggestion, navigation, and long-name Vitest suites.
- [ ] 7.7 Run `node scripts/npm-run.js run react-doctor`.
- [ ] 7.8 Perform manual desktop and mobile smoke checks for category browsing, manual assignment, result verification, legacy-route redirect, and facility-wide suggestion entry.
- [ ] 7.9 Confirm the cumulative implementation diff contains no SQL migration, RPC allowlist change, generated DB type change, or backend suggestion change.
