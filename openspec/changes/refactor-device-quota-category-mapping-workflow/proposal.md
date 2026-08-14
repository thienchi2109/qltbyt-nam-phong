# Change: Unify Device Quota Category and Manual Mapping Workflow

## Why

The Device Quota module currently separates two tightly coupled user goals:

- `/device-quota/mapping` lets users select unassigned equipment and assign it to a category.
- `/device-quota/categories` lets users browse the category tree and inspect the equipment already assigned to a category.

This split forces users to switch tabs after a successful assignment, find the same category again in a tree of 291 categories, and infer success from the equipment disappearing from the unassigned list before they can inspect the actual result. The same category hierarchy is rendered twice with different interaction models, which increases cognitive load and duplicates frontend ownership.

The current Categories split pane also gives too little horizontal space to long Vietnamese category names. Important names are truncated early because classification, usage, and row-action columns compete with the name column.

## What Changes

- For equipment-manager roles that currently see both tabs, replace the separate top-level **Phân loại** and **Danh mục** experiences with one category-first **Danh mục & phân loại** workspace.
- Keep `/device-quota/categories` as the canonical workspace for equipment-manager roles and redirect their legacy `/device-quota/mapping` requests to it.
- Preserve the current `/device-quota/mapping` route and **Phân loại** navigation entry for roles that do not have category-management access, including `regional_leader`.
- Render one category tree on the left and the selected category workspace on the right.
- Let the right pane switch between:
  - assigned-equipment detail for the selected category; and
  - manual assignment mode for selecting unassigned equipment for that same category.
- Preserve manual assignment to both parent and leaf categories. Parent detail shows equipment assigned directly to that parent separately from aggregate descendant counts.
- After a successful or partially successful manual assignment, reconcile the exact selected-category detail before returning from assignment mode, refresh category counts, and visibly identify rows confirmed by the refreshed result.
- Increase the wide-desktop category pane allocation to approximately 46% and prioritize the category-name column so long names can display on up to two lines with full-text access.
- Preserve the existing facility-wide **Gợi ý phân loại hàng loạt** workflow, permissions, async job behavior, preview, exclusions, unmatched results, and batch-save semantics without functional changes.
- Reuse existing frontend queries, API routes, and RPCs. This change adds no database migration, schema change, RPC, or backend contract.
- Deliver the consolidation through multiple small, deploy-safe PRs: regression baseline, category readability, route-agnostic component preparation, unified manual assignment with the legacy fallback intact, suggestion-entry preservation, navigation cutover, and redundant-composition cleanup.

## Capabilities

### New Capabilities

- `device-quota-category-workspace`: Defines the unified category-first browsing and manual assignment workflow, route compatibility, immediate result reconciliation, long-name readability, and preservation of the existing facility-wide suggestion workflow.

### Modified Capabilities

- None. The repository does not currently contain an OpenSpec capability for Device Quota category or mapping behavior.

## Impact

- Affected routes:
  - `src/app/(app)/device-quota/categories/page.tsx`
  - `src/app/(app)/device-quota/mapping/page.tsx`
  - `src/app/(app)/device-quota/layout.tsx`
- Affected category UI:
  - `src/app/(app)/device-quota/categories/_components/`
  - `src/app/(app)/device-quota/categories/_hooks/`
- Affected manual mapping UI:
  - `src/app/(app)/device-quota/mapping/_components/`
  - `src/app/(app)/device-quota/mapping/_hooks/`
- Existing data contracts reused:
  - `dinh_muc_nhom_list`
  - `dinh_muc_thiet_bi_by_nhom`
  - `dinh_muc_thiet_bi_unassigned`
  - `dinh_muc_thiet_bi_unassigned_filter_options`
  - `dinh_muc_thiet_bi_link`
- Existing suggestion contracts preserved:
  - `SuggestedMappingPreviewDialog`
  - `useSuggestMapping`
  - `/api/device-quota/mapping/suggest/**`
  - `dinh_muc_thiet_bi_link_batch`
- No Supabase migration, live database write, generated database type update, or RPC allowlist change is required.
- Focused regression coverage will use Testing Library `user-event` for the category selection, manual assignment, preview cancel, confirmation, and return-to-detail flows.
- Role-matrix coverage will prove equipment managers receive the unified workspace while mapping-only roles retain their current route, controls, and suggestion access.
