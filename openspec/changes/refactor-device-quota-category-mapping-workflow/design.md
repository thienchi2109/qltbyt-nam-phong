# Design: Unified Device Quota Category Workspace

## Context

The current Device Quota Categories page already behaves as a category master-detail view:

- the left pane renders the hierarchy and category actions;
- the right pane renders quota state and assigned equipment for the selected category.

The current Mapping page duplicates the category hierarchy beside an unassigned-equipment list. Manual assignment succeeds through existing RPCs, invalidates the unassigned list and category counts, and then clears both equipment and category selection. Users must navigate to Categories and locate the category again to inspect the result.

The approved Stitch direction, **Danh mục & Phân loại (Unified Workspace)**, keeps the category tree as the stable context and changes only the right work surface between inspection and manual assignment.

## Goals / Non-Goals

### Goals

- Give users one category-first workspace for category management, result inspection, and manual equipment assignment.
- Keep category context visible and stable throughout manual assignment.
- Make successful assignments verifiable without changing routes or searching the hierarchy again.
- Improve long Vietnamese category-name readability as a P0 part of the consolidation.
- Preserve current role, tenant, pagination, filtering, preview, and mutation behavior.
- Preserve the current distinction between category-manager access and mapping-only access.
- Preserve parent-category assignment as an allowed manual mapping target.
- Keep the change frontend-only and reuse existing data contracts.

### Non-Goals

- Do not redesign, replace, or change the behavior of the facility-wide suggestion pipeline.
- Do not add, remove, or modify RPCs, API payloads, database schema, migrations, grants, or RLS.
- Do not add server-side `Còn thiếu` / `Đã đủ` category filtering in the first implementation.
- Do not change category CRUD, Excel import/template behavior, quota calculation, or compliance rules.
- Do not broaden category CRUD or category-import permissions to roles that currently have Mapping-only access.
- Do not redesign unrelated Device Quota tabs such as Tổng quan or Quyết định.
- Do not introduce a generic cross-module split-pane framework unless existing shared primitives already satisfy the requirement.

## Decisions

### 1. Use a role-aware canonical route

`/device-quota/categories` remains the canonical workspace route because it already owns category CRUD, the category tree, quota detail, and assigned-equipment inspection.

For roles accepted by `isEquipmentManagerRole`, the top-level module navigation will expose one entry labelled **Danh mục & phân loại** instead of separate **Phân loại** and **Danh mục** entries. Requests from these roles to `/device-quota/mapping` will redirect to `/device-quota/categories` so their existing bookmarks and internal links do not become dead ends.

Roles that currently have Mapping access but fail the Categories manager guard keep `/device-quota/mapping` and its existing **Phân loại** navigation entry. This includes the `regional_leader` preview-only suggestion path. The change must not expose category CRUD, import, delete, or other manager-only controls to these roles.

This is a role-aware route-composition change only. Authentication, tenant selection, mutation authorization, and current role boundaries remain intact.

### 2. Use one category tree as the stable context

The Categories tree remains the single hierarchy rendered in the workspace. Selecting a category updates the right detail pane exactly as it does today.

Manual assignment starts from a selected category. The left pane remains visible and the selected row remains highlighted while the right pane switches to assignment mode. This removes the need to render a second selectable category tree.

The current Mapping flow permits parent and leaf categories as assignment targets, so the unified manager workspace preserves both. For a parent category, the detail pane distinguishes:

- aggregate descendant count/quota information; and
- equipment assigned directly to the selected parent, fetched with the existing `dinh_muc_thiet_bi_by_nhom` RPC.

The implementation should preserve keyboard row selection, action-menu isolation, and the deferred Radix dropdown-to-dialog handoff already protected by `CategoryActionMenu.test.tsx`.

### 3. Change the right pane between detail and manual assignment modes

The right pane has two explicit client states:

- `detail`: quota summary and equipment currently assigned to the selected category;
- `assign`: unassigned-equipment search, filters, page-only selection, and the manual preview action for the selected category.

The existing unassigned-equipment filters, server pagination, selection semantics, and `DeviceQuotaMappingPreviewDialog` should be reused rather than reimplemented.

Closing the preview without confirmation does not mutate data and returns to the assignment context. Leaving assignment mode returns to the selected category detail without navigating to another top-level route.

### 4. Reconcile successful assignments in the selected category

After `dinh_muc_thiet_bi_link` returns, the client will:

1. keep the target category ID long enough to return to its detail pane;
2. retain the confirmed equipment IDs as transient presentation state;
3. invalidate or refetch:
   - `dinh_muc_thiet_bi_unassigned`;
   - `dinh_muc_thiet_bi_unassigned_filter_options`;
   - `dinh_muc_nhom_list`;
   - `dinh_muc_compliance_summary`;
   - `dinh_muc_thiet_bi_by_nhom` for the selected category and tenant;
4. await the exact selected-category and tenant assigned-equipment refetch, or keep detail in a loading state until that refetch resolves;
5. compare the returned affected count with the requested count;
6. clear stale manual selection state;
7. render the refreshed assigned-equipment list and temporarily distinguish only confirmed IDs present in that refreshed result.

The highlight is client presentation state and must not add a persistence field or backend contract.

Because `dinh_muc_thiet_bi_link` returns only an affected count, partial success handling is count-based:

- full success returns to detail with the normal success message;
- partial success (`0 < affected < requested`) returns to reconciled detail with `affected/requested` feedback and highlights only rows present in the refreshed result;
- zero affected remains in assignment mode after refreshing the unassigned list and shows a non-success message.

The frontend must not invent failed-item reasons or identities that the current RPC does not return.

### 5. Preserve the suggestion workflow as an independent global action

The existing **Gợi ý phân loại hàng loạt** trigger remains a facility-wide action and must not appear to target the selected category.

Implementation must preserve:

- existing role visibility and access checks;
- `regional_leader` preview-only behavior;
- facility-scoped async job creation, bounded processing, polling, retry, and failure behavior;
- grouping across multiple suggested categories;
- per-group and per-equipment-name exclusion/restoration;
- unmatched-equipment presentation;
- the review disclaimer and batch confirmation;
- the `dinh_muc_thiet_bi_link_batch` payload and result handling.

The safest implementation is to continue opening the existing `SuggestedMappingPreviewDialog` from the unified page header without modifying its internal orchestration.

### 6. Make category names readable before adding more controls

Long-name readability is a core acceptance criterion, not follow-up polish.

On wide desktop layouts, the workspace will target an approximately 46% / 54% split in favor of the category pane. The category pane should have a stable minimum width when the containing viewport can support it.

Within each category row:

- code, classification, usage/progress, and action columns use bounded widths;
- the category-name column receives the flexible remaining width;
- the name can wrap to at most two lines with stable line height;
- the complete name remains available through a visible tooltip or equivalent affordance opened by both pointer hover and keyboard focus;
- wrapping must not overlap the row menu, progress value, parent indentation, or adjacent rows.

The assigned-equipment surface may use its existing horizontal overflow contract when the wider category pane reduces right-pane width.

At narrower desktop and mobile breakpoints, the layout may reduce the split or use the existing stacked/drawer pattern, but it must not restore single-line name truncation as the only inspection mechanism.

The current Categories and Mapping compositions both consume the shared `40-60` split-pane option. Phase 1 must therefore add a non-breaking `46-54` option or a Categories-scoped override rather than redefining `40-60` globally. This keeps the legacy Mapping layout unchanged until its planned cutover.

The Phase 1 result is the canonical category-pane contract for the unified workspace. Later phases may extract its shell, but they must retain the same category tree, category-row rendering, width allocation, full-text affordance, and regression coverage. Adding assignment mode changes only the right work surface; it must not replace the corrected category pane.

### 7. Keep data ownership local and avoid semantic duplication

The implementation should consolidate existing category and mapping components around one workspace owner rather than copying hooks into a third route.

Before adding shared utilities or state containers, implementation must run the repository's code-deduplication discovery workflow. Existing category filtering, pagination, mutation, preview, and split-pane primitives should be reused where their contracts already match.

Source files must remain below the repository's 450-line hard ceiling. The workspace shell, detail mode, assignment mode, mutations, and types should remain separately testable units.

## Risks / Trade-offs

- A wider category pane leaves less visible width for the assigned-equipment table.
  - Mitigation: preserve the current right-pane horizontal scroll and minimum table width.
- Combining two contexts can create a large provider with intertwined state.
  - Mitigation: keep server state in existing focused hooks and introduce only a small workspace mode/category-selection owner.
- Redirecting the old route could break tests or internal links that expect Mapping page content.
  - Mitigation: redirect only equipment-manager roles, retain Mapping for mapping-only roles, add role-matrix route coverage, and update manager-facing links in the same cutover phase.
- Returning immediately to detail may race query invalidation and briefly show stale data.
  - Mitigation: await the exact selected category and tenant refetch or hold detail in loading state before presenting reconciliation as complete.
- Visual proximity could make the global suggestion action look category-scoped.
  - Mitigation: place it in the page-level action area with facility-wide wording and keep it outside category-specific controls.
- Parent-category aggregate counts can be confused with directly assigned equipment.
  - Mitigation: label direct parent assignments separately and keep aggregate quota/count presentation distinct.
- A later workspace refactor could accidentally discard the Phase 1 readability fix by rebuilding the category pane.
  - Mitigation: treat the Phase 1 layout and long-name tests as canonical merge gates through assignment integration, navigation cutover, and cleanup.

## Migration and Rollout

Delivery is split into small, independently deployable PRs:

1. **Characterization baseline:** tests and visual references only.
2. **Category readability:** ship the canonical 46% category pane and long-name behavior on the current Categories page without changing the shared `40-60` Mapping layout.
3. **Route-agnostic mapping components:** refactor the current Mapping page without changing its behavior.
4. **Unified manual assignment:** add the complete category-first manual flow to Categories while keeping the legacy Mapping tab and route as a fallback.
5. **Suggestion entry preservation:** expose the existing suggestion dialog from Categories while keeping the old Mapping surface available.
6. **Navigation cutover:** make Categories canonical for equipment-manager roles and redirect only those roles after both workflows are proven.
7. **Cleanup:** remove redundant page composition after cutover stability is confirmed.

Each phase must pass focused tests and preserve all production workflows available before that phase. No PR may expose an incomplete assignment mode, replace the corrected category pane, or remove its Phase 1 regression coverage.

Rollback is phase-local:

- readability and component-refactor phases can revert without route changes;
- the unified manual workflow can be disabled by retaining the legacy Mapping fallback;
- navigation cutover can revert to the two-tab layout without data changes;
- cleanup happens only after the fallback is no longer required.

No phase requires data rollback because all existing RPCs and API routes remain backward compatible.

## Verification Strategy

- OpenSpec: `openspec validate refactor-device-quota-category-mapping-workflow --strict`.
- TDD: add failing tests before production changes.
- Testing Library `user-event`:
  - choose a category;
  - enter manual assignment;
  - select equipment;
  - open preview;
  - cancel without mutation;
  - confirm assignment;
  - return to the same category and observe refreshed results.
- Role matrix:
  - equipment-manager roles receive the unified Categories workspace and manager controls;
  - `regional_leader` retains Mapping and preview-only suggestions;
  - restricted non-manager roles retain their current denial from the Device Quota module.
- Parent and leaf categories:
  - both remain valid manual targets;
  - parent detail renders direct assignments separately from aggregate descendant state.
- Reconciliation:
  - defer selected-category detail presentation until the exact assigned-equipment refetch resolves;
  - cover full, partial-count, zero-affected, and error outcomes.
- Characterize and preserve the global suggestion trigger, grouped preview, unmatched section, exclusions, permissions, and batch apply behavior.
- Verify long names wrap to two lines, expose full text with `user-event` hover and keyboard focus, and do not collide with actions or usage data.
- Verify the wide-desktop split and right-pane horizontal overflow at 1440x900 and 1920x1080 representative viewports.
- Run repository TypeScript/React gates in required order:
  - `format:check`;
  - `verify:no-explicit-any`;
  - `verify:dedupe`;
  - `typecheck`;
  - focused Vitest suites;
  - `react-doctor`.

## Visual Reference

- Stitch project: `10534322167157145773`
- Approved direction: `Danh mục & Phân loại (Unified Workspace)`
- Supporting artifacts:
  - `Luồng hiện tại và điểm nghẽn`
  - `So sánh phương án hợp nhất Danh mục và Phân loại`
  - `Giao diện Gán thiết bị (Chuẩn hóa Luồng)`

The Stitch artifacts are non-normative visual references. This document and the capability delta define implementation requirements.

## Open Questions

None blocking proposal approval. Exact responsive breakpoint values and highlight duration can be chosen during the implementation plan as long as the capability requirements remain satisfied.
