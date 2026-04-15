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

**Migration file:** new `supabase/migrations/20260415XXX_fix_repair_request_complete_empty_payload.sql`

#### Red: Add smoke test case

In `supabase/tests/repair_request_cost_smoke.sql` (or the equipment status smoke file), add a case:

```sql
-- Empty-completion payload must raise, not silently store Khong HT
DO $$
DECLARE
  v_tenant bigint; v_user_id bigint; v_equipment_id bigint; v_request_id bigint;
  v_errored boolean := false;
BEGIN
  -- setup: create and approve repair request
  PERFORM pg_temp._rr_set_claims(...);

  INSERT INTO public.yeu_cau_sua_chua(...)
  VALUES (...)
  RETURNING id INTO v_request_id;

  BEGIN
    -- Empty completion + null reason → should raise
    PERFORM public.repair_request_complete(v_request_id, NULL, NULL, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_errored := true;
  END;

  IF NOT v_errored THEN
    RAISE EXCEPTION 'Empty completion payload should have raised an exception';
  END IF;
END $$;
```

#### Green: Add guard in SQL function

After idempotency guard (existing line 98–100) and before the `IF p_completion IS NOT NULL...` block:

```sql
-- Guard: at least one meaningful field must be provided
IF (
  coalesce(trim(p_completion), '') = ''
  AND coalesce(trim(p_reason), '') = ''
) THEN
  RAISE EXCEPTION 'Phải nhập kết quả sửa chữa hoặc lý do không hoàn thành' USING errcode = '22023';
END IF;
```

Also update `repair_request_create` / `repair_request_delete` / `repair_request_approve` follow-up bodies in the same migration — these were already replaced in prior PR #263, so we just `CREATE OR REPLACE` with the new body.

#### Refactor: None needed.

---

### Layer 3 — Context mutation guard (optional defense-in-depth)

**File:** `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`

`useCompleteMutation.mutationFn` — add a client-side check before `callRpc`:

```tsx
if (data.completion === null && data.reason === null) {
  throw new Error("Phải nhập kết quả sửa chữa hoặc lý do không hoàn thành")
}
```

**Test file:** `src/app/(app)/repair-requests/__tests__/RepairRequestsContext.completeMutation.test.tsx`
Add test: mutation rejects when both `completion` and `reason` are null.

---

## Files to Modify

| File | Action | Notes |
|------|--------|-------|
| `src/app/(app)/repair-requests/__tests__/RepairRequestsCompleteDialog.test.tsx` | Add 4 button-disabled tests | TDD Red |
| `src/app/(app)/repair-requests/_components/RepairRequestsCompleteDialog.tsx` | Disable button when field empty | TDD Green |
| `supabase/migrations/20260415XXX_fix_repair_request_complete_empty_payload.sql` | Add SQL guard + follow-up RPC bodies | TDD Green |
| `supabase/tests/repair_request_cost_smoke.sql` | Add empty-payload smoke test | TDD Red |
| `src/app/(app)/repair-requests/__tests__/RepairRequestsContext.completeMutation.test.tsx` | Add context mutation guard test | TDD Red/Green |
| `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx` | Add client-side null check | TDD Green |

---

## Verification

1. **Frontend tests:** `node scripts/npm-run.js run test:run -- src/app/(app)/repair-requests/__tests__/RepairRequestsCompleteDialog.test.tsx` → all pass
2. **Context tests:** `node scripts/npm-run.js run test:run -- src/app/(app)/repair-requests/__tests__/RepairRequestsContext.completeMutation.test.tsx` → all pass
3. **Smoke test:** Apply migration in Supabase, run `repair_request_cost_smoke.sql` → all cases pass including new empty-payload rejection
4. **End-to-end manual:** Open complete dialog, click confirm without typing → button disabled, no RPC call fired
5. **Security advisor:** After migration, run `get_advisors(security)`
6. **Typecheck + lint:** `node scripts/npm-run.js run typecheck && node scripts/npm-run.js run lint`
