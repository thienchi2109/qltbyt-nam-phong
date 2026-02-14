# Equipment Soft Delete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hard-delete behavior for equipment with reversible soft-delete, expose `Xóa TB` in row action menu for authorized roles, and ensure active equipment/dashboard/reports surfaces exclude deleted records.

**Architecture:** Add `is_deleted boolean` to `public.thiet_bi` and convert delete to `UPDATE`-based soft-delete. Keep physical rows for referential/history integrity, then filter read RPCs and guard write workflows from targeting deleted equipment. Add row-level UI delete action (`Xóa TB`) in equipment action menu with RBAC visibility + confirmation. Use sequential immutable migrations: one migration file per phase, never re-edit an already applied migration.

**Tech Stack:** Supabase Postgres (PL/pgSQL RPCs, migrations), Next.js API RPC proxy, React Query hooks, Vitest.

---

### Migration Sequencing Rule (Critical)

Use new migration files for each task below:
- `supabase/migrations/20260213093000_equipment_soft_delete_schema.sql`
- `supabase/migrations/20260213094000_equipment_soft_delete_rpcs.sql`
- `supabase/migrations/20260213095000_equipment_soft_delete_active_reads.sql`
- `supabase/migrations/20260213100000_equipment_soft_delete_report_reads.sql`
- `supabase/migrations/20260213100500_equipment_soft_delete_historical_read_policy.sql`
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

**Step 3.1: Lock phase-1 equipment code policy**

Run SQL checks:
- confirm global unique constraint still exists on `ma_thiet_bi`
- confirm no partial unique index on active rows is introduced in this milestone

Expected:
- phase-1 behavior is explicit: deleted equipment code still blocks reuse
- follow-up issue for partial unique index remains tracked for later policy change

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

### Task 2: Convert Delete/Restore RPCs with Restore Safety, Audit Trail, and Explicit Grants

**Files:**
- Create: `supabase/migrations/20260213094000_equipment_soft_delete_rpcs.sql`
- Create: `supabase/tests/equipment_soft_delete_delete_restore_audit_smoke.sql`
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

**Step 2: Replace hard delete with soft delete + audit log**

Implement `CREATE OR REPLACE FUNCTION public.equipment_delete(p_id bigint)`:
- preserve current role/tenant permission checks
- `UPDATE public.thiet_bi SET is_deleted = true WHERE id = p_id AND is_deleted = false`
- raise `P0002` when not found/already deleted
- write audit entry via `public.audit_log('equipment_delete', 'equipment', p_id, ..., details_jsonb)`
- return payload `{ success, id, soft_deleted: true }`

**Step 3: Add `equipment_restore` RPC with safety checks + audit log**

Implement `CREATE OR REPLACE FUNCTION public.equipment_restore(p_id bigint)`:
- same authorization boundary as delete (`global` or tenant-scoped manager roles)
- lock/load target row first (`FOR UPDATE`) before restore
- validate target row tenant still exists and is active (`public.don_vi.active = true`)
- `UPDATE ... SET is_deleted = false WHERE id = p_id AND is_deleted = true`
- raise `P0002` when row not found/not deleted
- raise business error when tenant is inactive/missing
- write audit entry via `public.audit_log('equipment_restore', 'equipment', p_id, ..., details_jsonb)`
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

**Step 7: Add SQL smoke checks for audit + restore safety**

Create `supabase/tests/equipment_soft_delete_delete_restore_audit_smoke.sql` to validate:
- delete marks `is_deleted = true`
- restore marks `is_deleted = false`
- delete/restore each insert one audit row in `public.audit_logs` with matching action type + entity
- restore fails for inactive tenant rows (controlled test fixture)

**Step 8: Run targeted tests**

```bash
npm run test:run -- src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
```

Expected: PASS

**Step 9: Commit**

```bash
git add supabase/migrations/20260213094000_equipment_soft_delete_rpcs.sql supabase/tests/equipment_soft_delete_delete_restore_audit_smoke.sql src/app/api/rpc/[fn]/route.ts src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
git commit -m "feat(equipment): soft-delete restore safety and audit logging"
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

### Task 5: Classify and Stabilize Historical RPCs That Join `thiet_bi`

**Files:**
- Create: `supabase/migrations/20260213100500_equipment_soft_delete_historical_read_policy.sql`
- Create: `supabase/tests/equipment_soft_delete_historical_reads_smoke.sql`

**Step 1: Build policy matrix for join-based RPCs**

Document in migration comments and test notes:
- active-only surfaces: must filter `tb.is_deleted = false`
- historical surfaces: keep rows, no hard filtering by `tb.is_deleted`

Historical set in this milestone:
- `equipment_history_list`
- `repair_request_list`
- `transfer_request_list`
- `transfer_request_list_enhanced`
- `usage_log_list` (all overloads)

**Step 2: Patch historical RPCs for stability (not active-only filtering)**

For the historical set:
- ensure soft-deleted equipment does not break list responses
- ensure joins do not accidentally drop historical rows required for workflow history
- if needed, expose a derived flag (for example `equipment_is_deleted`) without removing rows

**Step 3: Add historical read smoke script**

Create `supabase/tests/equipment_soft_delete_historical_reads_smoke.sql`:
- create equipment + dependent historical rows
- soft-delete equipment
- call each historical RPC
- assert responses still return historical records and no errors

**Step 4: Run SQL smoke script**

Run via Supabase MCP SQL execution or SQL editor.  
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260213100500_equipment_soft_delete_historical_read_policy.sql supabase/tests/equipment_soft_delete_historical_reads_smoke.sql
git commit -m "fix(history): preserve historical rpc behavior after equipment soft-delete"
```

### Task 6: Block New Workflow Writes on Soft-Deleted Equipment

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

### Task 7: Add `Xóa TB` in Equipment Row Action Menu

**Files:**
- Modify: `src/components/equipment/equipment-actions-menu.tsx`
- Modify (if needed): `src/hooks/use-cached-equipment.ts`
- Create: `src/app/(app)/equipment/__tests__/equipment-actions-menu.test.tsx`
- Modify: `src/app/(app)/equipment/__tests__/equipmentMutations.test.ts`

**Step 1: Add failing row-action tests**

Create tests for `equipment-actions-menu`:
- shows `Xóa TB` for `global`
- shows `Xóa TB` for `to_qltb`
- hides `Xóa TB` for `regional_leader`
- hides `Xóa TB` for `user`
- selecting `Xóa TB` and confirming calls delete mutation for the row ID
- selecting `Xóa TB` and canceling confirmation does not call delete mutation

**Step 2: Implement row delete action**

In `equipment-actions-menu.tsx`:
- import and use delete mutation hook
- add role allowlist check (`global` and `to_qltb`)
- add row menu item label: `Xóa TB`
- on select:
  - ask for confirmation
  - call soft-delete mutation (`equipment_delete`) for current row
- disable the action while delete mutation is pending

**Step 3: Keep non-authorized experience safe**

For non-authorized roles (`regional_leader`, `technician`, `user`):
- do not render `Xóa TB` action in row menu

**Step 4: Run targeted tests**

```bash
npm run test:run -- src/app/(app)/equipment/__tests__/equipment-actions-menu.test.tsx src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/equipment/equipment-actions-menu.tsx src/hooks/use-cached-equipment.ts src/app/(app)/equipment/__tests__/equipment-actions-menu.test.tsx src/app/(app)/equipment/__tests__/equipmentMutations.test.ts
git commit -m "feat(equipment-ui): add row action soft-delete for authorized roles"
```

### Task 8: Add Restore Client Hook and Audit Label

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

### Task 9: Full Regression and Type Safety

**Files:**
- Modify (if needed): `src/types/database.ts`
- Test: `src/app/(app)/equipment/__tests__/useEquipmentData.test.ts`
- Test: `src/app/(app)/equipment/__tests__/equipmentMutations.test.ts`
- Test: `src/app/(app)/equipment/__tests__/equipment-actions-menu.test.tsx`
- Test: `src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts`
- Test: `src/app/(app)/__tests__/tenant-selection.integration.test.tsx`
- Test: `supabase/tests/equipment_soft_delete_schema_smoke.sql`
- Test: `supabase/tests/equipment_soft_delete_delete_restore_audit_smoke.sql`
- Test: `supabase/tests/equipment_soft_delete_reports_smoke.sql`
- Test: `supabase/tests/equipment_soft_delete_historical_reads_smoke.sql`
- Test: `supabase/tests/equipment_soft_delete_workflow_guards_smoke.sql`
- Create/Modify: `supabase/tests/equipment_soft_delete_performance.sql`

**Step 1: Run high-impact frontend tests**

```bash
npm run test:run -- src/app/(app)/equipment/__tests__/useEquipmentData.test.ts src/app/(app)/equipment/__tests__/equipmentMutations.test.ts src/app/(app)/equipment/__tests__/equipment-actions-menu.test.tsx src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts src/app/(app)/__tests__/tenant-selection.integration.test.tsx
```

Expected: PASS for all 5 suites (active-list filtering, row delete action visibility + invocation, delete/restore mutation contract, get-by-code deleted-row behavior, tenant equipment counts).

**Step 2: Run lint**

Run: `npm run lint`  
Expected: PASS

**Step 3: Run SQL smoke suite**

Run:
```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/equipment_soft_delete_schema_smoke.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/equipment_soft_delete_delete_restore_audit_smoke.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/equipment_soft_delete_reports_smoke.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/equipment_soft_delete_historical_reads_smoke.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/equipment_soft_delete_workflow_guards_smoke.sql
```

Expected: PASS (no `ERROR:` output; each script assertions succeed).

**Step 4: Run performance gate (EXPLAIN ANALYZE)**

Prepare `supabase/tests/equipment_soft_delete_performance.sql` to:
- run representative `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` probes
- capture baseline section and post-change section for comparison

Run:
```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/equipment_soft_delete_performance.sql
```

Include at minimum:
- `equipment_list_enhanced`
- `equipment_count_enhanced`
- `get_facilities_with_equipment_count`
- `equipment_list_for_reports`

Expected:
- no material regression vs baseline snapshot (target <= 25% slower on representative fixture data)
- no unexpected full-table scan on `thiet_bi` for tenant-filtered queries

**Step 5: Regenerate DB types and verify**

Run:
```bash
npm run db:types
npm run typecheck
```

Expected:
- `src/types/database.ts` updated (if RPC signatures changed)
- typecheck remains PASS after regeneration

**Step 6: Commit final verification changes**

```bash
git add -A
git commit -m "test: verify equipment soft-delete behavior across equipment reports and workflow guards"
```

### Task 10: Rollout and Safe Closeout

**Files:**
- Modify: `docs/plans/2026-02-13-equipment-soft-delete-design.md` (if assumptions changed during implementation)

**Step 1: Record rollout constraints**

Document:
- no physical purge in this milestone
- global `ma_thiet_bi` uniqueness remains unchanged
- historical rows are preserved
- code reuse policy in phase 1: deleted code is not reusable until partial-unique follow-up is delivered

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
- equipment row action menu shows `Xóa TB` for `global`/`to_qltb` and hides it for `regional_leader`/`user`
- reports counts exclude deleted rows
- restore returns row to active surfaces
- delete/restore actions are visible in `audit_logs` with expected action types
- historical list RPCs (`repair_request_list`, `transfer_request_list`, `usage_log_list`, `equipment_history_list`) still return data without regression

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
