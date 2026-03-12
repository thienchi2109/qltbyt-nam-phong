# Bulk Soft-Delete Equipment

## Context

Phase 1 soft-delete (single equipment) is complete and production-hardened. Users now need to select multiple equipment items on the current page and soft-delete them in one operation. This also requires creating a **reusable table selection component** (`createSelectionColumn` + `BulkActionBar`) so other modules can adopt the same pattern.

**Decisions:**
- Reusable `createSelectionColumn<T>()` + `BulkActionBar` (composable, not a full DataTable wrapper)
- New `equipment_bulk_delete(p_ids bigint[])` RPC — single atomic transaction
- All-or-nothing failure mode (any validation failure rolls back entire batch)
- Selection scoped to current page only, desktop-only (max up to 100 items per page)

---

## Step 1: SQL Migration — `equipment_bulk_delete`

**Create:** `supabase/migrations/YYYYMMDDHHMMSS_equipment_bulk_delete.sql`

New RPC function following the exact security template from `equipment_delete` in `supabase/migrations/20260219150000_fix_equipment_delete_restore_allowlist.sql`:

- **`SET search_path TO 'public', 'pg_temp'`** — required for SECURITY DEFINER functions
- **Deduplication (CRITICAL):** `p_ids := ARRAY(SELECT DISTINCT unnest(p_ids));` immediately after input check — prevents count mismatch between `array_length` and `SELECT count(*)` when duplicates are passed
- **Input validation:** Reject NULL/empty arrays and arrays > 100 (aligned with current equipment page size cap)
- **Allow-list RBAC:** Only `global` / `to_qltb` (lines 34-37 of template)
- **Atomic row locking (two-step):**
  1. Lock actual rows: `SELECT id, don_vi, is_deleted FROM thiet_bi WHERE id = ANY(p_ids) ORDER BY id FOR UPDATE` into a temp table / array of records
  2. Validate count: `count(locked_rows) = array_length(p_ids, 1)` — row locks cannot be taken on aggregate queries, so lock rows first, then validate from the locked set
- **Existence check:** locked row count must equal `array_length(p_ids, 1)` or raise with list of missing IDs
- **Already-deleted guard:** Check `is_deleted = false` for all rows; include offending IDs in error
- **Tenant isolation:** Non-global users — all items must have `don_vi = v_donvi`; include offending IDs in error
- **Defense-in-depth UPDATE:** `WHERE id = ANY(p_ids) AND is_deleted = false AND (v_role = 'global' OR don_vi = v_donvi)`
- **Row count assertion:** `GET DIAGNOSTICS v_count = ROW_COUNT` must equal expected
- **Batch correlation:** Generate `v_batch_id := gen_random_uuid()` once per call; include in every audit entry for forensic correlation
- **Audit logging:** Loop through deleted items, call `audit_log()` per item with `action_type = 'equipment_bulk_delete'`, `batch_id`, and `batch_size` in `action_details`
- **Return:** `{success: true, deleted_count: N, ids: [...], batch_id: uuid}`
- **Permissions:** `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`
- **Comment:** Document that this function has no `p_don_vi` parameter — tenant isolation enforced via JWT claims, not proxy override

**Reuse:** `_get_jwt_claim()` helper, `audit_log()` function signature from existing migration.

---

## Step 2: API Whitelist

**Modify:** `src/app/api/rpc/[fn]/route.ts`

Add `'equipment_bulk_delete'` to the `ALLOWED_FUNCTIONS` set (near line 14-15, after `equipment_restore`).

No other proxy changes needed — `p_ids` passes through untouched; tenant isolation is enforced server-side via JWT claims (no `p_don_vi` parameter, so proxy override is a no-op).

---

## Step 3: Reusable Selection Components

**Create:** `src/components/ui/data-table-selection.tsx`

Two exports:

### `createSelectionColumn<T>(): ColumnDef<T>`
- Header: `Checkbox` with `table.getIsAllPageRowsSelected()` + indeterminate support
- Cell: `Checkbox` with `row.getIsSelected()` / `row.toggleSelected()`
- Cell wrapped in `<div onClick={stopPropagation}>` to prevent row click handlers (e.g., detail dialog in `equipment-content.tsx:164`)
- `enableSorting: false`, `enableHiding: false`, `size: 40`
- Vietnamese aria-labels: "Chọn tất cả" / "Chọn dòng"
- JSDoc: Note that consuming tables should configure `getRowId` for reliable ID extraction

### `BulkActionBar` component
```
Props: { selectedCount: number, onClearSelection: () => void, entityLabel?: string, children: ReactNode }
```
- Returns `null` when `selectedCount === 0`
- Renders: "Đã chọn **{N}** {entityLabel}" + children (action buttons) + "Bỏ chọn" ghost button
- `entityLabel` defaults to `"mục"` (generic "items") — callers can override (e.g., `"thiết bị"`, `"yêu cầu"`)
- Styled with `border-primary/20 bg-primary/5` for subtle highlight

**Reuse:** `Checkbox` from `src/components/ui/checkbox.tsx` (already supports indeterminate), `Button` from `src/components/ui/button.tsx`.

---

## Step 4: Mutation Hook — `useBulkDeleteEquipment`

**Modify:** `src/hooks/use-cached-equipment.ts` (add after `useRestoreEquipment` at line 201)

```
mutationFn: (ids: number[]) => callRpc({ fn: 'equipment_bulk_delete', args: { p_ids: ids } })
```

- Same cache invalidation as `useDeleteEquipment` (lines 142-151): `equipment_list_enhanced`, `equipment`, `active_usage_logs`, `dashboard-stats`, custom event
- Success toast: "Đã xóa {N} thiết bị thành công"
- Error toast: `error.message` or fallback

---

## Step 5: Equipment Table Integration

### 5a. Column factory — `equipment-table-columns.tsx`

- Add optional `canBulkSelect?: boolean` to `CreateEquipmentColumnsConfig` (line 120)
- When `true`, prepend `createSelectionColumn<Equipment>()` to columns array (line 208)
- Import `createSelectionColumn` from `@/components/ui/data-table-selection`

### 5b. Table hook — `useEquipmentTable.ts`

- Import `RowSelectionState` from `@tanstack/react-table`
- Add `const [rowSelection, setRowSelection] = useState<RowSelectionState>({})`
- **Add `getRowId: (row) => String(row.id)` to `useReactTable` config** — CRITICAL: prevents index-drift bugs with manual pagination where array indices collide across pages
- Wire into `useReactTable`: `enableRowSelection: true`, `onRowSelectionChange: setRowSelection`, add `rowSelection` to `state`
- **Selection reset — clear on any data-affecting change:**
  1. Filter change: add `setRowSelection({})` inside the existing `filterKey !== lastFilterKey` branch (line 138)
  2. Page/sort/size change: add a new standalone effect that watches `pagination.pageIndex`, `pagination.pageSize`, and `sorting` — resets selection on any change to prevent wrong-row bugs even with `getRowId` (belt-and-suspenders)
- **Do NOT expose `rowSelection` or `setRowSelection` in the return value** — consumers access selection via `table.getState().rowSelection` and `table.resetRowSelection()`. This avoids cascading re-renders through the hook chain → `useEquipmentPage` → `EquipmentPageContent` `React.memo`.

### 5c. Page hook — `use-equipment-page.tsx`

- Import `isEquipmentManagerRole` from `@/lib/rbac`
- Compute `canBulkSelect = isEquipmentManagerRole(auth.user?.role)`
- Pass `canBulkSelect` to `createEquipmentColumns({ renderActions, canBulkSelect })` (line 119)
- Expose `canBulkSelect` in return value

### 5d. Extract `EquipmentBulkDeleteBar` — **new component**

**Create:** `src/app/(app)/equipment/_components/EquipmentBulkDeleteBar.tsx`

Self-contained component that manages its own mutation and confirmation dialog (follows the established pattern where dialogs own their mutations — see `EquipmentDialogContext.tsx` lines 9-22).

```
Props: { table: Table<Equipment>, canBulkSelect: boolean, isCardView: boolean }
```

- Returns `null` when `!canBulkSelect || isCardView` (desktop-only, role-gated)
- Derives selected rows from `table.getFilteredSelectedRowModel().rows`
- Internally uses `useBulkDeleteEquipment()` hook
- Contains `AlertDialog` for confirmation (same pattern as `equipment-actions-menu.tsx` lines 160-182)
- On success: calls `table.resetRowSelection()` only (invalidation/event dispatch is owned by `useBulkDeleteEquipment` to avoid duplicate refetches)
- Renders `BulkActionBar` with a destructive delete button

### 5e. Page client — `EquipmentPageClient.tsx`

- Import `EquipmentBulkDeleteBar`
- Render between `EquipmentToolbar` (line 235) and `EquipmentColumnsDialog` (line 237) — only ~3 lines added:
  ```
  <EquipmentBulkDeleteBar table={table} canBulkSelect={canBulkSelect} isCardView={isCardView} />
  ```
- Keeps `EquipmentPageClient` lean (no mutation/dialog/state additions)

---

## Step 7: Types Update

**Modify:** `src/app/(app)/equipment/types.ts`

- Add `canBulkSelect` to `UseEquipmentPageReturn` interface

---

## Step 8: Audit Label Mapping

**Modify:** `src/hooks/use-audit-logs.ts` (line ~199, after `'equipment_restore'`)

- Add `'equipment_bulk_delete': 'Xóa hàng loạt thiết bị'` to the `actionTypeLabels` map so audit screens display a localized label instead of the raw action type key

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `supabase/migrations/YYYYMMDDHHMMSS_equipment_bulk_delete.sql` | **Create** |
| `src/app/api/rpc/[fn]/route.ts` | Add to whitelist |
| `src/components/ui/data-table-selection.tsx` | **Create** |
| `src/hooks/use-cached-equipment.ts` | Add `useBulkDeleteEquipment` hook |
| `src/components/equipment/equipment-table-columns.tsx` | Add `canBulkSelect` option |
| `src/app/(app)/equipment/_hooks/useEquipmentTable.ts` | Add row selection + `getRowId` |
| `src/app/(app)/equipment/use-equipment-page.tsx` | Wire `canBulkSelect` + expose |
| `src/app/(app)/equipment/types.ts` | Add to return type |
| `src/app/(app)/equipment/_components/EquipmentBulkDeleteBar.tsx` | **Create** |
| `src/app/(app)/equipment/_components/EquipmentPageClient.tsx` | Render `EquipmentBulkDeleteBar` |
| `src/hooks/use-audit-logs.ts` | Add `equipment_bulk_delete` label |

---

## Verification

1. **SQL:** Apply migration via MCP `apply_migration`, then test with `execute_sql`:
   - Happy path: bulk delete 3 active equipment → success
   - Empty array → error
   - Duplicate IDs in array → deduplicated, correct count
   - Already-deleted ID in batch → error (all-or-nothing) with offending IDs
   - ID from different tenant → error for non-global user
   - Array > 100 → error

2. **Typecheck:** `node scripts/npm-run.js run typecheck` — zero errors

3. **UI manual test:**
   - As `to_qltb` on desktop: see checkboxes, select 3 items, see BulkActionBar, confirm delete, verify items disappear
   - As `to_qltb` on mobile/card view: no checkboxes, no BulkActionBar
   - As `regional_leader`: no checkboxes visible
   - Change page → selection clears
   - Change filter → selection clears
   - Change sort → selection clears
   - Change page size → selection clears
   - Verify no cascading re-renders (toolbar/pagination shouldn't flicker on checkbox toggle)

4. **Targeted regression tests:**
   - `useBulkDeleteEquipment` hook: mock `callRpc`, verify correct RPC name/args, cache invalidation of all 4 query key families, custom event dispatch, toast messages (similar to patterns in `src/app/(app)/equipment/__tests__/equipmentMutations.test.ts`)
   - Selection reset behavior: verify `rowSelection` clears on filter/page/sort/size changes
   - `EquipmentBulkDeleteBar`: verify renders null for card view, renders null for non-manager roles, shows correct count, calls mutation on confirm

5. **Existing tests:** `node scripts/npm-run.js run test:run` — no regressions

---

## Review Findings Incorporated

**From user review (v3):**
- [x] SQL: `SELECT count(*) ... FOR UPDATE` replaced with two-step lock-then-validate (aggregate can't hold row locks)
- [x] Selection reset extended to sort + page-size changes (not just filter/page)
- [x] `BulkActionBar` takes `entityLabel` prop for true module reusability
- [x] Targeted regression tests added for mutation hook, selection reset, and component rendering
- [x] Audit label mapping added in `use-audit-logs.ts`

**From security review:**
- [x] Deduplicate `p_ids` array (prevents count mismatch)
- [x] `ORDER BY id` in `FOR UPDATE` (prevents deadlocks)
- [x] Batch correlation UUID in audit entries
- [x] Max batch size set to 100 (aligned with equipment page size)
- [x] Include failing IDs in error messages
- [x] Explicit `SET search_path` mention

**From architecture review:**
- [x] `getRowId: (row) => String(row.id)` (prevents index-drift bugs)
- [x] Desktop-only selection (disabled in card/mobile view)
- [x] Extract `EquipmentBulkDeleteBar` component (keeps PageClient lean)
- [x] Separate effects for filter vs page change selection reset
- [x] Don't expose `rowSelection` from hook (avoid cascading re-renders)
- [x] Single-owner invalidation: keep cache invalidation/event dispatch inside `useBulkDeleteEquipment` only
