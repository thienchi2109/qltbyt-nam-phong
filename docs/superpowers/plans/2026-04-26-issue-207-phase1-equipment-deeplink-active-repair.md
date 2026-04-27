# Issue #207 Phase 1 — Equipment Detail deep-link to active repair request — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From Equipment Detail of an equipment whose status is `"Chờ sửa chữa"`, expose a button that opens the **active** repair request (`trang_thai IN ('Chờ xử lý','Đã duyệt')`) in a side sheet, without leaving the Equipments page.

**Architecture:** Introduce a shared module `src/components/equipment-linked-request/` (Provider + Button + SheetHost + adapter + resolver hook) so Phase 2/3 (transfers, maintenance) can plug in new resolvers without re-architecting. New backend RPC `repair_request_active_for_equipment(p_thiet_bi_id INT) RETURNS JSONB` resolves the active record per equipment with the `repair_request_list`-style tenant guard. The side sheet reuses `RepairRequestsDetailView` unchanged via a `next/dynamic` adapter so equipment route bundle stays clean. Read/detail parity only — mutations are not surfaced inside the sheet for Phase 1.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript strict, Supabase Postgres (RPC-only via `/api/rpc/[fn]` proxy), TanStack Query v5, NextAuth, Tailwind + Radix UI, Vitest 4, `@testing-library/react@16`, `@testing-library/user-event@14`.

**Spec:** `docs/superpowers/specs/2026-04-26-issue-207-phase1-equipment-deeplink-active-repair-design.md` (commits `9a1c1c1`, `1144fb4`, `30c25e2`, `af37131`).

**Pre-applied work (do not redo):** commit `66bb762` aligned `useUpdateRepairRequest` to invalidate `repairKeys.all` and added `src/hooks/__tests__/use-cached-repair.invalidation.test.ts` pinning the contract for all five repair-request mutations. The rest of the plan assumes this is already in place.

---

## Working environment

- Branch: `main` is acceptable (no worktree was created during brainstorming). If you prefer a worktree, follow `superpowers:using-git-worktrees` before starting.
- Always invoke npm/npx through the helper: `node scripts/npm-run.js run <script>` and `node scripts/npm-run.js npx <command>`. Direct `npm` / `npx` calls do not return stdout reliably in this environment.
- All DB operations go through Supabase MCP (project ID `cdthersvldpnlbvpufrr`). **Never** invoke the Supabase CLI for DDL / data operations from an agent session.
- Per-task verification (TS / TSX changes): run in this exact order — `verify:no-explicit-any` → `typecheck` → focused `test:run` → (final task only) `react-doctor --diff main`.
- Frequent commits: every TDD red→green→refactor cycle ends in a commit. Use Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Co-author footer is required for all commits per repo policy.

## Active definition (constant for all tasks)

`'Chờ xử lý' OR 'Đã duyệt'`. This is the canonical convention used by `src/components/repair-request-alert.tsx:25` and `src/components/notification-bell-dialog.tsx:44`. Do not invent a new constant.

---

## Chunk 1: Foundation — helper rename, backend RPC, smoke SQL, whitelist

This chunk delivers the foundation that every later chunk depends on. After this chunk, the new RPC exists on the live DB and the helper module is renamed; no UI feature is yet visible to users.

**Files in this chunk:**

- Rename: `src/lib/repair-request-create-intent.ts` → `src/lib/repair-request-deep-link.ts`
- Rename: `src/lib/__tests__/repair-request-create-intent.test.ts` → `src/lib/__tests__/repair-request-deep-link.test.ts`
- Rename: `src/lib/__tests__/repair-request-create-intent.adoption.test.ts` → `src/lib/__tests__/repair-request-deep-link.adoption.test.ts`
- Modify (import-path updates): `src/components/mobile-equipment-list-item.tsx`, `src/components/equipment/equipment-actions-menu.tsx`, `src/components/assistant/AssistantPanel.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/qr-scanner/page.tsx`, `src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx`, `src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts`, `src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx`
- Create: `supabase/migrations/<timestamp>_add_repair_request_active_for_equipment.sql`
- Create: `supabase/tests/repair_request_active_for_equipment_smoke.sql`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`

### Task 1.1 — Rename the helper module and add new exports (TDD)

**Files:**
- Rename source: `src/lib/repair-request-create-intent.ts` → `src/lib/repair-request-deep-link.ts`
- Rename unit test: `src/lib/__tests__/repair-request-create-intent.test.ts` → `src/lib/__tests__/repair-request-deep-link.test.ts`

- [ ] **Step 1.1.1: Read existing helper and unit-test file end-to-end** so you know the existing exports verbatim before renaming.

```bash
cat src/lib/repair-request-create-intent.ts
cat src/lib/__tests__/repair-request-create-intent.test.ts
```

- [ ] **Step 1.1.2: Rename both files via `git mv`** to preserve history.

```bash
git mv src/lib/repair-request-create-intent.ts src/lib/repair-request-deep-link.ts
git mv src/lib/__tests__/repair-request-create-intent.test.ts src/lib/__tests__/repair-request-deep-link.test.ts
```

- [ ] **Step 1.1.3: Add three failing tests** to `src/lib/__tests__/repair-request-deep-link.test.ts` for the new exports `REPAIR_REQUEST_VIEW_ACTION`, `buildActiveRepairRequestQueryKey`, and `buildRepairRequestViewHref`. Append these test cases inside the existing `describe` block.

```ts
import { describe, expect, it } from 'vitest'
import {
  REPAIR_REQUESTS_PATH,
  REPAIR_REQUEST_VIEW_ACTION,
  buildActiveRepairRequestQueryKey,
  buildRepairRequestViewHref,
} from '../repair-request-deep-link'

describe('repair-request-deep-link :: active resolver query key', () => {
  it('returns a stable tuple keyed by equipmentId', () => {
    expect(buildActiveRepairRequestQueryKey(7)).toEqual([
      'repair_request_active_for_equipment',
      { equipmentId: 7 },
    ])
  })

  it('encodes a null equipmentId verbatim so callers can disable the query without losing key shape', () => {
    expect(buildActiveRepairRequestQueryKey(null)).toEqual([
      'repair_request_active_for_equipment',
      { equipmentId: null },
    ])
  })
})

describe('repair-request-deep-link :: view-sheet href', () => {
  it('uses the canonical action constant and stringifies the requestId', () => {
    expect(REPAIR_REQUEST_VIEW_ACTION).toBe('view')
    expect(buildRepairRequestViewHref(42)).toBe(
      `${REPAIR_REQUESTS_PATH}?action=view&requestId=42`
    )
  })

  it('rejects non-positive integer requestIds by falling back to the list path', () => {
    expect(buildRepairRequestViewHref(0)).toBe(REPAIR_REQUESTS_PATH)
    expect(buildRepairRequestViewHref(-1)).toBe(REPAIR_REQUESTS_PATH)
    expect(buildRepairRequestViewHref(Number.NaN)).toBe(REPAIR_REQUESTS_PATH)
  })
})
```

- [ ] **Step 1.1.4: Run the renamed test file and confirm the new tests fail** with "is not exported" or "is not a function" errors. Existing tests in the file must still pass.

```bash
node scripts/npm-run.js run test:run -- src/lib/__tests__/repair-request-deep-link.test.ts
```

Expected: 4 new tests fail; the existing tests for `buildRepairRequestCreateIntentHref` and `buildRepairRequestsByEquipmentHref` continue to pass.

- [ ] **Step 1.1.5: Add the three new exports** to `src/lib/repair-request-deep-link.ts`. Keep all existing exports identical — no other behaviour changes in this file.

```ts
// Append below the existing buildRepairRequestsByEquipmentHref function:

export const REPAIR_REQUEST_VIEW_ACTION = 'view'

export function buildActiveRepairRequestQueryKey(equipmentId: number | null) {
  return ['repair_request_active_for_equipment', { equipmentId }] as const
}

export function buildRepairRequestViewHref(requestId: number) {
  if (!isValidEquipmentId(requestId)) {
    // isValidEquipmentId is a positive-integer guard already used by the
    // existing builders. It rejects 0, negatives, and NaN.
    return REPAIR_REQUESTS_PATH
  }
  const params = new URLSearchParams({
    action: REPAIR_REQUEST_VIEW_ACTION,
    requestId: String(requestId),
  })
  return `${REPAIR_REQUESTS_PATH}?${params.toString()}`
}
```

- [ ] **Step 1.1.6: Re-run the renamed test file** and confirm all tests pass.

```bash
node scripts/npm-run.js run test:run -- src/lib/__tests__/repair-request-deep-link.test.ts
```

Expected: all tests in the file pass.

- [ ] **Step 1.1.7: Commit** the rename + new exports together.

```bash
git add -A src/lib/repair-request-deep-link.ts src/lib/repair-request-create-intent.ts \
       src/lib/__tests__/repair-request-deep-link.test.ts \
       src/lib/__tests__/repair-request-create-intent.test.ts
git commit -m "$(cat <<'EOF'
refactor(repair): rename repair-request-create-intent → repair-request-deep-link

Adds three new exports for the upcoming Phase 1 Equipment ↔ Repair deep-link
work (#338, umbrella #207):

- REPAIR_REQUEST_VIEW_ACTION = 'view'
- buildActiveRepairRequestQueryKey(equipmentId)
- buildRepairRequestViewHref(requestId)

Existing CREATE intent helpers (buildRepairRequestCreateIntentHref,
buildRepairRequestsByEquipmentHref) are unchanged. Importers will be updated
in the next commit.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 1.2 — Update all importers to the new module path

**Files (all just an import-path update):**
- Modify: `src/components/mobile-equipment-list-item.tsx`
- Modify: `src/components/equipment/equipment-actions-menu.tsx`
- Modify: `src/components/assistant/AssistantPanel.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/qr-scanner/page.tsx`
- Modify: `src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx`
- Modify: `src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts`
- Modify: `src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx`
- Rename: `src/lib/__tests__/repair-request-create-intent.adoption.test.ts` → `src/lib/__tests__/repair-request-deep-link.adoption.test.ts`

- [ ] **Step 1.2.1: Verify the build is currently red** because of the moved file.

```bash
node scripts/npm-run.js run typecheck
```

Expected: TS errors pointing at the eight files that still import from `@/lib/repair-request-create-intent`.

- [ ] **Step 1.2.2: Replace each import path** in the eight production / test files. For each file, change the import path string only — do not edit anything else in those files.

```bash
# Use this exact sed pattern. Run from repo root.
git ls-files \
  src/components/mobile-equipment-list-item.tsx \
  'src/components/equipment/equipment-actions-menu.tsx' \
  'src/components/assistant/AssistantPanel.tsx' \
  'src/app/(app)/dashboard/page.tsx' \
  'src/app/(app)/qr-scanner/page.tsx' \
  'src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx' \
  'src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts' \
  'src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx' \
  | xargs sed -i 's|@/lib/repair-request-create-intent|@/lib/repair-request-deep-link|g'
```

- [ ] **Step 1.2.3: Rename the adoption test** so it matches the new module name (this also keeps history).

```bash
git mv src/lib/__tests__/repair-request-create-intent.adoption.test.ts \
       src/lib/__tests__/repair-request-deep-link.adoption.test.ts
```

- [ ] **Step 1.2.4: Update the adoption-test imports too** (it imports from `@/lib/repair-request-create-intent`).

```bash
sed -i 's|@/lib/repair-request-create-intent|@/lib/repair-request-deep-link|g' \
  src/lib/__tests__/repair-request-deep-link.adoption.test.ts
```

- [ ] **Step 1.2.5: Verify everything compiles and existing tests still pass.**

```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/lib/__tests__/
```

Expected: typecheck green; all tests in `src/lib/__tests__/` pass. The adoption test's existing assertions about CREATE intent helpers all pass against the renamed module.

- [ ] **Step 1.2.6: Commit.**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(imports): point all repair-request-create-intent importers to repair-request-deep-link

Eight production/test files plus the adoption test now import from the
renamed module. No behaviour change.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 1.3 — Backend RPC + composite index (TDD via SQL smoke test)

**Files:**
- Create: `supabase/migrations/<timestamp>_add_repair_request_active_for_equipment.sql` — replace `<timestamp>` with the current `YYYYMMDDHHMMSS` (e.g., `20260426143000`); pick a value greater than the latest filename in `supabase/migrations/`.
- Create: `supabase/tests/repair_request_active_for_equipment_smoke.sql`

The smoke test is written first and committed before the migration is applied, then the migration is applied via Supabase MCP, then the smoke test is run via Supabase MCP. This mirrors TDD: red → green → refactor.

- [ ] **Step 1.3.1: Author the smoke SQL** at `supabase/tests/repair_request_active_for_equipment_smoke.sql`. The file mimics the structure of `supabase/tests/repair_request_cost_smoke.sql`: wrap everything in `BEGIN; ... ROLLBACK;`, define `pg_temp` helpers for setting JWT claims, seed two tenants and equipments, exercise each scenario, and `RAISE EXCEPTION` on failure so the entire transaction aborts on the first miss. Keep the file under 250 lines.

```sql
-- supabase/tests/repair_request_active_for_equipment_smoke.sql
-- Purpose: smoke-test repair_request_active_for_equipment after the migration is applied.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._rrafe_set_claims(
  p_role text,
  p_user_id bigint,
  p_don_vi bigint DEFAULT NULL,
  p_khoa_phong text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', p_role,
      'role', 'authenticated',
      'user_id', p_user_id::text,
      'sub', p_user_id::text,
      'don_vi', p_don_vi::text,
      'khoa_phong', p_khoa_phong
    )::text,
    true
  );
END;
$$;

DO $$
DECLARE
  v_tenant_a bigint;
  v_tenant_b bigint;
  v_user_id bigint := 999001;
  v_eq_a_active1 bigint;
  v_eq_a_active2 bigint;
  v_eq_a_completed_only bigint;
  v_eq_a_soft_deleted bigint;
  v_eq_b bigint;
  v_req_a1_pending bigint;
  v_req_a1_approved bigint;
  v_req_b_active bigint;
  v_result jsonb;
  v_req_id_first bigint;
  v_req_id_second bigint;
BEGIN
  INSERT INTO public.don_vi(name) VALUES ('Tenant A RRAFE smoke') RETURNING id INTO v_tenant_a;
  INSERT INTO public.don_vi(name) VALUES ('Tenant B RRAFE smoke') RETURNING id INTO v_tenant_b;

  -- equipment fixtures
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('RRAFE-A1', 'eq A active1', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa') RETURNING id INTO v_eq_a_active1;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('RRAFE-A2', 'eq A active2', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa') RETURNING id INTO v_eq_a_active2;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('RRAFE-A3', 'eq A completed-only', v_tenant_a, 'Khoa A1', 'Hoạt động') RETURNING id INTO v_eq_a_completed_only;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai, is_deleted)
  VALUES ('RRAFE-A4', 'eq A soft-deleted', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa', true) RETURNING id INTO v_eq_a_soft_deleted;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('RRAFE-B1', 'eq B', v_tenant_b, 'Khoa B1', 'Chờ sửa chữa') RETURNING id INTO v_eq_b;

  -- requests on eq_a_active1: 1 'Chờ xử lý' (older) + 1 'Đã duyệt' (newer)
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_a_active1, now() - interval '5 days', 'Chờ xử lý', 'Pending older')
  RETURNING id INTO v_req_a1_pending;

  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, ngay_duyet)
  VALUES (v_eq_a_active1, now() - interval '4 days', 'Đã duyệt', 'Approved newer', now() - interval '1 day')
  RETURNING id INTO v_req_a1_approved;

  -- requests on eq_a_active2: only completed history
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, ngay_hoan_thanh)
  VALUES (v_eq_a_active2, now() - interval '10 days', 'Hoàn thành', 'Old completed', now() - interval '5 days');

  -- requests on eq_a_soft_deleted: 1 active (should still be filtered out by soft-delete guard)
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_a_soft_deleted, now() - interval '1 day', 'Chờ xử lý', 'Active on soft-deleted equipment');

  -- requests on eq_b: 1 active in tenant B
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_b, now() - interval '2 days', 'Chờ xử lý', 'Tenant B active')
  RETURNING id INTO v_req_b_active;

  ---------------------------------------------------------------------------
  -- Scenario 1: same-tenant user, equipment with only completed history → 0
  ---------------------------------------------------------------------------
  PERFORM pg_temp._rrafe_set_claims('to_qltb', v_user_id, v_tenant_a);
  v_result := public.repair_request_active_for_equipment(v_eq_a_active2::int);
  IF (v_result->>'active_count')::int <> 0 OR v_result->'request' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Scenario 1 failed (completed-only): %', v_result;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 2: same-tenant user, soft-deleted equipment → 0
  ---------------------------------------------------------------------------
  v_result := public.repair_request_active_for_equipment(v_eq_a_soft_deleted::int);
  IF (v_result->>'active_count')::int <> 0 OR v_result->'request' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Scenario 2 failed (soft-deleted): %', v_result;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 3: same-tenant user, multi-active → count=2, returns most-recent (approved)
  ---------------------------------------------------------------------------
  v_result := public.repair_request_active_for_equipment(v_eq_a_active1::int);
  IF (v_result->>'active_count')::int <> 2 THEN
    RAISE EXCEPTION 'Scenario 3 count mismatch: %', v_result;
  END IF;
  IF ((v_result->'request')->>'id')::bigint <> v_req_a1_approved THEN
    RAISE EXCEPTION 'Scenario 3 tie-break wrong: returned %, expected %', v_result, v_req_a1_approved;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 4: cross-tenant user → 0
  ---------------------------------------------------------------------------
  PERFORM pg_temp._rrafe_set_claims('to_qltb', v_user_id, v_tenant_a);
  v_result := public.repair_request_active_for_equipment(v_eq_b::int);
  IF (v_result->>'active_count')::int <> 0 OR v_result->'request' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Scenario 4 failed (cross-tenant): %', v_result;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 5: global role can see across tenants
  ---------------------------------------------------------------------------
  PERFORM pg_temp._rrafe_set_claims('global', v_user_id);
  v_result := public.repair_request_active_for_equipment(v_eq_b::int);
  IF (v_result->>'active_count')::int <> 1 THEN
    RAISE EXCEPTION 'Scenario 5 failed (global): %', v_result;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 6: identical ngay_duyet ⇒ falls back to id DESC deterministically
  ---------------------------------------------------------------------------
  -- Force two rows with identical ngay_duyet on a fresh equipment.
  DECLARE
    v_eq_tie bigint;
    v_first bigint;
    v_second bigint;
  BEGIN
    INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
    VALUES ('RRAFE-A5', 'eq A tie-break', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa') RETURNING id INTO v_eq_tie;
    INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, ngay_duyet)
    VALUES (v_eq_tie, now(), 'Đã duyệt', 'Tie 1', now()) RETURNING id INTO v_first;
    INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, ngay_duyet)
    VALUES (v_eq_tie, now(), 'Đã duyệt', 'Tie 2', (SELECT ngay_duyet FROM public.yeu_cau_sua_chua WHERE id = v_first))
    RETURNING id INTO v_second;

    PERFORM pg_temp._rrafe_set_claims('to_qltb', v_user_id, v_tenant_a);
    v_result := public.repair_request_active_for_equipment(v_eq_tie::int);
    IF (v_result->>'active_count')::int <> 2 THEN
      RAISE EXCEPTION 'Scenario 6 count mismatch: %', v_result;
    END IF;
    IF ((v_result->'request')->>'id')::bigint <> greatest(v_first, v_second) THEN
      RAISE EXCEPTION 'Scenario 6 id-desc tie-break wrong: %', v_result;
    END IF;
  END;

  RAISE NOTICE 'repair_request_active_for_equipment smoke: ALL SCENARIOS PASSED';
END;
$$;

ROLLBACK;
```

- [ ] **Step 1.3.2: Run the smoke SQL via Supabase MCP and confirm it FAILS** because the RPC does not exist yet.

Use the Supabase MCP `execute_sql` tool against project `cdthersvldpnlbvpufrr` with the file contents. Expected: error like `function public.repair_request_active_for_equipment(integer) does not exist`. Capture the error message in your task notes; this is the red phase.

- [ ] **Step 1.3.3: Author the migration file** at `supabase/migrations/<timestamp>_add_repair_request_active_for_equipment.sql`. Use the SQL from spec section "New RPC `repair_request_active_for_equipment`" verbatim. Append the composite index at the end of the file:

```sql
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_thiet_bi_status
  ON public.yeu_cau_sua_chua (thiet_bi_id, trang_thai);
```

The full file is reproduced below for convenience. Do not paraphrase.

```sql
-- supabase/migrations/<timestamp>_add_repair_request_active_for_equipment.sql
-- Issue #338 (umbrella #207): introduce active-repair resolver per equipment.
-- Rollback: DROP FUNCTION public.repair_request_active_for_equipment(INT);
--           DROP INDEX IF EXISTS public.idx_yeu_cau_sua_chua_thiet_bi_status;

BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_active_for_equipment(
  p_thiet_bi_id INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role     TEXT  := lower(coalesce(public._get_jwt_claim('app_role'),
                                     public._get_jwt_claim('role'), ''));
  v_user_id  TEXT  := nullif(public._get_jwt_claim('user_id'), '');
  v_allowed  BIGINT[] := NULL;
  v_count    INTEGER := 0;
  v_request  JSONB   := NULL;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role NOT IN ('global', 'admin') THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object('active_count', 0, 'request', NULL);
    END IF;
  END IF;

  WITH active AS (
    SELECT
      r.*,
      tb.ten_thiet_bi,
      tb.ma_thiet_bi,
      tb.model,
      tb.serial,
      tb.khoa_phong_quan_ly,
      tb.don_vi AS thiet_bi_don_vi,
      dv.name AS facility_name
    FROM public.yeu_cau_sua_chua r
    JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE r.thiet_bi_id = p_thiet_bi_id
      AND r.trang_thai IN ('Chờ xử lý', 'Đã duyệt')
      AND COALESCE(tb.is_deleted, false) = false
      AND (v_role IN ('global','admin') OR tb.don_vi = ANY(v_allowed))
    ORDER BY COALESCE(r.ngay_duyet, r.ngay_yeu_cau) DESC, r.id DESC
  ),
  counted AS (SELECT count(*)::int AS c FROM active)
  SELECT
    jsonb_build_object(
      'active_count', counted.c,
      'request',
      CASE WHEN counted.c = 0 THEN NULL ELSE (
        SELECT jsonb_build_object(
          'id', a.id,
          'thiet_bi_id', a.thiet_bi_id,
          'ngay_yeu_cau', a.ngay_yeu_cau,
          'trang_thai', a.trang_thai,
          'mo_ta_su_co', a.mo_ta_su_co,
          'hang_muc_sua_chua', a.hang_muc_sua_chua,
          'ngay_mong_muon_hoan_thanh', a.ngay_mong_muon_hoan_thanh,
          'nguoi_yeu_cau', a.nguoi_yeu_cau,
          'ngay_duyet', a.ngay_duyet,
          'ngay_hoan_thanh', a.ngay_hoan_thanh,
          'nguoi_duyet', a.nguoi_duyet,
          'nguoi_xac_nhan', a.nguoi_xac_nhan,
          'don_vi_thuc_hien', a.don_vi_thuc_hien,
          'ten_don_vi_thue', a.ten_don_vi_thue,
          'ket_qua_sua_chua', a.ket_qua_sua_chua,
          'ly_do_khong_hoan_thanh', a.ly_do_khong_hoan_thanh,
          'chi_phi_sua_chua', a.chi_phi_sua_chua,
          'thiet_bi', jsonb_build_object(
            'ten_thiet_bi', a.ten_thiet_bi,
            'ma_thiet_bi', a.ma_thiet_bi,
            'model', a.model,
            'serial', a.serial,
            'khoa_phong_quan_ly', a.khoa_phong_quan_ly,
            'facility_name', a.facility_name,
            'facility_id', a.thiet_bi_don_vi
          )
        )
        FROM active a LIMIT 1
      ) END
    )
  INTO v_request
  FROM counted;

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_active_for_equipment(INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_active_for_equipment(INT) FROM PUBLIC;

CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_thiet_bi_status
  ON public.yeu_cau_sua_chua (thiet_bi_id, trang_thai);

COMMIT;
```

- [ ] **Step 1.3.4: Apply the migration via Supabase MCP `apply_migration`** (project `cdthersvldpnlbvpufrr`). Pass the migration name (without timestamp) and the full SQL body. Expected: success without errors.

- [ ] **Step 1.3.5: Re-run the smoke SQL via Supabase MCP `execute_sql`.** Expected: completes with `RAISE NOTICE 'repair_request_active_for_equipment smoke: ALL SCENARIOS PASSED'` and rolls back. If any scenario fails, fix the migration body, re-apply via MCP, re-run smoke. **Do not** edit the smoke file to make it pass — the smoke file is the contract.

- [ ] **Step 1.3.6: Verify the live function shape** to confirm hardening landed correctly.

```sql
SELECT pg_get_functiondef(p.oid) AS def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'repair_request_active_for_equipment';
```

Expected: `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp`. If any of the three hardening attributes is missing, treat as a regression and re-apply.

- [ ] **Step 1.3.7: Verify the composite index exists.**

```sql
SELECT indexdef FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'yeu_cau_sua_chua'
  AND indexname = 'idx_yeu_cau_sua_chua_thiet_bi_status';
```

Expected: a single row showing `(thiet_bi_id, trang_thai)`.

- [ ] **Step 1.3.8: Commit** the migration file and the smoke SQL together.

```bash
git add supabase/migrations/<timestamp>_add_repair_request_active_for_equipment.sql \
        supabase/tests/repair_request_active_for_equipment_smoke.sql
git commit -m "$(cat <<'EOF'
feat(repair): add repair_request_active_for_equipment RPC + smoke + index

Phase 1 of #338 (umbrella #207). New RPC returns the deterministic
active repair request for one equipment as `{active_count, request}`,
mirroring the row shape of repair_request_list and the tenant-guard
pattern (allowed_don_vi_for_session + SET search_path + JWT extraction).

Composite index (thiet_bi_id, trang_thai) added in the same migration
so the lookup stays index-only as repair history grows.

Smoke SQL covers six scenarios (completed-only, soft-deleted,
multi-active tie-break, cross-tenant, global role, identical-timestamp
fallback).

Migration applied via Supabase MCP; CLI not used.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 1.4 — Whitelist the new RPC in the proxy

**File:**
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`

- [ ] **Step 1.4.1: Read the file** to find the alphabetised position where `repair_request_*` entries live.

```bash
sed -n '20,50p' src/app/api/rpc/[fn]/allowed-functions.ts
```

- [ ] **Step 1.4.2: Add `'repair_request_active_for_equipment'`** in the whitelist array, keeping the existing alphabetical / grouped order with the other `repair_request_*` entries.

- [ ] **Step 1.4.3: Verify typecheck still passes** (no TS error from the added string literal — the array is typed as `readonly string[]`, but verify anyway).

```bash
node scripts/npm-run.js run typecheck
```

- [ ] **Step 1.4.4: Commit.**

```bash
git add src/app/api/rpc/[fn]/allowed-functions.ts
git commit -m "$(cat <<'EOF'
chore(rpc): whitelist repair_request_active_for_equipment in proxy

Required for callRpc to reach the new RPC introduced for #338.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### End of Chunk 1 — definition of done

- [ ] All Chunk 1 tests pass: `node scripts/npm-run.js run test:run -- src/lib/__tests__/`
- [ ] Typecheck passes: `node scripts/npm-run.js run typecheck`
- [ ] Live DB has `repair_request_active_for_equipment` (verified via `pg_get_functiondef` MCP query).
- [ ] Live DB has `idx_yeu_cau_sua_chua_thiet_bi_status` (verified via `pg_indexes` MCP query).
- [ ] Smoke SQL exits with `ALL SCENARIOS PASSED` notice.
- [ ] Allowed-functions whitelist includes the new RPC.
- [ ] Four commits in this chunk: rename + new exports / importer rewires / migration + smoke / whitelist.

---

## Chunk 2: Frontend primitives — types, strings, resolver hook, context, button, sheet host, adapter

This chunk delivers every reusable piece of `src/components/equipment-linked-request/`. Nothing is wired into the Equipment page yet — that lands in Chunk 3. Each task is its own commit.

**Files in this chunk (all created):**

- `src/components/equipment-linked-request/types.ts`
- `src/components/equipment-linked-request/strings.ts`
- `src/components/equipment-linked-request/resolvers/useResolveActiveRepair.ts`
- `src/components/equipment-linked-request/resolvers/__tests__/useResolveActiveRepair.test.ts`
- `src/components/equipment-linked-request/LinkedRequestContext.tsx`
- `src/components/equipment-linked-request/__tests__/LinkedRequestContext.test.tsx`
- `src/components/equipment-linked-request/LinkedRequestButton.tsx`
- `src/components/equipment-linked-request/__tests__/LinkedRequestButton.test.tsx`
- `src/components/equipment-linked-request/adapters/repairRequestSheetAdapter.tsx`
- `src/components/equipment-linked-request/LinkedRequestSheetHost.tsx`
- `src/components/equipment-linked-request/__tests__/LinkedRequestSheetHost.test.tsx`
- `src/components/equipment-linked-request/index.ts`

### Task 2.1 — Types and strings (foundation)

**Files:**
- Create: `src/components/equipment-linked-request/types.ts`
- Create: `src/components/equipment-linked-request/strings.ts`

These two files have no logic; they exist so the rest of the package depends on stable, importable values.

- [ ] **Step 2.1.1: Create `types.ts`** with the kind union and result shape.

```ts
import type { RepairRequestWithEquipment } from '@/app/(app)/repair-requests/types'

/**
 * Phase 1: only 'repair' is implemented. Phase 2/3 will add 'transfer' and
 * 'maintenance' (or split the latter into 'calibration' / 'inspection') without
 * changing the surrounding shape.
 */
export type LinkedRequestKind = 'repair'

export type ActiveRepairResult = {
  active_count: number
  request: RepairRequestWithEquipment | null
}

export type LinkedRequestState =
  | { open: false; kind: null; equipmentId: null }
  | { open: true; kind: LinkedRequestKind; equipmentId: number }
```

- [ ] **Step 2.1.2: Create `strings.ts`** with all Vietnamese copy used by the package. Centralising avoids stringly-typed copies scattered across components and makes future i18n trivial.

```ts
export const STRINGS = {
  buttonSingleActive: 'Yêu cầu sửa chữa hiện tại',
  buttonMultiActive: (count: number) =>
    `${count} yêu cầu sửa chữa active — mở bản mới nhất`,
  buttonAriaLabel: (maThietBi: string) =>
    `Yêu cầu sửa chữa hiện tại của thiết bị ${maThietBi}`,
  multiActiveAlert: (count: number) =>
    `Phát hiện ${count} yêu cầu active. Đang hiển thị bản cập nhật mới nhất. Để xem tất cả, mở danh sách trên trang Yêu cầu sửa chữa.`,
  footerOpenInRepairRequests: 'Mở trong trang Yêu cầu sửa chữa',
  autoCloseToastTitle: 'Yêu cầu đã được hoàn thành',
} as const
```

- [ ] **Step 2.1.3: Verify typecheck** (no test for these — they're pure data).

```bash
node scripts/npm-run.js run typecheck
```

- [ ] **Step 2.1.4: Commit.**

```bash
git add src/components/equipment-linked-request/types.ts src/components/equipment-linked-request/strings.ts
git commit -m "$(cat <<'EOF'
feat(equipment-linked-request): scaffold types and strings

Phase 1 of #338. Single 'repair' kind for now; Phase 2/3 will extend the
union without changing surrounding shape. All Vietnamese copy lives in
strings.ts to keep future i18n cheap.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 2.2 — Resolver hook `useResolveActiveRepair` (TDD)

**Files:**
- Create: `src/components/equipment-linked-request/resolvers/__tests__/useResolveActiveRepair.test.ts`
- Create: `src/components/equipment-linked-request/resolvers/useResolveActiveRepair.ts`

- [ ] **Step 2.2.1: Read the existing TanStack Query mock pattern** in the repo so the tests match conventions.

```bash
cat src/hooks/__tests__/use-cached-repair.invalidation.test.ts | head -50
```

- [ ] **Step 2.2.2: Write the failing test file.**

```ts
import * as React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCallRpc = vi.fn()

vi.mock('@/lib/rpc-client', () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

import { useResolveActiveRepair } from '../useResolveActiveRepair'
import { buildActiveRepairRequestQueryKey } from '@/lib/repair-request-deep-link'

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useResolveActiveRepair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockReset()
  })

  it('does not fetch when enabled is false', async () => {
    const queryClient = createQueryClient()
    renderHook(
      () => useResolveActiveRepair({ equipmentId: 7, enabled: false }),
      { wrapper: createWrapper(queryClient) },
    )
    // give microtasks a chance to flush
    await act(async () => {})
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it('does not fetch when equipmentId is null even if enabled is true', async () => {
    const queryClient = createQueryClient()
    renderHook(
      () => useResolveActiveRepair({ equipmentId: null, enabled: true }),
      { wrapper: createWrapper(queryClient) },
    )
    await act(async () => {})
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it('fetches via callRpc with the correct fn name and args when enabled', async () => {
    mockCallRpc.mockResolvedValueOnce({ active_count: 0, request: null })
    const queryClient = createQueryClient()
    const { result } = renderHook(
      () => useResolveActiveRepair({ equipmentId: 42, enabled: true }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockCallRpc).toHaveBeenCalledTimes(1)
    const callArg = mockCallRpc.mock.calls[0]![0]
    expect(callArg.fn).toBe('repair_request_active_for_equipment')
    expect(callArg.args).toEqual({ p_thiet_bi_id: 42 })
    expect(callArg.signal).toBeInstanceOf(AbortSignal)
  })

  it('uses the canonical query key from repair-request-deep-link', async () => {
    mockCallRpc.mockResolvedValue({ active_count: 0, request: null })
    const queryClient = createQueryClient()
    renderHook(
      () => useResolveActiveRepair({ equipmentId: 5, enabled: true }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalled()
    })

    const expectedKey = buildActiveRepairRequestQueryKey(5)
    const cached = queryClient.getQueryData(expectedKey)
    expect(cached).toEqual({ active_count: 0, request: null })
  })

  it('isolates caches between two equipmentIds', async () => {
    mockCallRpc
      .mockResolvedValueOnce({ active_count: 1, request: { id: 100 } })
      .mockResolvedValueOnce({ active_count: 2, request: { id: 200 } })

    const queryClient = createQueryClient()
    const { result: r1 } = renderHook(
      () => useResolveActiveRepair({ equipmentId: 1, enabled: true }),
      { wrapper: createWrapper(queryClient) },
    )
    const { result: r2 } = renderHook(
      () => useResolveActiveRepair({ equipmentId: 2, enabled: true }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => {
      expect(r1.current.isSuccess).toBe(true)
      expect(r2.current.isSuccess).toBe(true)
    })

    expect(r1.current.data).toEqual({ active_count: 1, request: { id: 100 } })
    expect(r2.current.data).toEqual({ active_count: 2, request: { id: 200 } })
  })
})
```

- [ ] **Step 2.2.3: Run the test and confirm it fails** because `useResolveActiveRepair.ts` does not exist yet.

```bash
node scripts/npm-run.js run test:run -- src/components/equipment-linked-request/resolvers/__tests__/useResolveActiveRepair.test.ts
```

Expected: `Failed to resolve import "../useResolveActiveRepair"`.

- [ ] **Step 2.2.4: Implement the hook.**

```ts
import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { buildActiveRepairRequestQueryKey } from '@/lib/repair-request-deep-link'
import type { ActiveRepairResult } from '../types'

export type UseResolveActiveRepairOptions = {
  equipmentId: number | null
  enabled: boolean
}

/**
 * Phase 1 resolver — fetches the active repair request for one equipment via
 * the dedicated RPC. Caller is responsible for status-gating; this hook only
 * checks the trivial `equipmentId != null` precondition.
 *
 * Mutations elsewhere (create/update/assign/complete/delete) all invalidate
 * `repairKeys.all`, which subsumes this query's key.
 */
export function useResolveActiveRepair(opts: UseResolveActiveRepairOptions) {
  return useQuery<ActiveRepairResult>({
    queryKey: buildActiveRepairRequestQueryKey(opts.equipmentId),
    queryFn: ({ signal }) =>
      callRpc<ActiveRepairResult>({
        fn: 'repair_request_active_for_equipment',
        args: { p_thiet_bi_id: opts.equipmentId! },
        signal,
      }),
    enabled: opts.enabled && opts.equipmentId !== null,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
```

- [ ] **Step 2.2.5: Re-run the tests and confirm green.**

```bash
node scripts/npm-run.js run test:run -- src/components/equipment-linked-request/resolvers/__tests__/useResolveActiveRepair.test.ts
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
```

Expected: all 5 tests pass; both gates clean.

- [ ] **Step 2.2.6: Commit.**

```bash
git add src/components/equipment-linked-request/resolvers/
git commit -m "$(cat <<'EOF'
feat(equipment-linked-request): add useResolveActiveRepair hook

Wraps the new repair_request_active_for_equipment RPC in a TanStack Query
hook with AbortSignal threading and the canonical query key. Phase 1 of
#338. Tests cover gating, RPC args, cache key, and per-equipment
isolation.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 2.3 — `LinkedRequestContext` Provider (TDD)

**Files:**
- Create: `src/components/equipment-linked-request/__tests__/LinkedRequestContext.test.tsx`
- Create: `src/components/equipment-linked-request/LinkedRequestContext.tsx`

The Provider holds `LinkedRequestState` and exposes `openRepair(equipmentId)` / `close()`. It also subscribes to `EquipmentDialogContext` so the sheet auto-closes when Equipment Detail closes. The auto-close tied to resolver result lives in `LinkedRequestSheetHost` (Task 2.6) — keeping it out of the provider keeps the provider thin.

- [ ] **Step 2.3.1: Read `EquipmentDialogContext`** to confirm the exact shape we will subscribe to.

```bash
sed -n '1,60p' 'src/app/(app)/equipment/_components/EquipmentDialogContext.tsx'
```

- [ ] **Step 2.3.2: Write the failing tests.**

```tsx
import * as React from 'react'
import { act, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  LinkedRequestProvider,
  useLinkedRequest,
} from '../LinkedRequestContext'
import {
  EquipmentDialogContext,
  type EquipmentDialogContextValue,
} from '@/app/(app)/equipment/_components/EquipmentDialogContext'

function createEquipmentDialogContextStub(
  overrides: Partial<EquipmentDialogContextValue> = {}
): EquipmentDialogContextValue {
  return {
    user: null,
    isGlobal: false,
    isRegionalLeader: false,
    dialogState: {
      isAddOpen: false,
      isImportOpen: false,
      isColumnsOpen: false,
      isDetailOpen: false,
      isStartUsageOpen: false,
      isEndUsageOpen: false,
      isDeleteOpen: false,
      detailEquipment: null,
      startUsageEquipment: null,
      endUsageLog: null,
      deleteTarget: null,
      deleteSource: null,
    },
    openAddDialog: vi.fn(),
    openImportDialog: vi.fn(),
    openColumnsDialog: vi.fn(),
    openDetailDialog: vi.fn(),
    openStartUsageDialog: vi.fn(),
    openEndUsageDialog: vi.fn(),
    openDeleteDialog: vi.fn(),
    closeAddDialog: vi.fn(),
    closeImportDialog: vi.fn(),
    closeColumnsDialog: vi.fn(),
    closeDetailDialog: vi.fn(),
    closeStartUsageDialog: vi.fn(),
    closeEndUsageDialog: vi.fn(),
    closeDeleteDialog: vi.fn(),
    closeAllDialogs: vi.fn(),
    onDataMutationSuccess: vi.fn(),
    ...overrides,
  }
}

function wrap(
  equipmentDialogValue: EquipmentDialogContextValue,
): React.FC<{ children: React.ReactNode }> {
  return function Wrapper({ children }) {
    return (
      <EquipmentDialogContext.Provider value={equipmentDialogValue}>
        <LinkedRequestProvider>{children}</LinkedRequestProvider>
      </EquipmentDialogContext.Provider>
    )
  }
}

describe('LinkedRequestProvider', () => {
  it('starts in the closed state', () => {
    const ctx = createEquipmentDialogContextStub()
    const { result } = renderHook(() => useLinkedRequest(), { wrapper: wrap(ctx) })
    expect(result.current.state).toEqual({ open: false, kind: null, equipmentId: null })
  })

  it('opens with kind="repair" and the given equipmentId', () => {
    const ctx = createEquipmentDialogContextStub({
      dialogState: { ...createEquipmentDialogContextStub().dialogState, isDetailOpen: true },
    })
    const { result } = renderHook(() => useLinkedRequest(), { wrapper: wrap(ctx) })
    act(() => result.current.openRepair(11))
    expect(result.current.state).toEqual({ open: true, kind: 'repair', equipmentId: 11 })
  })

  it('close() returns to the closed state', () => {
    const ctx = createEquipmentDialogContextStub({
      dialogState: { ...createEquipmentDialogContextStub().dialogState, isDetailOpen: true },
    })
    const { result } = renderHook(() => useLinkedRequest(), { wrapper: wrap(ctx) })
    act(() => result.current.openRepair(7))
    act(() => result.current.close())
    expect(result.current.state.open).toBe(false)
  })

  it('throws if used outside the provider', () => {
    expect(() => renderHook(() => useLinkedRequest())).toThrow(
      /LinkedRequestProvider/,
    )
  })

  it('auto-closes when EquipmentDialogContext.dialogState.isDetailOpen flips to false', () => {
    const dialogStateOpen = {
      ...createEquipmentDialogContextStub().dialogState,
      isDetailOpen: true,
    }
    const dialogStateClosed = {
      ...createEquipmentDialogContextStub().dialogState,
      isDetailOpen: false,
    }
    const initialCtx = createEquipmentDialogContextStub({ dialogState: dialogStateOpen })

    function Harness() {
      const linked = useLinkedRequest()
      return <span data-testid="open">{linked.state.open ? 'yes' : 'no'}</span>
    }

    const { rerender } = render(
      <EquipmentDialogContext.Provider value={initialCtx}>
        <LinkedRequestProvider>
          <Harness />
          <Opener />
        </LinkedRequestProvider>
      </EquipmentDialogContext.Provider>,
    )

    function Opener() {
      const linked = useLinkedRequest()
      React.useEffect(() => {
        linked.openRepair(99)
      }, [linked])
      return null
    }

    expect(screen.getByTestId('open').textContent).toBe('yes')

    // Detail dialog now closes — provider must auto-close the sheet.
    rerender(
      <EquipmentDialogContext.Provider
        value={createEquipmentDialogContextStub({ dialogState: dialogStateClosed })}
      >
        <LinkedRequestProvider>
          <Harness />
        </LinkedRequestProvider>
      </EquipmentDialogContext.Provider>,
    )

    expect(screen.getByTestId('open').textContent).toBe('no')
  })
})
```

- [ ] **Step 2.3.3: Run the test, confirm it fails** because `LinkedRequestContext.tsx` does not exist.

```bash
node scripts/npm-run.js run test:run -- src/components/equipment-linked-request/__tests__/LinkedRequestContext.test.tsx
```

- [ ] **Step 2.3.4: Implement the provider.**

```tsx
'use client'

import * as React from 'react'
import { EquipmentDialogContext } from '@/app/(app)/equipment/_components/EquipmentDialogContext'
import type { LinkedRequestKind, LinkedRequestState } from './types'

export interface LinkedRequestContextValue {
  state: LinkedRequestState
  openRepair: (equipmentId: number) => void
  close: () => void
}

const Context = React.createContext<LinkedRequestContextValue | null>(null)

const CLOSED_STATE: LinkedRequestState = {
  open: false,
  kind: null,
  equipmentId: null,
}

export function LinkedRequestProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<LinkedRequestState>(CLOSED_STATE)

  const openRepair = React.useCallback((equipmentId: number) => {
    setState({ open: true, kind: 'repair', equipmentId })
  }, [])

  const close = React.useCallback(() => {
    setState(CLOSED_STATE)
  }, [])

  // Auto-close when the parent Equipment Detail dialog closes.
  // Subscribing via an effect keeps the provider usable outside the equipment
  // page (the EquipmentDialogContext is `null` there); we just skip the effect.
  const equipmentDialog = React.useContext(EquipmentDialogContext)
  const isDetailOpen = equipmentDialog?.dialogState.isDetailOpen ?? false

  React.useEffect(() => {
    if (!isDetailOpen && state.open) {
      setState(CLOSED_STATE)
    }
  }, [isDetailOpen, state.open])

  const value = React.useMemo<LinkedRequestContextValue>(
    () => ({ state, openRepair, close }),
    [state, openRepair, close],
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useLinkedRequest(): LinkedRequestContextValue {
  const value = React.useContext(Context)
  if (!value) {
    throw new Error('useLinkedRequest must be used within a LinkedRequestProvider')
  }
  return value
}

// Phase 2/3 may reuse these types/aliases without the kind union widening;
// re-export so consumers don't import from ./types directly.
export type { LinkedRequestKind, LinkedRequestState }
```

- [ ] **Step 2.3.5: Re-run tests, gates.**

```bash
node scripts/npm-run.js run test:run -- src/components/equipment-linked-request/__tests__/LinkedRequestContext.test.tsx
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
```

Expected: 5/5 pass; gates clean.

- [ ] **Step 2.3.6: Commit.**

```bash
git add src/components/equipment-linked-request/LinkedRequestContext.tsx \
        src/components/equipment-linked-request/__tests__/LinkedRequestContext.test.tsx
git commit -m "$(cat <<'EOF'
feat(equipment-linked-request): add LinkedRequestProvider/useLinkedRequest

Provider holds LinkedRequestState and exposes openRepair / close. Subscribes
to EquipmentDialogContext so the side sheet auto-closes when the parent
Equipment Detail dialog dismisses. Phase 1 of #338.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 2.4 — `LinkedRequestButton` (TDD with `user-event`)

**Files:**
- Create: `src/components/equipment-linked-request/__tests__/LinkedRequestButton.test.tsx`
- Create: `src/components/equipment-linked-request/LinkedRequestButton.tsx`

`LinkedRequestButton` is the trigger that lives inside `EquipmentDetailStatusSection`. It accepts `kind` and `equipment` (`Equipment` type from `@/types/database`). It runs `useResolveActiveRepair` gated by `equipment.tinh_trang_hien_tai === 'Chờ sửa chữa'`, and hides itself when the resolver returns 0 or errors.

- [ ] **Step 2.4.1: Write the failing tests.** Use `userEvent` for clicks; mock `callRpc` and `useLinkedRequest` to assert behaviour.

```tsx
import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCallRpc = vi.fn()
const openRepairSpy = vi.fn()

vi.mock('@/lib/rpc-client', () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

vi.mock('../LinkedRequestContext', async () => {
  const actual = await vi.importActual<typeof import('../LinkedRequestContext')>(
    '../LinkedRequestContext',
  )
  return {
    ...actual,
    useLinkedRequest: () => ({
      state: { open: false, kind: null, equipmentId: null },
      openRepair: openRepairSpy,
      close: vi.fn(),
    }),
  }
})

import { LinkedRequestButton } from '../LinkedRequestButton'
import type { Equipment } from '@/types/database'

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 1,
    ma_thiet_bi: 'TB-0001',
    ten_thiet_bi: 'Máy siêu âm',
    tinh_trang_hien_tai: 'Chờ sửa chữa',
    ...(overrides as Record<string, unknown>),
  } as Equipment
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  )
}

describe('LinkedRequestButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockReset()
  })

  it('does not render when status is not "Chờ sửa chữa"', async () => {
    const equipment = makeEquipment({ tinh_trang_hien_tai: 'Hoạt động' })
    renderWithClient(<LinkedRequestButton kind="repair" equipment={equipment} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('button')).toBeNull()
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it('renders a skeleton chip while the resolver is loading', () => {
    let resolveFn: (v: unknown) => void = () => {}
    mockCallRpc.mockImplementationOnce(() => new Promise((r) => { resolveFn = r }))
    renderWithClient(<LinkedRequestButton kind="repair" equipment={makeEquipment()} />)
    expect(screen.getByTestId('linked-request-button-skeleton')).toBeInTheDocument()
    // satisfy the dangling promise
    resolveFn({ active_count: 0, request: null })
  })

  it('does not render when resolver returns active_count: 0', async () => {
    mockCallRpc.mockResolvedValueOnce({ active_count: 0, request: null })
    renderWithClient(<LinkedRequestButton kind="repair" equipment={makeEquipment()} />)
    await waitFor(() => {
      expect(screen.queryByTestId('linked-request-button-skeleton')).toBeNull()
    })
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders the single-active label and triggers openRepair on click', async () => {
    mockCallRpc.mockResolvedValueOnce({
      active_count: 1,
      request: { id: 100, thiet_bi_id: 1 },
    })
    const user = userEvent.setup()
    renderWithClient(<LinkedRequestButton kind="repair" equipment={makeEquipment()} />)

    const btn = await screen.findByRole('button', {
      name: /Yêu cầu sửa chữa hiện tại của thiết bị TB-0001/i,
    })
    expect(btn).toHaveTextContent('Yêu cầu sửa chữa hiện tại')

    await user.click(btn)
    expect(openRepairSpy).toHaveBeenCalledTimes(1)
    expect(openRepairSpy).toHaveBeenCalledWith(1)
  })

  it('renders the multi-active label when active_count > 1', async () => {
    mockCallRpc.mockResolvedValueOnce({
      active_count: 3,
      request: { id: 200, thiet_bi_id: 1 },
    })
    renderWithClient(<LinkedRequestButton kind="repair" equipment={makeEquipment()} />)

    const btn = await screen.findByRole('button', {
      name: /Yêu cầu sửa chữa hiện tại của thiết bị TB-0001/i,
    })
    expect(btn).toHaveTextContent('3 yêu cầu sửa chữa active')
  })

  it('does not render when resolver errors (no toast, console.error logged)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCallRpc.mockRejectedValueOnce(new Error('boom'))
    renderWithClient(<LinkedRequestButton kind="repair" equipment={makeEquipment()} />)

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled()
    })
    expect(screen.queryByRole('button')).toBeNull()
    errorSpy.mockRestore()
  })
})
```

- [ ] **Step 2.4.2: Run the tests, confirm they fail** because `LinkedRequestButton.tsx` does not exist.

```bash
node scripts/npm-run.js run test:run -- src/components/equipment-linked-request/__tests__/LinkedRequestButton.test.tsx
```

- [ ] **Step 2.4.3: Implement the button.**

```tsx
'use client'

import * as React from 'react'
import type { Equipment } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useLinkedRequest } from './LinkedRequestContext'
import { useResolveActiveRepair } from './resolvers/useResolveActiveRepair'
import type { LinkedRequestKind } from './types'
import { STRINGS } from './strings'

interface LinkedRequestButtonProps {
  kind: LinkedRequestKind
  equipment: Equipment
}

const TRIGGER_STATUS = 'Chờ sửa chữa' as const

export function LinkedRequestButton({ kind, equipment }: LinkedRequestButtonProps) {
  // Phase 1: only 'repair' kind is implemented. The check is here so the
  // TypeScript discriminant remains explicit when the union widens.
  const enabled = kind === 'repair' && equipment.tinh_trang_hien_tai === TRIGGER_STATUS

  const query = useResolveActiveRepair({
    equipmentId: enabled ? equipment.id : null,
    enabled,
  })
  const { openRepair } = useLinkedRequest()

  React.useEffect(() => {
    if (query.isError && query.error) {
      // Per spec: hide the button on error, log for diagnostics, never toast.
      console.error('[LinkedRequestButton] resolver failed', query.error)
    }
  }, [query.isError, query.error])

  if (!enabled) return null
  if (query.isLoading) {
    return (
      <Skeleton
        data-testid="linked-request-button-skeleton"
        className="h-8 w-48 mt-2"
      />
    )
  }
  if (query.isError) return null
  const data = query.data
  if (!data || data.active_count === 0) return null

  const label =
    data.active_count > 1
      ? STRINGS.buttonMultiActive(data.active_count)
      : STRINGS.buttonSingleActive

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-2"
      role="status"
      aria-live="polite"
      aria-label={STRINGS.buttonAriaLabel(equipment.ma_thiet_bi)}
      onClick={() => openRepair(equipment.id)}
    >
      <span aria-hidden="true">⚠</span>
      <span className="ml-1">{label}</span>
      <span className="ml-1" aria-hidden="true">→</span>
    </Button>
  )
}
```

- [ ] **Step 2.4.4: Re-run tests, gates.**

```bash
node scripts/npm-run.js run test:run -- src/components/equipment-linked-request/__tests__/LinkedRequestButton.test.tsx
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
```

Expected: 6/6 pass; gates clean.

- [ ] **Step 2.4.5: Commit.**

```bash
git add src/components/equipment-linked-request/LinkedRequestButton.tsx \
        src/components/equipment-linked-request/__tests__/LinkedRequestButton.test.tsx
git commit -m "$(cat <<'EOF'
feat(equipment-linked-request): add LinkedRequestButton component

Status-gated chip that fires the resolver only for 'Chờ sửa chữa' devices,
hides itself on zero-active or error, and announces single vs multi-active
via Vietnamese labels. Click → openRepair(equipmentId). Phase 1 of #338.
Six user-event tests cover the full render matrix.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 2.5 — `repairRequestSheetAdapter` (read/detail parity wrapper)

**Files:**
- Create: `src/components/equipment-linked-request/adapters/repairRequestSheetAdapter.tsx`

The adapter is intentionally tiny — it composes `RepairRequestsDetailView` with the multi-active alert and the footer "Mở trong trang Yêu cầu sửa chữa" link. It is loaded via `next/dynamic` from `LinkedRequestSheetHost` (Task 2.6) so its dependencies do not ship in the equipment route initial chunk.

- [ ] **Step 2.5.1: Read `RepairRequestsDetailView` to confirm its public props.**

```bash
sed -n '1,60p' 'src/app/(app)/repair-requests/_components/RepairRequestsDetailView.tsx'
```

- [ ] **Step 2.5.2: Implement the adapter.** No tests for the adapter alone — it is exercised through `LinkedRequestSheetHost` tests (Task 2.6) and the integration tests in Chunk 3.

```tsx
'use client'

import * as React from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buildRepairRequestsByEquipmentHref } from '@/lib/repair-request-deep-link'
import { RepairRequestsDetailView } from '@/app/(app)/repair-requests/_components/RepairRequestsDetailView'
import type { RepairRequestWithEquipment } from '@/app/(app)/repair-requests/types'
import { STRINGS } from '../strings'

export interface RepairRequestSheetAdapterProps {
  request: RepairRequestWithEquipment
  activeCount: number
  onClose: () => void
}

/**
 * Phase 1 read/detail parity adapter. Wraps the existing repair-requests
 * detail sheet so it can be opened from Equipment Detail without surfacing
 * any mutation actions (those still live on the /repair-requests page).
 *
 * Loaded lazily via next/dynamic from LinkedRequestSheetHost.
 */
export default function RepairRequestSheetAdapter({
  request,
  activeCount,
  onClose,
}: RepairRequestSheetAdapterProps) {
  const showMultiActiveAlert = activeCount > 1
  const openInRepairRequestsHref = buildRepairRequestsByEquipmentHref(request.thiet_bi_id)

  return (
    <>
      {showMultiActiveAlert ? (
        <Alert role="alert" variant="destructive" className="mx-4 mt-3">
          <AlertDescription>{STRINGS.multiActiveAlert(activeCount)}</AlertDescription>
        </Alert>
      ) : null}
      <RepairRequestsDetailView requestToView={request} onClose={onClose} />
      <div className="px-4 pb-4 -mt-1">
        <a
          href={openInRepairRequestsHref}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {STRINGS.footerOpenInRepairRequests}
        </a>
      </div>
    </>
  )
}
```

- [ ] **Step 2.5.3: Verify typecheck.**

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
```

- [ ] **Step 2.5.4: Commit.**

```bash
git add src/components/equipment-linked-request/adapters/repairRequestSheetAdapter.tsx
git commit -m "$(cat <<'EOF'
feat(equipment-linked-request): add repairRequestSheetAdapter

Thin wrapper around RepairRequestsDetailView that injects the multi-active
warning Alert and the 'Mở trong trang Yêu cầu sửa chữa' footer link.
Default-exported so LinkedRequestSheetHost can lazy-load it via next/dynamic.

Phase 1 of #338. Read/detail parity only — no mutation actions surfaced.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 2.6 — `LinkedRequestSheetHost` (TDD)

**Files:**
- Create: `src/components/equipment-linked-request/__tests__/LinkedRequestSheetHost.test.tsx`
- Create: `src/components/equipment-linked-request/LinkedRequestSheetHost.tsx`

`LinkedRequestSheetHost`:

1. Reads `state` from `LinkedRequestProvider`.
2. When `state.open && state.kind === 'repair'`, runs `useResolveActiveRepair({ equipmentId, enabled: true })` to get the request payload.
3. If the resolver returns `active_count === 0`, calls `close()` and emits the auto-close toast.
4. Otherwise, renders the `repairRequestSheetAdapter` (lazy-loaded) with the request payload.

Tests mock the lazy adapter to a stub that asserts on its props.

- [ ] **Step 2.6.1: Write the failing test file.**

```tsx
import * as React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCallRpc = vi.fn()
const mockToast = vi.fn()

vi.mock('@/lib/rpc-client', () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}))

// Stub the lazy adapter to a synchronous component so we can read its props.
vi.mock('../adapters/repairRequestSheetAdapter', () => ({
  default: ({ request, activeCount, onClose }: {
    request: { id: number }
    activeCount: number
    onClose: () => void
  }) => (
    <div data-testid="adapter-stub">
      <span data-testid="adapter-request-id">{request.id}</span>
      <span data-testid="adapter-active-count">{activeCount}</span>
      <button type="button" onClick={onClose}>stub-close</button>
    </div>
  ),
}))

// Force next/dynamic to resolve synchronously to the mocked module.
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    let Component: React.ComponentType<unknown> | null = null
    let pending = true
    let promise: Promise<unknown> | null = null
    return function Dynamic(props: Record<string, unknown>) {
      if (Component) return <Component {...props} />
      if (!promise) {
        promise = loader().then((mod) => {
          Component = mod.default
          pending = false
        })
      }
      if (pending) throw promise
      return null
    }
  },
}))

import { LinkedRequestProvider, useLinkedRequest } from '../LinkedRequestContext'
import { LinkedRequestSheetHost } from '../LinkedRequestSheetHost'
import { EquipmentDialogContext } from '@/app/(app)/equipment/_components/EquipmentDialogContext'

function makeEquipmentDialogStub(isDetailOpen = true) {
  return {
    user: null,
    isGlobal: false,
    isRegionalLeader: false,
    dialogState: {
      isAddOpen: false, isImportOpen: false, isColumnsOpen: false,
      isDetailOpen, isStartUsageOpen: false, isEndUsageOpen: false,
      isDeleteOpen: false, detailEquipment: null, startUsageEquipment: null,
      endUsageLog: null, deleteTarget: null, deleteSource: null,
    },
    openAddDialog: vi.fn(), openImportDialog: vi.fn(), openColumnsDialog: vi.fn(),
    openDetailDialog: vi.fn(), openStartUsageDialog: vi.fn(),
    openEndUsageDialog: vi.fn(), openDeleteDialog: vi.fn(),
    closeAddDialog: vi.fn(), closeImportDialog: vi.fn(), closeColumnsDialog: vi.fn(),
    closeDetailDialog: vi.fn(), closeStartUsageDialog: vi.fn(),
    closeEndUsageDialog: vi.fn(), closeDeleteDialog: vi.fn(),
    closeAllDialogs: vi.fn(), onDataMutationSuccess: vi.fn(),
  }
}

function Renderer({ equipmentId }: { equipmentId: number | null }) {
  const linked = useLinkedRequest()
  React.useEffect(() => {
    if (equipmentId !== null) linked.openRepair(equipmentId)
  }, [linked, equipmentId])
  return <LinkedRequestSheetHost />
}

function renderHost({ equipmentId = 11 }: { equipmentId?: number | null } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>
      <EquipmentDialogContext.Provider value={makeEquipmentDialogStub()}>
        <LinkedRequestProvider>
          <React.Suspense fallback={<div data-testid="suspense" />}>
            <Renderer equipmentId={equipmentId} />
          </React.Suspense>
        </LinkedRequestProvider>
      </EquipmentDialogContext.Provider>
    </QueryClientProvider>,
  )
}

describe('LinkedRequestSheetHost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockReset()
    mockToast.mockReset()
  })

  it('renders nothing when state is closed', () => {
    renderHost({ equipmentId: null })
    expect(screen.queryByTestId('adapter-stub')).toBeNull()
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it('renders the adapter with the resolved request when active_count >= 1', async () => {
    mockCallRpc.mockResolvedValueOnce({
      active_count: 1,
      request: { id: 555, thiet_bi_id: 11 },
    })
    renderHost({ equipmentId: 11 })

    const adapter = await screen.findByTestId('adapter-stub')
    expect(adapter).toBeInTheDocument()
    expect(screen.getByTestId('adapter-request-id').textContent).toBe('555')
    expect(screen.getByTestId('adapter-active-count').textContent).toBe('1')
  })

  it('passes activeCount through to the adapter for multi-active', async () => {
    mockCallRpc.mockResolvedValueOnce({
      active_count: 3,
      request: { id: 999, thiet_bi_id: 11 },
    })
    renderHost({ equipmentId: 11 })
    await screen.findByTestId('adapter-stub')
    expect(screen.getByTestId('adapter-active-count').textContent).toBe('3')
  })

  it('auto-closes and toasts when resolver returns active_count: 0 while open', async () => {
    mockCallRpc.mockResolvedValueOnce({ active_count: 0, request: null })
    renderHost({ equipmentId: 11 })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: 'Yêu cầu đã được hoàn thành' })
    })
    expect(screen.queryByTestId('adapter-stub')).toBeNull()
  })
})
```

- [ ] **Step 2.6.2: Run the tests, confirm they fail.**

```bash
node scripts/npm-run.js run test:run -- src/components/equipment-linked-request/__tests__/LinkedRequestSheetHost.test.tsx
```

- [ ] **Step 2.6.3: Implement the host.**

```tsx
'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { toast } from '@/hooks/use-toast'
import { useLinkedRequest } from './LinkedRequestContext'
import { useResolveActiveRepair } from './resolvers/useResolveActiveRepair'
import type { RepairRequestSheetAdapterProps } from './adapters/repairRequestSheetAdapter'
import { STRINGS } from './strings'

const RepairRequestSheetAdapter = dynamic<RepairRequestSheetAdapterProps>(
  () => import('./adapters/repairRequestSheetAdapter'),
  { ssr: false },
)

/**
 * Mounts the active-request side sheet at page level (sibling of
 * EquipmentDetailDialog). Keeps the sheet detached from Equipment Detail's
 * internal tree so a single user click swaps the topmost overlay without
 * unmounting the underlying dialog.
 *
 * Auto-close behaviour for parent dismissal lives in LinkedRequestProvider;
 * auto-close-on-stale (active_count flips to 0) lives here because it
 * depends on the resolver result.
 */
export function LinkedRequestSheetHost() {
  const { state, close } = useLinkedRequest()

  const enabled = state.open && state.kind === 'repair'
  const equipmentId = enabled ? state.equipmentId : null
  const query = useResolveActiveRepair({ equipmentId, enabled })

  // Auto-close when the resolver settles with no active record.
  const data = query.data
  React.useEffect(() => {
    if (!enabled) return
    if (data && data.active_count === 0) {
      close()
      toast({ title: STRINGS.autoCloseToastTitle })
    }
  }, [enabled, data, close])

  if (!enabled || !data || data.active_count === 0 || !data.request) {
    return null
  }

  return (
    <RepairRequestSheetAdapter
      request={data.request}
      activeCount={data.active_count}
      onClose={close}
    />
  )
}
```

- [ ] **Step 2.6.4: Re-run tests, gates.**

```bash
node scripts/npm-run.js run test:run -- src/components/equipment-linked-request/__tests__/LinkedRequestSheetHost.test.tsx
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
```

Expected: 4/4 pass; gates clean.

- [ ] **Step 2.6.5: Commit.**

```bash
git add src/components/equipment-linked-request/LinkedRequestSheetHost.tsx \
        src/components/equipment-linked-request/__tests__/LinkedRequestSheetHost.test.tsx
git commit -m "$(cat <<'EOF'
feat(equipment-linked-request): add LinkedRequestSheetHost

Mounts the active-request side sheet at page level via lazy-loaded
repairRequestSheetAdapter. Auto-closes (with toast) when the resolver
settles to active_count: 0. Phase 1 of #338.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 2.7 — Barrel export

**File:**
- Create: `src/components/equipment-linked-request/index.ts`

- [ ] **Step 2.7.1: Create the barrel.**

```ts
export { LinkedRequestProvider, useLinkedRequest } from './LinkedRequestContext'
export type { LinkedRequestContextValue } from './LinkedRequestContext'
export { LinkedRequestButton } from './LinkedRequestButton'
export { LinkedRequestSheetHost } from './LinkedRequestSheetHost'
export type { LinkedRequestKind, LinkedRequestState, ActiveRepairResult } from './types'
```

- [ ] **Step 2.7.2: Verify typecheck.**

```bash
node scripts/npm-run.js run typecheck
```

- [ ] **Step 2.7.3: Commit.**

```bash
git add src/components/equipment-linked-request/index.ts
git commit -m "$(cat <<'EOF'
feat(equipment-linked-request): expose package via index.ts barrel

Phase 1 of #338. Consumers import from '@/components/equipment-linked-request'.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### End of Chunk 2 — definition of done

- [ ] All Chunk 2 tests pass: `node scripts/npm-run.js run test:run -- src/components/equipment-linked-request/`
- [ ] `verify:no-explicit-any` and `typecheck` pass.
- [ ] Six commits in this chunk: types+strings / resolver hook / context / button / adapter / sheet host / barrel (some may be merged at the implementer's discretion as long as each TDD red→green cycle is preserved in history).
- [ ] No file in `src/components/equipment-linked-request/` exceeds ~200 lines; if any does, it is doing too much and should be split.

---

## Chunk 3: Integration — wire into Equipment page, integration tests, adoption test, N+1 guard, final verification

This chunk lights up the feature for users. Provider is mounted at the page level, the sheet host becomes a sibling of `EquipmentDetailDialog`, and the button appears in the status section. Integration tests then prove the cross-component contract holds — race-free, no N+1, auto-close behaviour intact.

**Files in this chunk:**
- Modify: `src/app/(app)/equipment/_components/EquipmentPageClient.tsx`
- Modify: `src/app/(app)/equipment/equipment-dialogs.tsx`
- Modify: `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailStatusSection.tsx`
- Create: `src/app/(app)/equipment/_components/EquipmentDetailDialog/__tests__/EquipmentDetailLinkedRequest.integration.test.tsx`
- Modify: `src/lib/__tests__/repair-request-deep-link.adoption.test.ts`
- Modify: `CLAUDE.md`

### Task 3.1 — Wire `LinkedRequestProvider` at page level

**File:**
- Modify: `src/app/(app)/equipment/_components/EquipmentPageClient.tsx`

- [ ] **Step 3.1.1: Read the current page client** to find where `EquipmentDialogProvider` wraps the tree.

```bash
sed -n '60,95p' 'src/app/(app)/equipment/_components/EquipmentPageClient.tsx'
```

Expected: `EquipmentDialogProvider` wraps `EquipmentPageContent`. The new provider goes inside `EquipmentDialogProvider` (so it can subscribe to it for auto-close).

- [ ] **Step 3.1.2: Add the import.** At the top of the file, alongside the existing `EquipmentDialogProvider` import:

```tsx
import { LinkedRequestProvider } from '@/components/equipment-linked-request'
```

- [ ] **Step 3.1.3: Wrap `EquipmentPageContent` with the new provider** inside the existing `EquipmentDialogProvider`. The exact block:

```tsx
return (
  <EquipmentDialogProvider effectiveTenantKey={pageState.effectiveTenantKey}>
    <LinkedRequestProvider>
      <EquipmentPageContent pageState={pageState} />
    </LinkedRequestProvider>
  </EquipmentDialogProvider>
)
```

- [ ] **Step 3.1.4: Verify typecheck.**

```bash
node scripts/npm-run.js run typecheck
```

- [ ] **Step 3.1.5: Run the full equipment-page test suite** to make sure no existing test broke.

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/equipment'
```

Expected: green. Existing tests do not assert on the provider presence, so wrapping is transparent.

- [ ] **Step 3.1.6: Commit.**

```bash
git add 'src/app/(app)/equipment/_components/EquipmentPageClient.tsx'
git commit -m "$(cat <<'EOF'
feat(equipment): mount LinkedRequestProvider at page level

Sibling of EquipmentDialogProvider; required so LinkedRequestButton (in
Equipment Detail) and LinkedRequestSheetHost (in equipment-dialogs) can
share state. Phase 1 of #338.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 3.2 — Mount `LinkedRequestSheetHost` next to `EquipmentDetailDialog`

**File:**
- Modify: `src/app/(app)/equipment/equipment-dialogs.tsx`

- [ ] **Step 3.2.1: Add the import** alongside the other equipment dialog imports.

```tsx
import { LinkedRequestSheetHost } from '@/components/equipment-linked-request'
```

- [ ] **Step 3.2.2: Render `<LinkedRequestSheetHost />`** as a sibling of `<EquipmentDetailDialog />` (anywhere inside the returned fragment after the dialog is fine; placing it immediately after keeps the relationship visible).

```tsx
<EquipmentDetailDialog
  equipment={dialogState.detailEquipment}
  open={dialogState.isDetailOpen}
  // …existing props…
/>

<LinkedRequestSheetHost />
```

- [ ] **Step 3.2.3: Verify typecheck.**

```bash
node scripts/npm-run.js run typecheck
```

- [ ] **Step 3.2.4: Run the equipment-page test suite again.**

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/equipment'
```

Expected: still green.

- [ ] **Step 3.2.5: Commit.**

```bash
git add 'src/app/(app)/equipment/equipment-dialogs.tsx'
git commit -m "$(cat <<'EOF'
feat(equipment): mount LinkedRequestSheetHost as sibling of detail dialog

Sibling overlay (Sheet z-1002 over Dialog z-1000); host renders nothing
unless LinkedRequestProvider state is open. Phase 1 of #338.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 3.3 — Render `LinkedRequestButton` in the status section

**File:**
- Modify: `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailStatusSection.tsx`

The button must render **only in read-mode** (i.e., when the parent dialog is **not** in inline-edit mode). The component currently has no awareness of edit mode — the parent passes a flag, or we can read it from the form's pristine state. Simplest contract: extend `EquipmentDetailStatusSection` props with `equipment` and `isEditing`, and have the parent (the `EquipmentDetailDetailsTab` consumer) thread them through.

- [ ] **Step 3.3.1: Read the existing status section** and find the smallest place to inject the button.

```bash
sed -n '1,60p' 'src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailStatusSection.tsx'
```

The current component renders `tinh_trang_hien_tai`, `ghi_chu`, and `phan_loai_theo_nd98` form fields without action buttons.

- [ ] **Step 3.3.2: Locate the parent that already knows the edit-mode flag.**

```bash
grep -rn 'EquipmentDetailStatusSection' 'src/app/(app)/equipment/_components/EquipmentDetailDialog' --include '*.tsx'
```

Expected: `EquipmentDetailDetailsTab.tsx` (or similar) is the consumer that already has both `equipment` and the `isEditingDetails` flag from the dialog state.

- [ ] **Step 3.3.3: Extend `EquipmentDetailStatusSection` props** with two optional fields:

```tsx
import type { Equipment } from '@/types/database'
import { LinkedRequestButton } from '@/components/equipment-linked-request'

interface EquipmentDetailStatusSectionProps {
  equipment?: Equipment | null
  isEditing?: boolean
}

export function EquipmentDetailStatusSection({
  equipment,
  isEditing,
}: EquipmentDetailStatusSectionProps = {}) {
  // existing form code…
  return (
    <>
      {/* existing FormField for tinh_trang_hien_tai */}
      {!isEditing && equipment ? (
        <LinkedRequestButton kind="repair" equipment={equipment} />
      ) : null}
      {/* existing FormField for ghi_chu, phan_loai_theo_nd98 */}
    </>
  )
}
```

- [ ] **Step 3.3.4: Update the consumer (likely `EquipmentDetailDetailsTab`)** to pass `equipment` and `isEditing` through. Locate the call site (use the grep from Step 3.3.2) and add the props.

- [ ] **Step 3.3.5: Run typecheck and the equipment test suite.**

```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- 'src/app/(app)/equipment'
```

Expected: green. Existing tests of the detail dialog do not pass these props because they are optional with sensible defaults (button absent when no `equipment`).

- [ ] **Step 3.3.6: Commit.**

```bash
git add 'src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailStatusSection.tsx' \
        'src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailDetailsTab.tsx'
git commit -m "$(cat <<'EOF'
feat(equipment): render LinkedRequestButton in status section (read-mode)

Button is hidden during inline edit to avoid confusion when the user is
mid-change of tinh_trang_hien_tai. Phase 1 of #338.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 3.4 — Integration tests (TDD — written **before** verification, prove the cross-component contract)

**File:**
- Create: `src/app/(app)/equipment/_components/EquipmentDetailDialog/__tests__/EquipmentDetailLinkedRequest.integration.test.tsx`

These six scenarios are the spec's Layer-4 matrix. They wrap the real `LinkedRequestProvider`, real `LinkedRequestSheetHost`, and a real `EquipmentDetailDialog` (or the minimal subset needed to render the status section). RPC layer is mocked at `callRpc`.

- [ ] **Step 3.4.1: Read existing integration test patterns** to match conventions.

```bash
ls 'src/app/(app)/equipment/__tests__'
ls 'src/app/(app)/equipment/_components/EquipmentDetailDialog/__tests__' 2>/dev/null || true
```

- [ ] **Step 3.4.2: Author the test file.**

```tsx
import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCallRpc = vi.fn()
const mockToast = vi.fn()

vi.mock('@/lib/rpc-client', () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}))

// Force the lazy adapter to render synchronously with a recognisable testid.
vi.mock('@/components/equipment-linked-request/adapters/repairRequestSheetAdapter', () => ({
  default: ({ request, activeCount, onClose }: {
    request: { id: number; mo_ta_su_co?: string }
    activeCount: number
    onClose: () => void
  }) => (
    <div data-testid="repair-sheet">
      <span data-testid="repair-sheet-id">{request.id}</span>
      <span data-testid="repair-sheet-active-count">{activeCount}</span>
      <span data-testid="repair-sheet-desc">{request.mo_ta_su_co ?? ''}</span>
      <button type="button" onClick={onClose}>close</button>
    </div>
  ),
}))

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    let Component: React.ComponentType<unknown> | null = null
    let pending = true
    let promise: Promise<unknown> | null = null
    return function Dynamic(props: Record<string, unknown>) {
      if (Component) return <Component {...props} />
      if (!promise) {
        promise = loader().then((mod) => {
          Component = mod.default
          pending = false
        })
      }
      if (pending) throw promise
      return null
    }
  },
}))

import {
  LinkedRequestProvider,
  LinkedRequestSheetHost,
} from '@/components/equipment-linked-request'
import { EquipmentDialogProvider } from '@/app/(app)/equipment/_components/EquipmentDialogContext'
import { EquipmentDetailDialog } from '@/app/(app)/equipment/_components/EquipmentDetailDialog'
import {
  useCompleteRepairRequest,
  useUpdateRepairRequest,
} from '@/hooks/use-cached-repair'
import type { Equipment } from '@/types/database'

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 1,
    ma_thiet_bi: 'TB-INT-1',
    ten_thiet_bi: 'Máy siêu âm tích hợp',
    tinh_trang_hien_tai: 'Chờ sửa chữa',
    khoa_phong_quan_ly: 'Khoa A',
    ...(overrides as Record<string, unknown>),
  } as Equipment
}

function renderApp(equipment: Equipment | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>
      <EquipmentDialogProvider effectiveTenantKey="test">
        <LinkedRequestProvider>
          <EquipmentDetailDialog
            equipment={equipment}
            open={equipment !== null}
            onOpenChange={() => {}}
            user={null}
            isRegionalLeader={false}
            onGenerateProfileSheet={() => {}}
            onGenerateDeviceLabel={() => {}}
            onEquipmentUpdated={() => {}}
          />
          <LinkedRequestSheetHost />
        </LinkedRequestProvider>
      </EquipmentDialogProvider>
    </QueryClientProvider>,
  )
}

describe('EquipmentDetailDialog × LinkedRequest integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockReset()
    mockToast.mockReset()
  })

  it('happy path: opens the side sheet for an active "Chờ sửa chữa" equipment', async () => {
    mockCallRpc
      .mockImplementationOnce(({ fn }) => {
        if (fn === 'equipment_history_list') return Promise.resolve([])
        return Promise.resolve(undefined)
      })
      .mockImplementationOnce(({ fn }) => {
        if (fn === 'repair_request_active_for_equipment') {
          return Promise.resolve({
            active_count: 1,
            request: { id: 7777, thiet_bi_id: 1, mo_ta_su_co: 'Lỗi nguồn' },
          })
        }
        return Promise.resolve(undefined)
      })

    const user = userEvent.setup()
    renderApp(makeEquipment())

    const btn = await screen.findByRole('button', {
      name: /Yêu cầu sửa chữa hiện tại của thiết bị TB-INT-1/i,
    })
    await user.click(btn)

    const sheetId = await screen.findByTestId('repair-sheet-id')
    expect(sheetId.textContent).toBe('7777')
    expect(screen.getByTestId('repair-sheet-desc').textContent).toBe('Lỗi nguồn')
  })

  it('status mismatch: button never appears for "Hoạt động"; resolver never called', async () => {
    mockCallRpc.mockImplementation(({ fn }) => {
      if (fn === 'equipment_history_list') return Promise.resolve([])
      return Promise.resolve(undefined)
    })

    renderApp(makeEquipment({ tinh_trang_hien_tai: 'Hoạt động' }))

    // Wait long enough for any speculative resolver call.
    await new Promise((r) => setTimeout(r, 50))

    expect(screen.queryByRole('button', {
      name: /Yêu cầu sửa chữa hiện tại/i,
    })).toBeNull()

    const resolverCalls = mockCallRpc.mock.calls.filter(
      (c) => (c[0] as { fn: string }).fn === 'repair_request_active_for_equipment'
    )
    expect(resolverCalls).toHaveLength(0)
  })

  it('switch-equipment race: only equipment 2 data is visible after the swap', async () => {
    // equipment 1 history → equipment 1 resolver → equipment 2 history → equipment 2 resolver
    mockCallRpc.mockImplementation(({ fn, args }) => {
      if (fn === 'equipment_history_list') return Promise.resolve([])
      if (fn === 'repair_request_active_for_equipment') {
        const tb = (args as { p_thiet_bi_id: number }).p_thiet_bi_id
        return new Promise((resolve) => {
          // small staggered delay so resolver-1 lands AFTER we have already
          // swapped to equipment-2 in the dialog.
          setTimeout(
            () => resolve({
              active_count: 1,
              request: { id: tb * 100, thiet_bi_id: tb, mo_ta_su_co: `eq-${tb}` },
            }),
            tb === 1 ? 30 : 5,
          )
        })
      }
      return Promise.resolve(undefined)
    })

    const { rerender } = renderApp(makeEquipment({ id: 1, ma_thiet_bi: 'TB-1' }))

    // immediately swap to equipment 2
    rerender(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      })}>
        <EquipmentDialogProvider effectiveTenantKey="test">
          <LinkedRequestProvider>
            <EquipmentDetailDialog
              equipment={makeEquipment({ id: 2, ma_thiet_bi: 'TB-2' })}
              open
              onOpenChange={() => {}}
              user={null}
              isRegionalLeader={false}
              onGenerateProfileSheet={() => {}}
              onGenerateDeviceLabel={() => {}}
              onEquipmentUpdated={() => {}}
            />
            <LinkedRequestSheetHost />
          </LinkedRequestProvider>
        </EquipmentDialogProvider>
      </QueryClientProvider>,
    )

    // Click the equipment-2 button once it appears.
    const user = userEvent.setup()
    const btn = await screen.findByRole('button', {
      name: /Yêu cầu sửa chữa hiện tại của thiết bị TB-2/i,
    })
    await user.click(btn)

    const sheetId = await screen.findByTestId('repair-sheet-id')
    // equipment 2 should win; equipment 1 data must never appear.
    expect(sheetId.textContent).toBe('200')
    expect(screen.queryByText('eq-1')).toBeNull()

    // Both resolver calls happened with the correct equipment IDs.
    const resolverCalls = mockCallRpc.mock.calls.filter(
      (c) => (c[0] as { fn: string }).fn === 'repair_request_active_for_equipment'
    )
    const seenIds = resolverCalls.map(
      (c) => ((c[0] as { args: { p_thiet_bi_id: number } }).args.p_thiet_bi_id),
    )
    expect(new Set(seenIds)).toEqual(new Set([1, 2]))
  })

  it('external-mutation auto-close: completing the request elsewhere closes the sheet + toasts', async () => {
    let resolverActive = true
    mockCallRpc.mockImplementation(({ fn }) => {
      if (fn === 'equipment_history_list') return Promise.resolve([])
      if (fn === 'repair_request_active_for_equipment') {
        return Promise.resolve(resolverActive
          ? { active_count: 1, request: { id: 5, thiet_bi_id: 1 } }
          : { active_count: 0, request: null })
      }
      if (fn === 'repair_request_complete') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })

    const user = userEvent.setup()
    const utils = renderApp(makeEquipment())

    // Open the sheet.
    const btn = await screen.findByRole('button', {
      name: /Yêu cầu sửa chữa hiện tại của thiết bị TB-INT-1/i,
    })
    await user.click(btn)
    await screen.findByTestId('repair-sheet')

    // External mutation: a different component completes the same request,
    // then resolver returns 0 next time. Mutation invalidates repairKeys.all
    // (covered by use-cached-repair.invalidation.test.ts), which forces the
    // resolver to refetch.
    function ExternalActor() {
      const m = useCompleteRepairRequest()
      React.useEffect(() => {
        resolverActive = false
        m.mutate({ id: '5', ket_qua: 'Đã sửa xong' })
      }, [m])
      return null
    }
    utils.rerender(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      })}>
        <EquipmentDialogProvider effectiveTenantKey="test">
          <LinkedRequestProvider>
            <EquipmentDetailDialog
              equipment={makeEquipment()}
              open
              onOpenChange={() => {}}
              user={null}
              isRegionalLeader={false}
              onGenerateProfileSheet={() => {}}
              onGenerateDeviceLabel={() => {}}
              onEquipmentUpdated={() => {}}
            />
            <LinkedRequestSheetHost />
            <ExternalActor />
          </LinkedRequestProvider>
        </EquipmentDialogProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: 'Yêu cầu đã được hoàn thành' })
    })
    expect(screen.queryByTestId('repair-sheet')).toBeNull()
  })

  it('update-mutation alignment: useUpdateRepairRequest invalidates the active resolver', async () => {
    mockCallRpc.mockImplementation(({ fn }) => {
      if (fn === 'equipment_history_list') return Promise.resolve([])
      if (fn === 'repair_request_active_for_equipment') {
        return Promise.resolve({
          active_count: 1,
          request: { id: 9, thiet_bi_id: 1, mo_ta_su_co: 'Initial' },
        })
      }
      if (fn === 'repair_request_update') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })

    const user = userEvent.setup()
    const utils = renderApp(makeEquipment())
    const btn = await screen.findByRole('button', {
      name: /Yêu cầu sửa chữa hiện tại/i,
    })
    await user.click(btn)
    await screen.findByTestId('repair-sheet')

    // Reset call counter so we can assert that the next resolver fetch was
    // triggered by the mutation.
    const beforeUpdate = mockCallRpc.mock.calls.filter(
      (c) => (c[0] as { fn: string }).fn === 'repair_request_active_for_equipment'
    ).length

    function ExternalUpdater() {
      const m = useUpdateRepairRequest()
      React.useEffect(() => {
        m.mutate({ id: '9', data: { mo_ta_su_co: 'Updated' } })
      }, [m])
      return null
    }
    utils.rerender(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      })}>
        <EquipmentDialogProvider effectiveTenantKey="test">
          <LinkedRequestProvider>
            <EquipmentDetailDialog
              equipment={makeEquipment()}
              open
              onOpenChange={() => {}}
              user={null}
              isRegionalLeader={false}
              onGenerateProfileSheet={() => {}}
              onGenerateDeviceLabel={() => {}}
              onEquipmentUpdated={() => {}}
            />
            <LinkedRequestSheetHost />
            <ExternalUpdater />
          </LinkedRequestProvider>
        </EquipmentDialogProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      const afterUpdate = mockCallRpc.mock.calls.filter(
        (c) => (c[0] as { fn: string }).fn === 'repair_request_active_for_equipment'
      ).length
      expect(afterUpdate).toBeGreaterThan(beforeUpdate)
    })
  })

  it('parent dismissal closes the sheet', async () => {
    mockCallRpc.mockImplementation(({ fn }) => {
      if (fn === 'equipment_history_list') return Promise.resolve([])
      if (fn === 'repair_request_active_for_equipment') {
        return Promise.resolve({
          active_count: 1,
          request: { id: 6, thiet_bi_id: 1 },
        })
      }
      return Promise.resolve(undefined)
    })

    const user = userEvent.setup()
    const utils = renderApp(makeEquipment())

    const btn = await screen.findByRole('button', {
      name: /Yêu cầu sửa chữa hiện tại/i,
    })
    await user.click(btn)
    await screen.findByTestId('repair-sheet')

    // close Equipment Detail by re-rendering with equipment=null
    utils.rerender(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      })}>
        <EquipmentDialogProvider effectiveTenantKey="test">
          <LinkedRequestProvider>
            <EquipmentDetailDialog
              equipment={null}
              open={false}
              onOpenChange={() => {}}
              user={null}
              isRegionalLeader={false}
              onGenerateProfileSheet={() => {}}
              onGenerateDeviceLabel={() => {}}
              onEquipmentUpdated={() => {}}
            />
            <LinkedRequestSheetHost />
          </LinkedRequestProvider>
        </EquipmentDialogProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.queryByTestId('repair-sheet')).toBeNull()
    })
  })

  it('N+1 guard: rendering the equipment list never fires the resolver', async () => {
    // Render the equipment table fixture (smallest viable substitute is a
    // simple list of EquipmentDetailDialog-less rows). Use the test utility
    // already present under src/app/(app)/equipment/__tests__ if available;
    // otherwise render a stub list of 50 fake rows.
    mockCallRpc.mockImplementation(({ fn }) => {
      if (fn === 'equipment_history_list') return Promise.resolve([])
      return Promise.resolve(undefined)
    })

    function ListStub() {
      const items = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        ma_thiet_bi: `TB-${i + 1}`,
        tinh_trang_hien_tai: i % 5 === 0 ? 'Chờ sửa chữa' : 'Hoạt động',
      }))
      return (
        <ul>
          {items.map((it) => (
            <li key={it.id}>{it.ma_thiet_bi}: {it.tinh_trang_hien_tai}</li>
          ))}
        </ul>
      )
    }

    render(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      })}>
        <EquipmentDialogProvider effectiveTenantKey="test">
          <LinkedRequestProvider>
            <ListStub />
          </LinkedRequestProvider>
        </EquipmentDialogProvider>
      </QueryClientProvider>,
    )

    await new Promise((r) => setTimeout(r, 50))
    const resolverCalls = mockCallRpc.mock.calls.filter(
      (c) => (c[0] as { fn: string }).fn === 'repair_request_active_for_equipment'
    )
    expect(resolverCalls).toHaveLength(0)
  })
})
```

- [ ] **Step 3.4.3: Run the integration tests.** They should all pass on the first run since each step in Tasks 3.1–3.3 has been individually verified.

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/equipment/_components/EquipmentDetailDialog/__tests__/EquipmentDetailLinkedRequest.integration.test.tsx'
```

Expected: 7/7 pass. If the switch-equipment race test is flaky on slower runners, raise the staggered timeouts (30 → 50, 5 → 10) but **do not** weaken the assertions.

- [ ] **Step 3.4.4: Run gates.**

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
```

- [ ] **Step 3.4.5: Commit.**

```bash
git add 'src/app/(app)/equipment/_components/EquipmentDetailDialog/__tests__/EquipmentDetailLinkedRequest.integration.test.tsx'
git commit -m "$(cat <<'EOF'
test(equipment): integration suite for #338 linked-request side sheet

Seven scenarios cover happy path, status mismatch, switch-equipment race
(asserts no equipment-1 data leaks into equipment-2 view), external
mutation auto-close (useCompleteRepairRequest), update-mutation
alignment (useUpdateRepairRequest invalidates the active resolver),
parent dialog dismissal, and the N+1 guard (the resolver must never fire
during list rendering).

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 3.5 — Adoption-test extension

**File:**
- Modify: `src/lib/__tests__/repair-request-deep-link.adoption.test.ts`

This test now also enforces:

1. The `equipment-linked-request` package imports URL builders only from `@/lib/repair-request-deep-link` (no hardcoded `/repair-requests?...`).
2. `LinkedRequestButton` is **not** imported by the three row-level files (anti-N+1).

- [ ] **Step 3.5.1: Read the existing adoption test** to match its style.

```bash
cat src/lib/__tests__/repair-request-deep-link.adoption.test.ts
```

- [ ] **Step 3.5.2: Append the two new test cases.** Use `fs.readFileSync` against the source files and assert on substrings; keep imports inline at the top of the file. Use the existing helpers if any.

```ts
import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '../../..')

function read(rel: string) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
}

describe('repair-request deep-link adoption — equipment-linked-request package', () => {
  it('shared package imports URL builders from @/lib/repair-request-deep-link only', () => {
    const adapter = read(
      'src/components/equipment-linked-request/adapters/repairRequestSheetAdapter.tsx',
    )
    expect(adapter).toMatch(/@\/lib\/repair-request-deep-link/)
    expect(adapter).not.toMatch(/'\/repair-requests\?/)
  })

  it('LinkedRequestButton is not imported by row-level equipment files (anti-N+1)', () => {
    const candidates = [
      'src/components/equipment/equipment-table-columns.tsx',
      'src/components/equipment/equipment-actions-menu.tsx',
      'src/components/mobile-equipment-list-item.tsx',
    ]
    for (const file of candidates) {
      const src = read(file)
      expect(src).not.toMatch(/LinkedRequestButton/)
      expect(src).not.toMatch(/equipment-linked-request/)
    }
  })
})
```

- [ ] **Step 3.5.3: Run the test, observe pass.**

```bash
node scripts/npm-run.js run test:run -- src/lib/__tests__/repair-request-deep-link.adoption.test.ts
```

Expected: all assertions pass — the shared package was authored to use the helper, and Tasks 3.1–3.3 deliberately did not touch the three row-level files.

- [ ] **Step 3.5.4: Commit.**

```bash
git add src/lib/__tests__/repair-request-deep-link.adoption.test.ts
git commit -m "$(cat <<'EOF'
test(adoption): pin equipment-linked-request package against N+1 + URL hardcoding

Adoption test now also asserts that equipment-linked-request imports URL
builders from @/lib/repair-request-deep-link and that LinkedRequestButton
is not imported from row-level equipment files. Phase 1 of #338.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 3.6 — Document the N+1 guideline in `CLAUDE.md`

**File:**
- Modify: `CLAUDE.md`

This is a tiny doc-only addition so future agents (and humans) know the rule that the adoption test enforces.

- [ ] **Step 3.6.1: Locate the Equipment section** in `CLAUDE.md` (likely near "File Structure" or "Component Architecture"). If no exact section exists, add a short subsection at a sensible place — search first.

```bash
grep -n 'Equipment\|equipment' CLAUDE.md | head -10
```

- [ ] **Step 3.6.2: Append a short rule** (≤80 words). Suggested wording:

```markdown
## Equipment list — N+1 prevention

Per-row indicators that depend on aggregated business state (e.g., "this equipment has an active repair request") MUST be backed by aggregate columns on `equipment_list_enhanced`, not by per-row resolver RPCs. The `LinkedRequestButton` component is rendered **only** inside `EquipmentDetailDialog` (one equipment at a time); it is forbidden from `equipment-table-columns.tsx`, `equipment-actions-menu.tsx`, and `mobile-equipment-list-item.tsx`. Adoption test `src/lib/__tests__/repair-request-deep-link.adoption.test.ts` enforces this.
```

- [ ] **Step 3.6.3: Commit.**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude): note Equipment list N+1 prevention rule

Future per-row indicators must be aggregate columns on
equipment_list_enhanced, not per-row resolver RPCs. Encodes the rule that
the LinkedRequestButton adoption test already enforces. Phase 1 of #338.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 3.7 — Final verification gates and ship

- [ ] **Step 3.7.1: Run the full `verify:no-explicit-any`.**

```bash
node scripts/npm-run.js run verify:no-explicit-any
```

- [ ] **Step 3.7.2: Run typecheck.**

```bash
node scripts/npm-run.js run typecheck
```

- [ ] **Step 3.7.3: Run the touched test suites in one shot.**

```bash
node scripts/npm-run.js run test:run -- \
  src/lib/__tests__/repair-request-deep-link.test.ts \
  src/lib/__tests__/repair-request-deep-link.adoption.test.ts \
  src/hooks/__tests__/use-cached-repair.invalidation.test.ts \
  src/components/equipment-linked-request/ \
  'src/app/(app)/equipment/_components/EquipmentDetailDialog/__tests__/EquipmentDetailLinkedRequest.integration.test.tsx'
```

Expected: all green.

- [ ] **Step 3.7.4: Run `react-doctor` against the diff vs main.**

```bash
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected: 100/100 score, no issues. If issues are reported, fix them inline (they are usually about missing keys or stale `useCallback` deps); do not silence with `eslint-disable`.

- [ ] **Step 3.7.5: Live-DB sanity check.** Verify that the migration is still in place (someone might have re-applied the database from a snapshot during the work).

Use Supabase MCP `execute_sql` against project `cdthersvldpnlbvpufrr`:

```sql
SELECT proname, prolang::regtype, prosecdef
FROM pg_proc
WHERE proname = 'repair_request_active_for_equipment';

SELECT indexname FROM pg_indexes
WHERE tablename = 'yeu_cau_sua_chua' AND indexname = 'idx_yeu_cau_sua_chua_thiet_bi_status';
```

Expected: function exists with `prolang = plpgsql_lang_oid` (display label `language plpgsql`) and `prosecdef = true`; index exists.

- [ ] **Step 3.7.6: Open a PR.**

```bash
git push origin HEAD:phase1-issue-338
gh pr create --title "[#338] Phase 1 — Deep-link active repair request from Equipment Detail (side sheet)" --body "$(cat <<'EOF'
## Summary
Implements Phase 1 of #207 (umbrella) per #338. Adds a status-driven button in Equipment Detail that opens the active repair request in a side sheet via the new shared `equipment-linked-request` module. Read/detail parity only — mutations remain on `/repair-requests`.

#### Test plan
- [x] verify:no-explicit-any
- [x] typecheck
- [x] all touched vitest suites green (Layer 1–6 from spec)
- [x] react-doctor 100/100 vs main
- [x] migration applied via Supabase MCP and `SELECT pg_get_functiondef(...)` confirms `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp`
- [x] composite index `idx_yeu_cau_sua_chua_thiet_bi_status (thiet_bi_id, trang_thai)` present
- [x] smoke SQL `supabase/tests/repair_request_active_for_equipment_smoke.sql` passes ALL SCENARIOS

Closes #338. Refs #207.

Generated with [Devin](https://cli.devin.ai/docs)
EOF
)"
```

### End of Chunk 3 — definition of done

- [ ] All seven integration tests pass.
- [ ] Adoption test extended and passing.
- [ ] `CLAUDE.md` updated with the N+1 rule.
- [ ] All four verification gates green.
- [ ] PR opened against `main`, body lists the test-plan checklist, links #338 (close) and #207 (ref).
- [ ] Plan checkboxes above are all ticked in the implementation history (commit messages).

---

## Cross-cutting reminders

- **Do not** invoke the Supabase CLI in any task. All DB operations go through Supabase MCP (`execute_sql`, `apply_migration`).
- **Do not** add any `// eslint-disable` comment to silence diagnostics. Fix the underlying issue.
- Keep commits small and Conventional. The Devin co-author footer is mandatory per repo policy.
- Use `node scripts/npm-run.js run <script>` for every npm command — direct `npm` calls do not capture stdout reliably in this environment.
- If a step fails unexpectedly, do not edit tests to make them pass. Treat the test as the contract; fix the implementation or escalate.

