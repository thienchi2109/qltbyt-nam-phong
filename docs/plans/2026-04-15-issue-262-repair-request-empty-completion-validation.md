# Issue #262 — Empty Completion Payload Validation (TDD)

## Context

When a user clicks **"Xác nhận hoàn thành"** in `RepairRequestsCompleteDialog` without typing anything, the `Textarea` trims to an empty string and gets passed as empty to `repair_request_complete`. The SQL function then falls through to the `ELSE` branch — silently marking the request as **"Không HT"** instead of "Hoàn thành", with no completion text and no reason. This is a data integrity bug: wrong status stored, user never warned.

The same applies to the "Không HT" path when `nonCompletionReason` is empty — a blank reason should not be accepted.

**Goal:** Block empty-payload submissions at both frontend (disable button) and backend (defense-in-depth).

---

## TDD Steps

TDD cycle per layer: **Red → Green → Refactor**.

### Layer 1 — Frontend: `RepairRequestsCompleteDialog.tsx`

**Test file:** `src/app/(app)/repair-requests/__tests__/RepairRequestsCompleteDialog.test.tsx`

#### Red: Add failing test cases

Add 4 new test cases:

```tsx
it("disables 'Xác nhận hoàn thành' when Kết quả sửa chữa is empty", ...)
it("enables 'Xác nhận hoàn thành' after typing at least one character", ...)
it("disables 'Xác nhận không hoàn thành' when Lý do không hoàn thành is empty", ...)
it("enables 'Xác nhận không hoàn thành' after typing at least one character", ...)
```

Run tests → all 4 should fail (button is not yet disabled).

#### Green: Implement button disabling

In `CompleteDialogForm`, compute derived state from existing `completionResult` / `nonCompletionReason`:

```tsx
const canConfirmHoanThanh = completionType === "Hoàn thành"
  ? completionResult.trim().length > 0
  : true  // always allowed in Không HT path (separate guard below)

const canConfirmKhongHT = completionType === "Không HT"
  ? nonCompletionReason.trim().length > 0
  : true
```

Pass `disabled={isPending || (completionType === "Hoàn thành" ? !completionResult.trim() : !nonCompletionReason.trim())}` to the confirm Button.

#### Refactor: None needed — implementation is straightforward.

---

### Layer 2 — Backend: `repair_request_complete` RPC

**Migration file:** `supabase/migrations/YYYYMMDDHHMMSS_fix_repair_request_complete_empty_payload.sql`

> **Important:** The `repair_request_complete` function is `LANGUAGE plpgsql SECURITY DEFINER`
> but currently **does not** include `SET search_path = public`. This is pre-existing technical debt
> introduced before this plan. The migration must add the missing `SET search_path` clause.
> Without it, a SECURITY DEFINER function inherits the caller's `search_path`, which can be
> exploited via lookups in unexpected schemas. Fix it in the same migration.

#### Red: Add smoke test case

In `supabase/tests/repair_request_cost_smoke.sql`, append a new case. Use the **existing**
temp helper `pg_temp._rr_cost_set_claims` (do **not** invent a new name).

```sql
-- 6) Empty completion payload must raise, not silently store Khong HT
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_request_id bigint;
  v_status text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair empty smoke tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_empty_smoke_' || v_suffix,
    'smoke-password',
    'Repair Empty Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  -- Use the existing helper: _rr_cost_set_claims, NOT _rr_set_claims
  v_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix);
  PERFORM pg_temp._rr_cost_set_claims('to_qltb', v_user_id, v_tenant);

  -- Case A: both NULL → must raise
  BEGIN
    PERFORM public.repair_request_complete(v_request_id::integer, NULL, NULL, NULL);
    RAISE EXCEPTION 'Expected both-NULL completion to raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '22023' THEN
      RAISE EXCEPTION 'Expected SQLSTATE 22023 for both-NULL payload, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- Case B: both empty strings → must raise
  BEGIN
    PERFORM public.repair_request_complete(v_request_id::integer, '', '', NULL);
    RAISE EXCEPTION 'Expected both-empty completion to raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '22023' THEN
      RAISE EXCEPTION 'Expected SQLSTATE 22023 for both-empty payload, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- Case C: whitespace-only completion text → must raise
  BEGIN
    PERFORM public.repair_request_complete(v_request_id::integer, '   ', NULL, NULL);
    RAISE EXCEPTION 'Expected whitespace-only completion to raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '22023' THEN
      RAISE EXCEPTION 'Expected SQLSTATE 22023 for whitespace payload, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- Case D: whitespace-only reason in Không HT path → must raise
  BEGIN
    PERFORM public.repair_request_complete(v_request_id::integer, NULL, '   ', NULL);
    RAISE EXCEPTION 'Expected whitespace-only reason to raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '22023' THEN
      RAISE EXCEPTION 'Expected SQLSTATE 22023 for whitespace reason, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  RAISE NOTICE 'OK: empty completion payload guards passed';
END $$;
```

#### Green: Add guard in SQL function

The migration must `CREATE OR REPLACE` the full function body. Include the empty-payload guard
**before** the existing `IF p_completion IS NOT NULL AND trim(p_completion) <> ''` block,
and add `SET search_path = public` to the function declaration:

```sql
CREATE OR REPLACE FUNCTION public.repair_request_complete(
  p_id integer,
  p_completion text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_chi_phi_sua_chua numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- ← MANDATORY for SECURITY DEFINER (pre-existing debt fixed here)
AS $$
DECLARE
  -- ... existing DECLARE block unchanged ...
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_user_id bigint;
  v_don_vi bigint;
  v_thiet_bi_id bigint;
  v_tb_don_vi bigint;
  v_locked_status text;
  v_locked_completed_at timestamptz;
  v_status text;
  v_result text;
  v_reason text;
  v_cost numeric(14,2);
BEGIN
  -- ... existing JWT claim extraction unchanged (lines 10-27) ...

  -- Guard: at least one meaningful field must be provided
  -- Placed BEFORE the existing IF/ELSE block at line ~83
  IF (
    coalesce(trim(p_completion), '') = ''
    AND coalesce(trim(p_reason), '') = ''
  ) THEN
    RAISE EXCEPTION 'Phải nhập kết quả sửa chữa hoặc lý do không hoàn thành'
      USING errcode = '22023';
  END IF;

  -- ... existing lock + status checks unchanged ...

  -- Existing IF/ELSE block (lines 83-89) unchanged — guard above fires first
  IF p_completion IS NOT NULL AND trim(p_completion) <> '' THEN
    v_status := 'Hoàn thành';
    v_result := p_completion;
    v_reason := NULL;
    v_cost := p_chi_phi_sua_chua;
  ELSE
    v_status := 'Không HT';
    v_result := NULL;
    v_reason := p_reason;
    v_cost := NULL;
  END IF;

  -- ... rest of function unchanged ...
END;
$$;

-- Re-grant after CREATE OR REPLACE (required by PostgreSQL)
GRANT EXECUTE ON FUNCTION public.repair_request_complete(
  integer, text, text, numeric
) TO authenticated;
```

> **Signature note:** The existing function has 4 parameters with defaults:
> `p_id integer, p_completion text DEFAULT NULL, p_reason text DEFAULT NULL, p_chi_phi_sua_chua numeric DEFAULT NULL`.
> The `GRANT` statement and the function declaration must match this exactly. If defaults change,
> `GRANT EXECUTE` will silently become inconsistent with the function's actual signature.

#### Refactor: None needed.

---

### Layer 3 — Context mutation guard (defense-in-depth)

**File:** `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`

**Test file:** `src/app/(app)/repair-requests/__tests__/RepairRequestsContext.completeMutation.test.tsx`

#### Red: Add mutation guard test

```tsx
it("throws before calling RPC when both completion and reason are null", async () => {
  // Similar harness to existing test; invoke mutate with null completion + null reason
  // Expect mockCallRpc NOT to be called; expect error to be thrown
})
```

#### Green: Add client-side null check

In `useCompleteMutation.mutationFn`, before `callRpc`:

```tsx
mutationFn: async (data) => {
  // Frontend already disables the button, but this is defense-in-depth
  if (data.completion === null && data.reason === null) {
    throw new Error("Phải nhập kết quả sửa chữa hoặc lý do không hoàn thành")
  }
  return callRpc({ ... })
}
```

> **Note:** This check catches `completion === null` (not `''`). The frontend's
> `handleConfirm` passes `completionResult.trim()` which produces `''` (empty string),
> not `null`. However, the backend guard handles `''` — this context check is defense-in-depth
> for any future callers that pass `null` directly.

---

## Files to Modify

| File | Action | Notes |
|------|--------|-------|
| `src/app/(app)/repair-requests/__tests__/RepairRequestsCompleteDialog.test.tsx` | Add 4 button-disabled tests | TDD Red |
| `src/app/(app)/repair-requests/_components/RepairRequestsCompleteDialog.tsx` | Disable button when field empty | TDD Green |
| `supabase/tests/repair_request_cost_smoke.sql` | Append case 6 (empty-payload smoke test) | TDD Red |
| `supabase/migrations/YYYYMMDDHHMMSS_fix_repair_request_complete_empty_payload.sql` | Create migration with SQL guard + `SET search_path` fix | TDD Green |
| `src/app/(app)/repair-requests/__tests__/RepairRequestsContext.completeMutation.test.tsx` | Add context mutation guard test | TDD Red/Green |
| `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx` | Add client-side null check | TDD Green |

---

## Verification

1. **Frontend tests:** `node scripts/npm-run.js run test:run -- src/app/(app)/repair-requests/__tests__/RepairRequestsCompleteDialog.test.tsx` → all pass
2. **Context tests:** `node scripts/npm-run.js run test:run -- src/app/(app)/repair-requests/__tests__/RepairRequestsContext.completeMutation.test.tsx` → all pass
3. **Smoke test:** Apply migration in Supabase, run `repair_request_cost_smoke.sql` → all 6 cases pass including new empty-payload rejection (case 6)
4. **End-to-end manual:** Open complete dialog, click confirm without typing → button disabled, no RPC call fired
5. **Security advisor:** After migration, run `mcp__supabase__get_advisors(security)` to catch regressions
6. **Typecheck + lint:** `node scripts/npm-run.js run typecheck && node scripts/npm-run.js run lint`
7. **verify:no-explicit-any:** `node scripts/npm-run.js run verify:no-explicit-any` (required before commit)

---

## Changes from Original Plan

| # | Original | Corrected | Reason |
|---|----------|-----------|--------|
| 1 | Red test used `pg_temp._rr_set_claims(...)` | Use `pg_temp._rr_cost_set_claims(...)` | Existing helper in `repair_request_cost_smoke.sql` is `_rr_cost_set_claims` — a new name would cause `function does not exist` at runtime |
| 2 | Migration body omitted `SET search_path` | `SET search_path = public` added to function declaration | Pre-existing technical debt — `SECURITY DEFINER` functions must set explicit search path to prevent schema hijacking |
| 3 | Smoke test had only 1 assertion case | 4 assertion cases (both-NULL, both-empty, whitespace-completion, whitespace-reason) | `trim()` matters — whitespace-only input is a distinct input class from empty string |
| 4 | Migration signature not specified | Full signature in migration + matching `GRANT EXECUTE` statement | `CREATE OR REPLACE` requires exact signature match; omitting `GRANT` after replace causes permission errors |