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
- Make that workspace the only Device Quota category/mapping page for every role currently authorized to use either workflow.
- Keep category context visible and stable throughout manual assignment.
- Make successful assignments verifiable without changing routes or searching the hierarchy again.
- Use the full content width available inside the application shell on wide desktop viewports.
- Improve long Vietnamese category-name readability as a P0 part of the consolidation.
- Preserve current role, tenant, category-detail visibility, pagination, filtering, preview, and mutation behavior.
- Preserve the current distinction between category-manager permissions and mapping-only permissions inside the unified workspace.
- Preserve parent-category assignment as an allowed manual mapping target.
- Preserve the facility-wide suggestion workflow as an independent action before removing its old page surface.
- Remove the `/device-quota/mapping` page route after all of its user-facing capabilities are proven in Categories.
- Keep the change frontend-only and reuse existing data contracts.

### Non-Goals

- Do not redesign, replace, or change the behavior of the facility-wide suggestion pipeline.
- Do not add, remove, or modify RPCs, API payloads, database schema, migrations, grants, or RLS.
- Do not add server-side `Còn thiếu` / `Đã đủ` category filtering in the first implementation.
- Do not change category CRUD, Excel import/template behavior, quota calculation, or compliance rules.
- Do not broaden category CRUD or category-import permissions to roles that currently have Mapping-only access.
- Do not broaden manual-assignment, suggestion-preview, or suggestion-apply permissions while consolidating routes.
- Do not redesign unrelated Device Quota tabs such as Tổng quan or Quyết định.
- Do not introduce a generic cross-module split-pane framework unless existing shared primitives already satisfy the requirement.

## Decisions

### 1. Use one permission-aware canonical route and remove Mapping

`/device-quota/categories` remains the canonical workspace route because it already owns category CRUD, the category tree, quota detail, and assigned-equipment inspection.

Every role currently authorized to use either Categories or Mapping will enter through one top-level navigation entry labelled **Danh mục & phân loại** and load `/device-quota/categories`.

The unified route is permission-aware rather than manager-only. Its page-entry guard will admit roles already authorized for Mapping, while detail and action guards continue enforcing existing permissions. Roles that currently fail the Categories manager guard may use the category hierarchy as read-only context and receive only the manual-mapping and suggestion actions already allowed by their existing authorization. They must not gain quota or assigned-equipment detail access merely because the route moved to Categories. This includes preserving `regional_leader` preview-only suggestion behavior. Category detail, create, edit, delete, import, and any other manager-only controls remain unavailable to those roles unless their current authorization already permits them.

After manual mapping and facility-wide suggestions are both proven in Categories, navigation and internal links will stop exposing Mapping. The final cleanup removes `src/app/(app)/device-quota/mapping/page.tsx` and its route-specific composition. Direct requests to `/device-quota/mapping` then use the application's standard not-found behavior; no compatibility redirect remains.

This changes route composition, not authentication or role definitions. Tenant selection, mutation authorization, preview/apply restrictions, and all current permission boundaries remain intact.

### 2. Use one category tree as the stable context

The Categories tree remains the single hierarchy rendered in the workspace. For roles already authorized to inspect Categories detail, selecting a category updates the right detail pane exactly as it does today.

For roles whose current access is limited to Mapping, category selection provides only the read-only hierarchy context and existing authorized mapping controls. The unified workspace must not fetch or render quota or assigned-equipment detail for those roles unless the current authorization already permits that data.

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

The safest implementation is to continue opening the existing `SuggestedMappingPreviewDialog` from the unified page header without modifying its internal orchestration. Any suggestion components or hooks still owned by the Mapping route must move to route-agnostic ownership before that route is deleted; moving ownership must not change the dialog, async job, API, retry, exclusion, preview-only, or batch-apply contracts.

### 6. Use the available workspace width and keep category names readable

On wide desktop layouts, the Categories page shell will use the full content width available inside the application shell instead of a centered route-local `container` maximum width. The workspace keeps responsive horizontal gutters, but it must not leave large unused columns on both sides when the app shell has room for the category and equipment surfaces.

This width change is scoped to the unified Categories workspace. It must not widen unrelated Device Quota pages or redefine the global application shell.

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

The current Categories and Mapping compositions both consume the shared `40-60` split-pane option. Phase 1 therefore added a non-breaking `46-54` option rather than redefining `40-60` globally. The full-width workspace phase retains that internal `46-54` contract while expanding the outer Categories content area.

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
- Rendering the unified route for roles without category-management access could accidentally expose manager-only controls.
  - Mitigation: keep authorization checks at existing detail and action boundaries and add role-matrix coverage proving no new quota/assigned-equipment detail reads, category CRUD, manual mapping, suggestion preview, or suggestion apply access.
- Removing the Mapping route will intentionally break stale external bookmarks.
  - Mitigation: update all in-repo navigation and links before cleanup, verify no active workflow depends on the page route, and accept standard not-found behavior as the explicit product decision.
- Expanding the outer workspace can create overly wide rows or remove useful mobile gutters.
  - Mitigation: scope the change to Categories, retain responsive horizontal padding, keep the internal `46-54` split, and preserve right-pane overflow constraints.
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
4. **Wide unified workspace:** expand the Categories outer content area while preserving the canonical `46-54` split and responsive behavior.
5. **Unified manual assignment:** add the complete category-first manual flow to Categories while keeping Mapping only as a temporary deploy-safe fallback.
6. **Suggestion entry preservation:** expose the unchanged facility-wide suggestion workflow from Categories for every currently authorized role.
7. **Navigation cutover:** make Categories canonical for every role currently authorized to use Categories or Mapping after both workflows are proven.
8. **Route removal and cleanup:** delete the Mapping page route and redundant route-specific composition without removing manual-mapping or suggestion capabilities.

Each phase must pass focused tests and preserve all production workflows available before that phase. No PR may expose an incomplete assignment mode, replace the corrected category pane, or remove its Phase 1 regression coverage.

Rollback is phase-local:

- readability and component-refactor phases can revert without route changes;
- the wide-workspace phase can revert without workflow changes;
- the unified manual and suggestion entries can revert while Mapping remains available before final cleanup;
- navigation cutover can revert to the two-tab layout without data changes;
- route removal happens only after no authorized role or active capability depends on Mapping;
- after route removal, rollback requires redeploying the previous frontend composition rather than relying on a permanent compatibility route.

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
  - every role currently authorized for Categories or Mapping receives the unified Categories workspace;
  - equipment-manager roles retain manager controls;
  - mapping-only roles retain only their existing category-detail, manual, and suggestion permissions;
  - `regional_leader` retains preview-only suggestions inside Categories without gaining category detail or mutation access;
  - restricted non-manager roles retain their current denial from the Device Quota module.
- Parent and leaf categories:
  - both remain valid manual targets;
  - parent detail renders direct assignments separately from aggregate descendant state.
- Reconciliation:
  - defer selected-category detail presentation until the exact assigned-equipment refetch resolves;
  - cover full, partial-count, zero-affected, and error outcomes.
- Characterize and preserve the global suggestion trigger, grouped preview, unmatched section, exclusions, permissions, and batch apply behavior.
- Verify long names wrap to two lines, expose full text with `user-event` hover and keyboard focus, and do not collide with actions or usage data.
- Verify the full-width Categories shell, wide-desktop split, responsive gutters, and right-pane horizontal overflow at 1440x900 and 1920x1080 representative viewports.
- Verify no navigation entry, internal link, route-specific component, or focused test still depends on `/device-quota/mapping` after cleanup, and that direct requests use standard not-found behavior.
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
