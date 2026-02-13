# Equipment Soft Delete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hard-delete behavior for equipment with reversible soft-delete, while ensuring active equipment, dashboard, and reports surfaces exclude deleted records.

**Architecture:** Add `is_deleted boolean` to `public.thiet_bi` and convert delete to `UPDATE`-based soft-delete. Keep physical rows for referential/history integrity, then filter read RPCs and guard write workflows from targeting deleted equipment. Use sequential immutable migrations: one migration file per phase, never re-edit an already applied migration.

**Tech Stack:** Supabase Postgres (PL/pgSQL RPCs, migrations), Next.js API RPC proxy, React Query hooks, Vitest.

---

### Migration Sequencing Rule (Critical)

Use new migration files for each task below:
- `supabase/migrations/20260213093000_equipment_soft_delete_schema.sql`
- `supabase/migrations/20260213094000_equipment_soft_delete_rpcs.sql`
- `supabase/migrations/20260213095000_equipment_soft_delete_active_reads.sql`
- `supabase/migrations/20260213100000_equipment_soft_delete_report_reads.sql`
- `supabase/migrations/20260213101000_equipment_soft_delete_workflow_guards.sql`

Do not reopen and edit earlier migration versions after they are applied.

### Task 1: Add Soft-Delete Schema Flag and Indexes

**Files:**
- Create: `supabase/migrations/20260213093000_equipment_soft_delete_schema.sql`
- Create: `supabase/tests/equipment_soft_delete_schema_smoke.sql`

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

**Step 2: Add migration DDL**

```sql
ALTER TABLE public.thiet_bi
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_thiet_bi_is_deleted
  ON public.thiet_bi (is_deleted);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_active_don_vi
  ON public.thiet_bi (don_vi)
  WHERE is_deleted = false AND don_vi IS NOT NULL;
```

**Step 3: Verify import/create compatibility and backfill behavior**

Run SQL checks:
- Confirm `equipment_create(jsonb)` does not insert `is_deleted` explicitly.
- Confirm `equipment_bulk_import(jsonb)` delegates to `equipment_create(jsonb)`.
- Confirm no nulls after migration:

```sql
SELECT COUNT(*) AS null_rows
FROM public.thiet_bi
WHERE is_deleted IS NULL;
```

Expected:
- New inserts automatically get `is_deleted = false`.
- `null_rows = 0`.
- No manual backfill `UPDATE` needed.

**Step 4: Add schema smoke script**

`supabase/tests/equipment_soft_delete_schema_smoke.sql` should assert:
- column exists
- default is `false`
- null count is zero

**Step 5: Commit**

```bash
git add supabase/migrations/20260213093000_equipment_soft_delete_schema.sql supabase/tests/equipment_soft_delete_schema_smoke.sql
git commit -m "feat(db): add equipment is_deleted schema and indexes"
```

### Task 2: Convert Delete RPC and Add Restore RPC with Explicit Grants

**Files:**
- Create: `supabase/migrations/20260213094000_equipment_soft_delete_rpcs.sql`
- Modify: `src/app/api/rpc/[fn]/route.ts`
- Modify: `src/app/(app)/equipment/__tests__/equipmentMutations.test.ts`

**Step 1: Add failing SQL contract check**

```sql
-- In transaction:
-- 1) Create equipment row
-- 2) Call equipment_delete(id)
-- 3) Assert row still exists and is_deleted = true
-- 4) Call equipment_restore(id)
-- 5) Assert is_deleted = false
```

Expected before implementation: FAIL (row is physically deleted and restore RPC missing).

**Step 2: Replace hard delete with soft delete**

Implement `CREATE OR REPLACE FUNCTION public.equipment_delete(p_id bigint)`:
- preserve current role/tenant permission checks
- `UPDATE public.thiet_bi SET is_deleted = true WHERE id = p_id AND is_deleted = false`
- raise `P0002` when not found/already deleted
- return payload `{ success, id, soft_deleted: true }`

**Step 3: Add `equipment_restore` RPC**

Implement `CREATE OR REPLACE FUNCTION public.equipment_restore(p_id bigint)`:
- same authorization boundary as delete (`global` or tenant-scoped manager roles)
- `UPDATE ... SET is_deleted = false WHERE id = p_id AND is_deleted = true`
- raise `P0002` when row not found/not deleted
- return payload `{ success, id, restored: true }`

**Step 4: Add explicit permission statements**

```sql
REVOKE ALL ON FUNCTION public.equipment_restore(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_restore(BIGINT) TO authenticated;
```

Also keep existing explicit grant for `equipment_delete`.

**Step 5: Whitelist restore RPC in API proxy**

Add `'equipment_restore'` to `ALLOWED_FUNCTIONS` in `src/app/api/rpc/[fn]/route.ts`.

**Step 6: Add mutation contract tests**

Extend `src/app/(app)/equipment/__tests__/equipmentMutations.test.ts`:
- assert delete still calls `equipment_delete`
- add restore test asserting `callRpc({ fn: 'equipment_restore', args: { p_id } })`

**Step 7: Run targeted tests**

```bash
npm run test:run -- src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
```

Expected: PASS

**Step 8: Commit**

```bash
git add supabase/migrations/20260213094000_equipment_soft_delete_rpcs.sql src/app/api/rpc/[fn]/route.ts src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
git commit -m "feat(equipment): soft-delete rpc and restore rpc with explicit grants"
```

### Task 3: Exclude Deleted Rows from Core Equipment and Dashboard Reads

**Files:**
- Create: `supabase/migrations/20260213095000_equipment_soft_delete_active_reads.sql`
- Modify: `src/app/(app)/equipment/__tests__/useEquipmentData.test.ts`
- Modify: `src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts`
- Modify: `src/app/(app)/__tests__/tenant-selection.integration.test.tsx`

**Step 1: Add failing SQL visibility checks**

For a soft-deleted equipment row:
- `equipment_get(id)` should behave as not found
- `equipment_get_by_code(code)` should behave as not found
- `equipment_list_enhanced` should not include row
- `get_facilities_with_equipment_count` should not count row

**Step 2: Patch core equipment read functions**

Add active filter (`tb.is_deleted = false` or equivalent) in:
- `equipment_get`
- `equipment_get_by_code`
- `equipment_list`
- `equipment_list_enhanced`
- `equipment_count`
- `departments_list`
- `departments_list_for_tenant`
- `equipment_users_list_for_tenant`
- `equipment_locations_list_for_tenant`
- `equipment_classifications_list_for_tenant`
- `equipment_statuses_list_for_tenant`
- `equipment_funding_sources_list_for_tenant`

**Step 3: Patch dashboard/KPI selectors**

Add active filter in:
- `equipment_attention_list`
- `equipment_attention_list_paginated`
- `dashboard_equipment_total`
- `get_facilities_with_equipment_count`

**Step 4: Update tests**

- `useEquipmentData.test.ts`: include deleted-row fixture and ensure list/filter expectations reflect active-only data.
- `equipment-get-by-code-security.test.ts`: include deleted-row case -> not found.
- `tenant-selection.integration.test.tsx`: ensure facility counts exclude deleted equipment.

**Step 5: Run targeted tests**

```bash
npm run test:run -- src/app/(app)/equipment/__tests__/useEquipmentData.test.ts src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts src/app/(app)/__tests__/tenant-selection.integration.test.tsx
```

Expected: PASS

**Step 6: Commit**

```bash
git add supabase/migrations/20260213095000_equipment_soft_delete_active_reads.sql src/app/(app)/equipment/__tests__/useEquipmentData.test.ts src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts src/app/(app)/__tests__/tenant-selection.integration.test.tsx
git commit -m "fix(equipment): hide soft-deleted rows from core reads and dashboard counts"
```

### Task 4: Exclude Deleted Rows from Reports Inventory RPCs

**Files:**
- Create: `supabase/migrations/20260213100000_equipment_soft_delete_report_reads.sql`
- Create: `supabase/tests/equipment_soft_delete_reports_smoke.sql`

**Step 1: Add failing SQL report checks**

For a soft-deleted row:
- `equipment_list_for_reports` must not return it
- `equipment_count_enhanced` must not count it
- `departments_list_for_facilities` must not count it
- `equipment_aggregates_for_reports` must use active rows only
- `equipment_status_distribution` must use active rows only (all overloads still present in DB)

**Step 2: Patch report RPCs**

Add active-row filter in:
- `equipment_list_for_reports`
- `equipment_count_enhanced`
- `departments_list_for_facilities`
- `equipment_aggregates_for_reports`
- `equipment_status_distribution(p_q text, p_don_vi bigint, p_khoa_phong text, p_vi_tri text)`
- `equipment_status_distribution(p_don_vi bigint, p_khoa_phong bigint, p_vi_tri bigint)` (legacy overload, patch or retire explicitly)

**Step 3: Add report smoke script**

Create `supabase/tests/equipment_soft_delete_reports_smoke.sql` using transaction + rollback to:
- seed one active and one deleted row
- call each report RPC
- assert only active row is included/countable

**Step 4: Run SQL smoke script**

Run via Supabase MCP SQL execution or SQL editor.
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260213100000_equipment_soft_delete_report_reads.sql supabase/tests/equipment_soft_delete_reports_smoke.sql
git commit -m "fix(reports): exclude soft-deleted equipment from report rpc outputs"
```

### Task 5: Block New Workflow Writes on Soft-Deleted Equipment

**Files:**
- Create: `supabase/migrations/20260213101000_equipment_soft_delete_workflow_guards.sql`
- Create: `supabase/tests/equipment_soft_delete_workflow_guards_smoke.sql`

**Step 1: Add failing SQL guard checks**

Soft-delete equipment, then call:
- `repair_request_create(...)`
- `transfer_request_create(...)`
- `transfer_request_update(...)` when changing `thiet_bi_id`
- `usage_session_start(...)`

Expected: each rejects deleted equipment (`not found` or deleted-equipment message).

**Step 2: Patch mutation RPCs**

Require active equipment (`is_deleted = false`) in:
- `repair_request_create`
- `transfer_request_create`
- `transfer_request_update` (only when equipment target changes)
- `usage_session_start`

**Step 3: Keep historical reads unchanged**

Do not rewrite existing transfer/usage history list RPCs in this milestone.

**Step 4: Add workflow smoke script**

`supabase/tests/equipment_soft_delete_workflow_guards_smoke.sql` should:
- create test equipment
- soft-delete it
- call each workflow RPC with controlled payload
- assert each call fails
- rollback

**Step 5: Run SQL smoke script**

Run via Supabase MCP SQL execution or SQL editor.
Expected: PASS

**Step 6: Commit**

```bash
git add supabase/migrations/20260213101000_equipment_soft_delete_workflow_guards.sql supabase/tests/equipment_soft_delete_workflow_guards_smoke.sql
git commit -m "fix(workflows): reject soft-deleted equipment in repair transfer and usage start"
```

### Task 6: Add Restore Client Hook and Audit Label

**Files:**
- Modify: `src/hooks/use-cached-equipment.ts`
- Modify: `src/hooks/use-audit-logs.ts`
- Modify: `src/app/(app)/equipment/__tests__/equipmentMutations.test.ts`

**Step 1: Add failing client test**

Add test asserting restore mutation calls:
`callRpc({ fn: 'equipment_restore', args: { p_id } })`.

**Step 2: Add restore hook**

```ts
export function useRestoreEquipment() {
  return useMutation({
    mutationFn: async (id: string) =>
      callRpc({ fn: 'equipment_restore', args: { p_id: Number(id) } }),
  })
}
```

**Step 3: Add audit action label mapping**

In `ACTION_TYPE_LABELS`, add:
- `equipment_restore`: `"Khoi phuc thiet bi"`

**Step 4: Run targeted tests**

```bash
npm run test:run -- src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/use-cached-equipment.ts src/hooks/use-audit-logs.ts src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
git commit -m "feat(equipment): add restore mutation hook and audit label"
```

### Task 7: Full Regression and Type Safety

**Files:**
- Modify (if needed): `src/types/database.ts`

**Step 1: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS

**Step 2: Run high-impact frontend tests**

```bash
npm run test:run -- src/app/(app)/equipment/__tests__/useEquipmentData.test.ts src/app/(app)/equipment/__tests__/equipmentMutations.test.ts src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts src/app/(app)/__tests__/tenant-selection.integration.test.tsx
```

Expected: PASS

**Step 3: Run lint**

Run: `npm run lint`  
Expected: PASS

**Step 4: Run SQL smoke suite**

Run and capture results for:
- `supabase/tests/equipment_soft_delete_schema_smoke.sql`
- `supabase/tests/equipment_soft_delete_reports_smoke.sql`
- `supabase/tests/equipment_soft_delete_workflow_guards_smoke.sql`

Expected: PASS

**Step 5: Regenerate database types if required**

If RPC signatures changed in generated types:
- regenerate and update `src/types/database.ts`

**Step 6: Commit final verification changes**

```bash
git add -A
git commit -m "test: verify equipment soft-delete behavior across equipment reports and workflow guards"
```

### Task 8: Rollout and Safe Closeout

**Files:**
- Modify: `docs/plans/2026-02-13-equipment-soft-delete-design.md` (if assumptions changed during implementation)

**Step 1: Record rollout constraints**

Document:
- no physical purge in this milestone
- global `ma_thiet_bi` uniqueness remains unchanged
- historical rows are preserved

**Step 2: Deploy workflow**

```bash
git pull --rebase
bd sync
git push
git status
```

Expected: clean and up to date with `origin`.

**Step 3: Post-deploy SQL checks**

Validate by tenant:
- active vs deleted counts
- equipment page list/search excludes deleted rows
- reports counts exclude deleted rows
- restore returns row to active surfaces

**Step 4: File follow-up issues**

Create issues for:
- Trash UI and restore UX
- retention-based hard purge job
- optional partial unique index strategy if code reuse policy changes

**Step 5: Commit documentation note (if changed)**

```bash
git add docs/plans/2026-02-13-equipment-soft-delete-design.md
git commit -m "docs: update soft-delete rollout notes after implementation"
```

Plan complete and saved to `docs/plans/2026-02-13-equipment-soft-delete.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
