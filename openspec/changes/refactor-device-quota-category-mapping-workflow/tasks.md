## Delivery Rules

- Each phase is a separate reviewable PR unless the user explicitly approves combining adjacent phases.
- Every PR must be independently deployable and must preserve all production workflows available before that phase.
- Production UI must not expose an incomplete assignment mode.
- The Mapping tab and route remain available only as a temporary deploy-safe fallback until manual mapping and facility-wide suggestions have both shipped in Categories and passed focused production smoke checks.
- Final cleanup removes `/device-quota/mapping` completely without a redirect, but it must not remove or alter any manual-mapping or suggestion capability.
- The facility-wide suggestion workflow must remain functional throughout every phase.
- The Phase 1 category-pane layout and long-name behavior are canonical workspace contracts. Later phases must reuse them and keep their regression tests passing rather than replacing them with a second category-tree implementation.
- The unified Categories route must preserve existing permissions: route consolidation must not broaden category-detail, category CRUD, manual-assignment, suggestion-preview, or suggestion-apply access.
- No phase may add a database migration, RPC, API payload change, generated DB type change, or live database write.

## Phase 0 - Characterization and Regression Baseline

**Purpose:** Lock current behavior before production refactors.

- [x] 0.1 Add or update page-level tests that characterize the current Categories master-detail behavior.
- [x] 0.2 Characterize the current Mapping manual-selection, preview-cancel, preview-confirm, success, and error behavior.
- [x] 0.3 Characterize the current facility-wide suggestion trigger, role behavior, grouped preview, unmatched section, exclusions, retry, and batch apply behavior.
- [x] 0.4 Preserve the existing `CategoryActionMenu` deferred dropdown-to-dialog regression coverage.
- [x] 0.5 Characterize the role matrix: equipment-manager access to both current tabs, `regional_leader` Mapping access and preview-only suggestions, and a restricted non-manager role that remains outside the module.
- [x] 0.6 Characterize parent and leaf categories as valid targets in the current Mapping tree and record the current leaf-only Categories detail presentation.
- [x] 0.7 Record focused desktop screenshots or equivalent visual baselines for the current Categories and Mapping pages.

**Deploy-safe boundary:** Tests and reference artifacts only; no production behavior changes.

**Exit gate:** Current Categories, Mapping, and suggestion workflows are covered well enough to detect behavioral drift in later phases.

## Phase 1 - Category Pane Readability

**Purpose:** Deliver the long-name readability fix independently before workflow consolidation.

- [x] 1.1 Add a failing regression test for the new 46% / 54% wide-desktop split contract.
- [x] 1.2 Add a non-breaking `46-54` split-pane option or Categories-scoped override. Do not redefine the existing shared `40-60` option because both current Categories and Mapping compositions consume it.
- [x] 1.3 Change the current Categories wide-desktop allocation to approximately 46% category pane and 54% detail pane.
- [x] 1.4 Give code, classification, usage/progress, and row actions bounded widths while allowing the category name to consume flexible space.
- [x] 1.5 Preserve two-line category names and add a failing `user-event` test that opens the complete value by pointer hover and keyboard focus.
- [x] 1.6 Verify wrapping does not overlap indentation, progress data, menus, or adjacent rows.
- [x] 1.7 Preserve horizontal scrolling and minimum table width in the assigned-equipment pane.
- [x] 1.8 Verify 1440x900, 1920x1080, narrower desktop, and mobile layouts.

**Deploy-safe boundary:** Existing Categories behavior is unchanged except for layout and full-text readability. Mapping and suggestion workflows are untouched.

**Exit gate:** The panel-width and long-name P0 requirement is production-ready and can ship without waiting for the unified workflow.

## Phase 2 - Route-Agnostic Manual Mapping Components

**Purpose:** Prepare reusable frontend ownership while preserving the existing Mapping page.

- [x] 2.1 Run code-deduplication discovery before creating or moving shared hooks, utilities, or split-pane components.
- [x] 2.2 Extract or adapt the unassigned-equipment filters, pagination, page-only selection, and manual preview trigger so they do not depend on Mapping page composition.
- [x] 2.3 Keep the existing `/device-quota/mapping` page as the active consumer of the refactored components.
- [x] 2.4 Preserve current query keys, mutation payloads, selection semantics, tenant scope, role behavior, and visible labels.
- [x] 2.5 Keep new and modified source files below the repository file-size ceilings.
- [x] 2.6 Prove with existing and focused tests that the Mapping page behaves identically after the refactor.

**Deploy-safe boundary:** Internal frontend refactor only. Both top-level tabs, routes, and user workflows remain unchanged.

**Exit gate:** Manual mapping components can be embedded by another route without copying logic or changing current Mapping behavior.

## Phase 2.5 - Wide Unified Workspace

**Purpose:** Expand the future canonical Categories workspace before adding more controls, without changing current workflows.

- [x] 2.7 Add failing layout coverage proving the Categories page uses the full content width available inside the application shell at wide desktop viewports.
- [x] 2.8 Replace the Categories route-local centered `container` maximum width with a full-width workspace shell and responsive horizontal gutters.
- [x] 2.9 Keep the Phase 1 `46-54` split, long-name behavior, and right-pane horizontal overflow unchanged inside the expanded outer shell.
- [x] 2.10 Keep the width change scoped to Categories; do not widen the global application shell, Mapping, or unrelated Device Quota routes.
- [x] 2.11 Verify 1440x900, 1920x1080, narrower desktop, and mobile layouts without overlapping controls or excessive side whitespace.

**Deploy-safe boundary:** Categories layout only. Category behavior, Mapping, suggestions, navigation, permissions, and data contracts remain unchanged.

**Exit gate:** The canonical Categories workspace uses the available app-shell width and remains responsive before manual assignment is embedded.

## Phase 3 - Unified Manual Assignment in Categories

**Purpose:** Add the complete category-first manual workflow for every role currently authorized to perform manual mapping while retaining Mapping only as a temporary fallback.

- [ ] 3.1 Add failing `user-event` coverage for category selection → assignment mode → equipment selection → preview cancel.
- [ ] 3.2 Add failing `user-event` coverage for category selection → assignment mode → preview confirm → return to the same category detail.
- [ ] 3.3 Introduce a focused workspace owner for selected category and `detail` / `assign` mode without merging unrelated server-state hooks.
- [ ] 3.4 Reuse the existing Categories tree, category-row rendering, Phase 1 split-pane contract, detail pane, assigned-equipment query, tenant selection, and category CRUD dialogs.
- [ ] 3.5 Keep the Phase 1 layout and long-name regression suites unchanged and passing in both `detail` and `assign` modes; switching modes may replace only the right work surface.
- [ ] 3.6 Embed the Phase 2 manual mapping components in the right-pane assignment mode for roles already authorized to perform manual mapping.
- [ ] 3.7 Replace the Categories manager-only page-entry guard with a Device Quota access guard that admits roles already authorized for Mapping, then render the category hierarchy as read-only context and keep category detail, create, edit, delete, and import controls unavailable unless the current role already has those permissions.
- [ ] 3.8 Add role-matrix coverage proving Mapping-only roles do not fetch or render quota or assigned-equipment detail and receive only their existing manual-mapping and suggestion capabilities.
- [ ] 3.9 Preserve parent and leaf categories as valid assignment targets.
- [ ] 3.10 Show direct parent assignments with `dinh_muc_thiet_bi_by_nhom` separately from aggregate descendant counts and quota for roles authorized to inspect category detail.
- [ ] 3.11 Preserve the selected category while entering assignment mode and opening or cancelling the manual preview.
- [ ] 3.12 On a nonzero `dinh_muc_thiet_bi_link` result, invalidate existing unassigned, filter-option, category-list, and compliance queries.
- [ ] 3.13 Await an exact `dinh_muc_thiet_bi_by_nhom` refetch for the selected category and tenant, or keep detail loading until it resolves.
- [ ] 3.14 Return to the same category detail, clear stale manual selection, and distinguish only confirmed IDs present in the refreshed result.
- [ ] 3.15 Add deferred-query regression coverage proving stale cached detail is not presented as reconciled before the exact refetch completes.
- [ ] 3.16 Define and test full success, count-based partial success, zero affected, and error feedback without inventing failed-item reasons.

**Deploy-safe boundary:** Categories gains a complete permission-aware manual assignment path, but the existing Mapping tab and route remain available temporarily. Suggestions remain on their existing surface until Phase 4.

**Exit gate:** Every role currently authorized for manual mapping can complete and verify that workflow entirely inside Categories, with no permission drift, before any navigation cutover.

## Phase 4 - Suggestion Entry Preservation

**Purpose:** Add the existing facility-wide suggestion workflow to the unified workspace before removing its old page surface.

- [ ] 4.1 Re-run suggestion characterization tests before moving its trigger.
- [ ] 4.2 Add the existing facility-wide suggestion trigger to the unified page-level action area without coupling it to selected-category state.
- [ ] 4.3 Continue opening the existing `SuggestedMappingPreviewDialog`.
- [ ] 4.4 Preserve `regional_leader` preview-only behavior and all existing mutation-role guards.
- [ ] 4.5 Preserve group/device-name exclusions, unmatched results, disclaimer, retry behavior, and `dinh_muc_thiet_bi_link_batch` payload semantics.
- [ ] 4.6 Expose the suggestion entry inside Categories to every role that currently receives it on Mapping, without coupling visibility to category CRUD access.
- [ ] 4.7 Move any suggestion components or hooks required by Categories to route-agnostic ownership without changing dialog, job, API, retry, preview-only, exclusion, or batch-apply behavior.
- [ ] 4.8 Prove with shared behavior tests that Categories preserves the current Mapping suggestion workflow before navigation cutover.
- [ ] 4.9 Run and record focused production smoke checks from the Categories route for an authorized manual assignment with exact selected-category reconciliation, an authorized suggestion preview/apply flow, and `regional_leader` preview-only behavior with no category detail or mutation access. Block Phase 5 until all checks pass.

**Deploy-safe boundary:** The suggestion implementation remains the same component and orchestration. Mapping remains available only as a temporary fallback while the Categories entry is smoke-tested.

**Exit gate:** The unified workspace can open and complete the existing suggestion workflow with no behavior or permission drift.

## Phase 5 - Navigation Cutover to Categories

**Purpose:** Make the proven unified workspace canonical in a small route/navigation-only PR.

- [ ] 5.1 For every role currently authorized to use Categories or Mapping, replace separate module tabs with one `Danh mục & phân loại` navigation entry.
- [ ] 5.2 Keep `/device-quota/categories` as the only canonical workspace route for those roles.
- [ ] 5.3 Update every in-repo navigation target and internal link that points to the Mapping page.
- [ ] 5.4 Keep Mapping route code only as a short-lived rollback surface until Phase 6; do not expose it in navigation or new links.
- [ ] 5.5 Preserve existing role-specific visibility and mutation guards inside the permission-aware Categories workspace.
- [ ] 5.6 Add route/navigation tests for an equipment manager, `regional_leader`, and another non-manager role.
- [ ] 5.7 Verify manager-only category CRUD controls remain unavailable to mapping-only roles.
- [ ] 5.8 Verify category CRUD, manual assignment, and facility-wide suggestions remain reachable for their existing authorized roles after cutover.
- [ ] 5.9 After navigation cutover, run and record the same role-matrix production smoke checks through the canonical `Danh mục & phân loại` entry. Block Phase 6 route deletion until all checks pass.

**Deploy-safe boundary:** Navigation and routing change only after both manual assignment and suggestion workflows are already proven on Categories.

**Exit gate:** No active navigation or internal link depends on Mapping, every authorized capability is available from Categories, and the post-cutover production smoke gate passes before route deletion.

## Phase 6 - Remove Mapping Route and Redundant Composition

**Purpose:** Delete the Mapping page route only after its manual and suggestion capabilities are proven in Categories.

- [ ] 6.1 Delete `src/app/(app)/device-quota/mapping/page.tsx` and all route-specific composition that has no active consumer.
- [ ] 6.2 Do not add a redirect or compatibility page; verify direct `/device-quota/mapping` requests use standard not-found behavior.
- [ ] 6.3 Retain route-agnostic manual-mapping and suggestion components still used by Categories.
- [ ] 6.4 Remove obsolete Mapping page tests only when equivalent permission-aware Categories coverage exists.
- [ ] 6.5 Retain the Phase 1 split-pane, long-name, manual-mapping, and suggestion regression suites as canonical coverage through cleanup.
- [ ] 6.6 Verify no navigation, internal link, route-specific import, or focused test still expects the removed Mapping page.
- [ ] 6.7 Confirm suggestion orchestration, `/api/device-quota/mapping/suggest/**`, job-store, provider, RPC, preview-only, and batch-apply behavior remain unchanged.

**Deploy-safe boundary:** Page-route and dead frontend composition cleanup only. All user capabilities already run from Categories, and backend/API contracts remain unchanged.

**Exit gate:** `/device-quota/mapping` no longer exists, no legacy Mapping UI remains, and all retained manual-mapping and suggestion components have active Categories consumers.

## Phase 7 - Final Verification and Rollout Closeout

- [ ] 7.1 Run `openspec validate refactor-device-quota-category-mapping-workflow --strict`.
- [ ] 7.2 Run `node scripts/npm-run.js run format:check`.
- [ ] 7.3 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 7.4 Run `node scripts/npm-run.js run verify:dedupe`.
- [ ] 7.5 Run `node scripts/npm-run.js run typecheck`.
- [ ] 7.6 Run focused Categories, manual preview, suggestion, permission-matrix, route-removal, navigation, wide-workspace, and long-name Vitest suites.
- [ ] 7.7 Run `node scripts/npm-run.js run react-doctor`.
- [ ] 7.8 Perform manual desktop and mobile smoke checks for the full-width workspace, category browsing, manual assignment, result verification, Mapping route removal, and facility-wide suggestion entry.
- [ ] 7.9 Confirm the cumulative implementation diff contains no SQL migration, RPC allowlist change, generated DB type change, or backend suggestion change.
