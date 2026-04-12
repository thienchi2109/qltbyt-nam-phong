# Issue 237 Repair Request Cost Statistics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add optional repair cost capture at request completion and expose the cost in repair statistics and export flows.

**Architecture:** Split implementation into two batches. Batch 1 owns the database contract, hardened RPC migration, SQL smoke tests, and report JSON payloads. Batch 2 owns TypeScript types, completion-dialog UX, report/export rendering, and focused React/Vitest coverage after the backend contract is stable.

**Tech Stack:** Supabase Postgres RPCs/migrations, SQL smoke tests, Next.js App Router, React, TanStack Query, Vitest, React Doctor, OpenSpec.

**Issue:** GitHub #237, "MVP: thêm chi_phi_sua_chua vào yeu_cau_sua_chua để thống kê chi phí sửa chữa".

**Key decisions:**
- `chi_phi_sua_chua` is a final completion-time value, not an approval-time estimate.
- Do not add the cost field to create, update, or approve dialogs.
- Show optional "Tổng chi phí sửa chữa" only in the completion dialog when the user is about to mark a request `Hoàn thành`.
- Blank UI input sends SQL `NULL`; explicit `0` sends numeric `0`.
- DB column is nullable and has default `0` for future omitted inserts, but existing rows must remain `NULL`.
- No DB backfill for already completed repair requests.

---

## OpenSpec Tracking

Change ID: `add-repair-request-cost-statistics`

- [ ] 1. Backend batch complete
- [x] 1.1 Write SQL smoke tests for cost schema, completion write contract, terminal lock, and report aggregates.
- [x] 1.2 Add migration for `yeu_cau_sua_chua.chi_phi_sua_chua`.
- [x] 1.3 Recreate `repair_request_complete` with optional cost while preserving hardened security.
- [x] 1.4 Extend repair list/detail/report RPC payloads with cost fields and counts.
- [ ] 1.5 Run SQL smoke tests and Supabase security advisors.
- [ ] 2. Frontend batch complete
- [ ] 2.1 Add cost parser/formatter tests and helper.
- [ ] 2.2 Update completion mutation contract and completion dialog UX.
- [ ] 2.3 Update repair request types and detail display.
- [ ] 2.4 Update maintenance report/export types and rendering.
- [ ] 2.5 Run required TypeScript/React verification gates.

## Batch 1: Backend

### Task 1: Add failing SQL smoke coverage

**Files:**
- Create: `supabase/tests/repair_request_cost_smoke.sql`
- Reference: `supabase/tests/repair_request_lifecycle_audit_smoke.sql`
- Reference: latest local repair lifecycle migrations under `supabase/migrations/20260406*.sql`

- [ ] **Step 1: Write the failing smoke test**

Cover these cases:
- `public.yeu_cau_sua_chua` has `chi_phi_sua_chua numeric(14,2) NULL DEFAULT 0`.
- Existing rows created before the migration remain `NULL`.
- Completing with `p_chi_phi_sua_chua := NULL` stores `NULL`.
- Completing with `p_chi_phi_sua_chua := 0` stores `0`.
- Completing with a positive value stores that numeric value.
- Negative cost is rejected.
- A terminal request cannot be completed again to change cost.
- Tenant-scoped users cannot complete another tenant's request.
- Missing role or missing `user_id` claims are rejected.

- [ ] **Step 2: Run the smoke test and confirm the intended red state**

Run against the dev database:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/repair_request_cost_smoke.sql
```

Expected: FAIL because the column/signature/cost behavior does not exist yet, not because fixture setup or JWT claims are broken.

### Task 2: Add schema and hardened completion RPC migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_repair_request_cost_statistics.sql`
- Reference: `supabase/migrations/20260406082735_fix_repair_request_complete_idempotency.sql`
- Reference: `supabase/migrations/20260406103000_fix_repair_request_update_approve_audit_fail_closed.sql`

- [ ] **Step 1: Add the column without backfilling old rows**

Use the two-step pattern:

```sql
ALTER TABLE public.yeu_cau_sua_chua
  ADD COLUMN IF NOT EXISTS chi_phi_sua_chua numeric(14,2) NULL;

ALTER TABLE public.yeu_cau_sua_chua
  ALTER COLUMN chi_phi_sua_chua SET DEFAULT 0;

ALTER TABLE public.yeu_cau_sua_chua
  ADD CONSTRAINT yeu_cau_sua_chua_chi_phi_sua_chua_non_negative
  CHECK (chi_phi_sua_chua IS NULL OR chi_phi_sua_chua >= 0);
```

- [ ] **Step 2: Replace `repair_request_complete` contract**

Drop the old overload and recreate:

```sql
DROP FUNCTION IF EXISTS public.repair_request_complete(integer, text, text);
CREATE OR REPLACE FUNCTION public.repair_request_complete(
  p_id integer,
  p_completion text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_chi_phi_sua_chua numeric DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
-- Port the full current hardened body, then add cost validation/write.
$$;
```

Keep the current lifecycle behavior:
- validate JWT role and normalized `user_id` before business logic
- keep `admin` and `global` behavior
- keep explicit non-global tenant guard
- keep current `regional_leader` write rejection
- lock request/equipment rows with `FOR UPDATE`
- reject terminal states
- keep equipment status updates, `lich_su_thiet_bi`, and audit log writes

Add only the new cost behavior:
- if derived status is `Hoàn thành`, set `chi_phi_sua_chua = p_chi_phi_sua_chua`
- if derived status is `Không HT`, leave `chi_phi_sua_chua` as `NULL`
- reject `p_chi_phi_sua_chua < 0`
- include `chi_phi_sua_chua` in completion audit details for the `Hoàn thành` path

- [ ] **Step 3: Run SQL smoke test**

Run:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/repair_request_cost_smoke.sql
```

Expected: schema and completion-cost cases pass.

### Task 3: Extend repair read/report RPC payloads

**Files:**
- Modify in the same migration: `repair_request_list`
- Modify in the same migration: `get_maintenance_report_data(date,date,bigint)`
- Modify in the same migration: `maintenance_stats_for_reports(date,date,bigint,text)`

- [ ] **Step 1: Add list payload support**

Add `chi_phi_sua_chua` to the JSON rows returned by `repair_request_list`.

If the function body is replaced, also update raw `ILIKE` pattern building to use `public._sanitize_ilike_pattern()` according to the repo SQL safety rule.

- [ ] **Step 2: Add report aggregates**

Use these semantics:
- total: `COALESCE(SUM(chi_phi_sua_chua), 0)`
- average: `AVG(chi_phi_sua_chua)` so missing values are excluded
- `cost_recorded_count`: completed requests where `chi_phi_sua_chua IS NOT NULL`
- `cost_missing_count`: completed requests where `chi_phi_sua_chua IS NULL`
- cost by month/facility/equipment follows the same `NULL` semantics

- [ ] **Step 3: Preserve report security contracts**

For every recreated report RPC:
- keep `SECURITY DEFINER`
- add/keep `SET search_path = public, pg_temp`
- validate role/user claims according to the nearest existing hardened report function
- preserve global/admin/regional/tenant scoping
- do not add a generic `don_vi` guard where scope is derived from an approved multi-tenant facility helper

- [ ] **Step 4: Run SQL smoke test and security advisor**

Run:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/repair_request_cost_smoke.sql
```

Then run Supabase MCP `get_advisors(security)` for project `cdthersvldpnlbvpufrr`.

Expected: smoke test passes and no new security advisor regression is introduced.

## Batch 2: Frontend

Start this batch only after Batch 1 is green and the RPC payload shape is stable.

### Task 4: Add cost formatting/parsing helper

**Files:**
- Create: `src/app/(app)/repair-requests/_utils/repairRequestCost.ts`
- Create: `src/app/(app)/repair-requests/_utils/repairRequestCost.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:
- `"1.234.567"` parses to `1234567`
- `"0"` parses to `0`
- empty string parses to `null`
- negative values fail validation
- non-numeric values fail validation
- `1234567` formats as `"1.234.567"`

- [ ] **Step 2: Implement helper**

Keep the helper independent from React:
- `parseRepairCostInput(input: string): number | null`
- `formatRepairCostInput(value: number | null): string`
- `formatRepairCostDisplay(value: number | null): string`

- [ ] **Step 3: Run focused helper test**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/_utils/repairRequestCost.test.ts"
```

Expected: PASS.

### Task 5: Wire completion dialog and mutation contract

**Files:**
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsCompleteDialog.tsx`
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`
- Modify or add focused tests under `src/app/(app)/repair-requests/__tests__/`

- [ ] **Step 1: Write failing dialog/mutation tests**

Cover:
- cost field is visible only when completion type is `Hoàn thành`
- helper text recommends entering total repair cost for statistics/analysis
- blank cost submits `p_chi_phi_sua_chua: null`
- `"0"` submits `p_chi_phi_sua_chua: 0`
- `"1.234.567"` submits `p_chi_phi_sua_chua: 1234567`
- `Không HT` does not submit a cost value

- [ ] **Step 2: Implement minimal UI and mutation changes**

Update the complete mutation payload to pass `p_chi_phi_sua_chua` to `repair_request_complete`.

Keep layout stable and do not add nested cards. If `RepairRequestsContext.tsx` grows further beyond the 350-line soft threshold, extract mutation types/helpers rather than expanding it heavily.

- [ ] **Step 3: Run focused tests**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__"
```

Expected: completion-cost tests pass without regressing existing repair request tests.

### Task 6: Add repair detail and data type support

**Files:**
- Modify: `src/app/(app)/repair-requests/types.ts`
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsDetailContent.tsx`
- Modify or add focused tests under `src/app/(app)/repair-requests/__tests__/`

- [ ] **Step 1: Write failing type/display tests**

Cover:
- `RepairRequestWithEquipment` accepts `chi_phi_sua_chua: number | null`
- detail view displays `0` as a real zero cost
- detail view displays `NULL` as no recorded cost data

- [ ] **Step 2: Implement minimal display**

Use `formatRepairCostDisplay()` from the shared helper.

- [ ] **Step 3: Run focused tests**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__"
```

Expected: PASS.

### Task 7: Update maintenance reports and export

**Files:**
- Modify: `src/app/(app)/reports/hooks/use-maintenance-stats.ts`
- Modify: `src/app/(app)/reports/hooks/use-maintenance-data.ts`
- Modify: `src/app/(app)/reports/components/maintenance-report-tab.tsx`
- Modify: `src/app/(app)/reports/components/export-report-dialog.utils.ts`
- Modify or add focused report/export tests

- [ ] **Step 1: Write failing report/export tests**

Cover:
- report hook types include total cost, average completed cost, recorded count, and missing count
- maintenance report UI renders total cost and average completed cost
- export sheet includes cost summary rows
- export sheet preserves existing rows and labels

- [ ] **Step 2: Implement minimal report rendering**

Avoid growing report components past the file-size ceiling. If a report component is already above the 350-line soft threshold, extract a small cost summary component/helper before adding UI blocks.

- [ ] **Step 3: Run focused report/export tests**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/reports"
```

Expected: report and export tests pass.

## Final Verification

- [ ] Run explicit-any gate:

```bash
node scripts/npm-run.js run verify:no-explicit-any
```

- [ ] Run typecheck:

```bash
node scripts/npm-run.js run typecheck
```

- [ ] Run focused SQL smoke test:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/repair_request_cost_smoke.sql
```

- [ ] Run focused Vitest suites for repair requests and reports:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests" "src/app/(app)/reports"
```

- [ ] Run React Doctor diff scan:

```bash
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

- [ ] Run Supabase MCP security advisors after applying the migration:

```text
Supabase MCP: get_advisors(security), project_id = cdthersvldpnlbvpufrr
```

- [ ] Validate OpenSpec:

```bash
openspec validate add-repair-request-cost-statistics --strict
```

- [ ] Commit backend and frontend batches separately if implemented in separate sessions.
