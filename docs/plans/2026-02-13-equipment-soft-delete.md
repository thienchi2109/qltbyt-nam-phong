# Equipment Soft Delete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hard-delete behavior for equipment with reversible soft-delete, while ensuring all active inventory screens, filters, and KPI counters exclude deleted records.

**Architecture:** Add `is_deleted boolean` to `public.thiet_bi` and move delete behavior to `UPDATE`-based soft-delete. Keep physical rows for referential/history integrity, then systematically filter operational RPCs (`equipment_*`, dashboards, selectors) and guard creation workflows (repair/transfer/usage start) from soft-deleted IDs.

**Tech Stack:** Supabase Postgres (PL/pgSQL RPCs, migrations), Next.js API RPC proxy, React Query hooks, Vitest.

---

### Task 1: Add Soft-Delete Schema Columns and Indexes

**Files:**
- Create: `supabase/migrations/20260213093000_equipment_soft_delete.sql`
- Test: `supabase/migrations/20260213093000_equipment_soft_delete.sql` (inline verification queries in transaction comments)

**Step 1: Write failing schema assertion (pre-migration)**

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'thiet_bi'
      AND column_name = 'is_deleted'
  ) THEN
    RAISE EXCEPTION 'is_deleted already exists';
  END IF;
END $$;
```

**Step 2: Run assertion and confirm current state**

Run: execute via SQL editor / MCP SQL  
Expected: PASS (column missing today)

**Step 3: Add migration DDL**

```sql
ALTER TABLE public.thiet_bi
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_thiet_bi_is_deleted
  ON public.thiet_bi (is_deleted);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_active_don_vi
  ON public.thiet_bi (don_vi)
  WHERE is_deleted = false AND don_vi IS NOT NULL;
```

**Step 4: Verify new columns exist**

Run: query `information_schema.columns` for `is_deleted`  
Expected: 1 row returned

**Step 4.1: Verify import/create compatibility**

Run SQL checks:
- Confirm `equipment_create(jsonb)` does not insert `is_deleted` explicitly.
- Confirm `equipment_bulk_import(jsonb)` delegates to `equipment_create(jsonb)`.

Expected:
- New inserts automatically get `is_deleted = false` via column default.
- No app code change is required for single import or bulk import just for this column.

**Step 4.2: Backfill decision for existing rows**

With `ADD COLUMN is_deleted boolean NOT NULL DEFAULT false`, Postgres sets existing rows to `false` logically at migration time.
Expected:
- No manual `UPDATE` backfill is required.
- Optional verification query after migration:

```sql
SELECT COUNT(*) AS null_rows
FROM public.thiet_bi
WHERE is_deleted IS NULL;
```

Expected result: `0`

**Step 5: Commit**

```bash
git add supabase/migrations/20260213093000_equipment_soft_delete.sql
git commit -m "feat(db): add equipment is_deleted soft-delete flag and indexes"
```

### Task 2: Convert Delete RPC to Soft-Delete and Add Restore RPC

**Files:**
- Modify: `supabase/migrations/20260213093000_equipment_soft_delete.sql`
- Modify: `src/app/api/rpc/[fn]/route.ts`
- Test: `src/app/(app)/equipment/__tests__/equipmentMutations.test.ts`

**Step 1: Add failing behavior check for delete contract**

```sql
-- In a transaction:
-- 1) create test equipment
-- 2) call equipment_delete(id)
-- 3) assert row still exists and is_deleted = true
```

Expected before implementation: FAIL (row is physically deleted).

**Step 2: Replace hard delete with soft delete**

```sql
CREATE OR REPLACE FUNCTION public.equipment_delete(p_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- existing permission checks...
  UPDATE public.thiet_bi
  SET is_deleted = true
  WHERE id = p_id
    AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found or already deleted' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('success', true, 'id', p_id, 'soft_deleted', true);
END;
$$;
```

**Step 3: Add `equipment_restore` RPC**

```sql
CREATE OR REPLACE FUNCTION public.equipment_restore(p_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- admin/global/to_qltb permission check
  UPDATE public.thiet_bi
  SET is_deleted = false
  WHERE id = p_id
    AND is_deleted = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deleted equipment not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('success', true, 'id', p_id, 'restored', true);
END;
$$;
```

**Step 4: Whitelist restore RPC in API proxy**

```ts
// src/app/api/rpc/[fn]/route.ts
'equipment_restore',
```

**Step 5: Commit**

```bash
git add supabase/migrations/20260213093000_equipment_soft_delete.sql src/app/api/rpc/[fn]/route.ts src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
git commit -m "feat(equipment): switch to soft-delete and add restore rpc"
```

### Task 3: Exclude Deleted Equipment from Core Inventory Read RPCs

**Files:**
- Modify: `supabase/migrations/20260213093000_equipment_soft_delete.sql`
- Test: `src/app/(app)/equipment/__tests__/useEquipmentData.test.ts`
- Test: `src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts`

**Step 1: Add failing check for list/get visibility**

```sql
-- For a soft-deleted equipment row:
-- equipment_get(id) should raise not found
-- equipment_get_by_code(code) should raise not found
-- equipment_list_enhanced should not include row
```

**Step 2: Update core functions to filter active rows**

Apply `AND tb.is_deleted = false` (or equivalent) in:
- `equipment_get`
- `equipment_get_by_code`
- `equipment_list`
- `equipment_list_enhanced`
- `departments_list`
- `departments_list_for_tenant`
- `equipment_users_list_for_tenant`
- `equipment_locations_list_for_tenant`
- `equipment_classifications_list_for_tenant`
- `equipment_statuses_list_for_tenant`
- `equipment_funding_sources_list_for_tenant`

**Step 3: Update KPI/filter functions**

Add active-row filter in:
- `equipment_attention_list`
- `equipment_attention_list_paginated`
- `dashboard_equipment_total`
- `get_facilities_with_equipment_count`
- `equipment_status_distribution`
- `equipment_aggregates_for_reports`

**Step 4: Run targeted tests**

Run:
```bash
npm run test:run -- src/app/(app)/equipment/__tests__/useEquipmentData.test.ts src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260213093000_equipment_soft_delete.sql src/app/(app)/equipment/__tests__/useEquipmentData.test.ts src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts
git commit -m "fix(equipment): hide soft-deleted rows from active inventory reads and kpis"
```

### Task 4: Prevent New Workflows from Targeting Soft-Deleted Equipment

**Files:**
- Modify: `supabase/migrations/20260213093000_equipment_soft_delete.sql`
- Test: `src/components/__tests__/qr-action-sheet.test.tsx`

**Step 1: Add failing guard checks**

```sql
-- Soft-delete equipment then call:
-- repair_request_create(...)
-- transfer_request_create(...)
-- usage_session_start(...)
-- Expect each to reject with not found / deleted message.
```

**Step 2: Add deleted-state guard to mutation RPCs**

Patch these functions to require active equipment rows (`is_deleted = false`):
- `repair_request_create`
- `transfer_request_create`
- `transfer_request_update` (when `thiet_bi_id` is changed)
- `usage_session_start`

**Step 3: Keep historical list functions unchanged**

Do not filter deleted equipment out of existing historical transfer/usage rows unless product explicitly requires archival hiding.

**Step 4: Run regression tests**

Run:
```bash
npm run test:run -- src/components/__tests__/qr-action-sheet.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260213093000_equipment_soft_delete.sql src/components/__tests__/qr-action-sheet.test.tsx
git commit -m "fix(workflows): block repair transfer and usage-start for soft-deleted equipment"
```

### Task 5: Add Operational Restore/Trash Follow-Up Hooks (Backend-First)

**Files:**
- Modify: `src/hooks/use-cached-equipment.ts`
- Modify: `src/hooks/use-audit-logs.ts`

**Step 1: Add failing client contract test for restore RPC call**

Add a test case asserting `callRpc({ fn: 'equipment_restore', args: { p_id } })` is used.

**Step 2: Add restore mutation hook**

```ts
export function useRestoreEquipment() {
  return useMutation({
    mutationFn: async (id: string) =>
      callRpc({ fn: 'equipment_restore', args: { p_id: Number(id) } }),
  })
}
```

**Step 3: Align audit action label**

Add optional label mapping:
- `equipment_restore`: `"Khoi phuc thiet bi"`

**Step 4: Run targeted unit tests**

Run:
```bash
npm run test:run -- src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/use-cached-equipment.ts src/hooks/use-audit-logs.ts src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
git commit -m "feat(equipment): add restore mutation client contract"
```

### Task 6: Full Regression and Type Safety

**Files:**
- Modify (if needed): `src/types/database.ts` (only if regenerated types are required)

**Step 1: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS

**Step 2: Run high-impact regression suites**

Run:
```bash
npm run test:run -- src/app/(app)/equipment/__tests__/useEquipmentData.test.ts src/app/(app)/equipment/__tests__/equipmentMutations.test.ts src/components/__tests__/qr-action-sheet.test.tsx src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts
```

Expected: PASS

**Step 3: Run lint**

Run: `npm run lint`  
Expected: PASS

**Step 4: Manual SQL smoke checks on deployed branch/project**

Validate:
- soft-delete marks row, does not remove row
- deleted row absent from equipment list and search
- restore makes row visible again

**Step 5: Commit final fixes**

```bash
git add -A
git commit -m "test: validate soft-delete behavior across equipment flows"
```

### Task 7: Session Closeout and Safe Rollout

**Files:**
- Modify: `docs/plans/2026-02-13-equipment-soft-delete-design.md` (mark implementation decisions)

**Step 1: Document rollout constraints**

Record:
- No physical purge in this milestone
- `ma_thiet_bi` uniqueness remains global
- historical rows preserved

**Step 2: Run migration deploy flow**

Run:
```bash
git pull --rebase
bd sync
git push
git status
```

Expected: clean, up-to-date with `origin`

**Step 3: Post-deploy verification queries**

Check active/deleted counts by tenant and key screens.

**Step 4: File follow-up issues**

Create issues for:
- optional "Trash" UI and restore workflow
- optional hard-purge retention job
- optional partial unique index if code reuse is needed

**Step 5: Commit documentation note (if changed)**

```bash
git add docs/plans/2026-02-13-equipment-soft-delete-design.md
git commit -m "docs: record soft-delete rollout assumptions and follow-ups"
```

Plan complete and saved to `docs/plans/2026-02-13-equipment-soft-delete.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
