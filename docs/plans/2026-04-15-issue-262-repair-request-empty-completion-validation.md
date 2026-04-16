# Issue #262 Empty Completion Validation Implementation Plan

> **For agentic workers:** REQUIRED: use `test-driven-development`, `karpathy-coding-heuristics`, `next-best-practices`, `vercel-react-best-practices`, and `supabase-postgres-best-practices` before implementing this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a `Hoàn thành` repair completion from submitting an empty `Kết quả sửa chữa`, and prove the UI/DB contract with failing tests before production changes.

**Architecture:** The dialog blocks invalid user input before mutation. The context mutation rejects blank payloads from non-dialog callers. The SQL RPC rejects blank terminal payloads so direct RPC calls cannot silently store `Không HT` when a completed request was submitted with empty completion text.

**Tech Stack:** Next.js App Router, React, TanStack Query, Vitest/Testing Library, Supabase Postgres migrations and SQL smoke tests.

---

## Issue Context

GitHub Issue #262 says:

- `RepairRequestsCompleteDialog` currently trims `Kết quả sửa chữa` but does not require it to be non-empty.
- `public.repair_request_complete(integer, text, text, numeric)` treats blank/whitespace `p_completion` as not completed (`Không HT`).
- The requested outcome is client validation for non-empty completion result when users choose `Hoàn thành`, with an explicit regression-tested UI/DB contract.

The required bug path is:

1. User chooses `Hoàn thành`.
2. User leaves `Kết quả sửa chữa` blank or whitespace-only.
3. Dialog sends `p_completion = ''`.
4. DB falls through to the `Không HT` branch.
5. The request is silently stored with the wrong terminal status.

## Scope

Required for Issue #262:

- Block blank/whitespace `Kết quả sửa chữa` in the `Hoàn thành` dialog path.
- Add a DB guard that rejects blank/whitespace completion payloads instead of silently storing `Không HT`.
- Add tests that fail against the current code before implementation.

Closely related hardening included in this plan:

- Apply the same non-empty requirement to the `Không HT` reason field because the same dialog and RPC represent terminal repair outcomes.
- This is intentionally small and local. If reviewers want strictly Issue-only scope, implement Task 1 and the `Hoàn thành` portions of Tasks 2-3 first, then split `Không HT` hardening into a follow-up issue.

Non-goals:

- Do not change equipment status sync behavior.
- Do not refactor repair request lifecycle functions beyond the validation guard.
- Do not change cost semantics.

## Current Code Facts

- Dialog currently submits trimmed completion/reason values:
  - `src/app/(app)/repair-requests/_components/RepairRequestsCompleteDialog.tsx`
  - `completion: completionType === "Hoàn thành" ? completionResult.trim() : null`
  - `reason: completionType === "Không HT" ? nonCompletionReason.trim() : null`
- Dialog confirm button is currently disabled only by `isPending`.
- Current latest `repair_request_complete` migration already has:
  - `SECURITY DEFINER`
  - `SET search_path = public, pg_temp`
  - 4-argument signature: `integer, text, text, numeric`
- Preserve `SET search_path = public, pg_temp`. Do not replace it with `SET search_path = public`.
- Existing SQL helper in `supabase/tests/repair_request_cost_smoke.sql` is `pg_temp._rr_cost_set_claims`.

---

## Files To Modify

- Modify: `src/app/(app)/repair-requests/__tests__/RepairRequestsCompleteDialog.test.tsx`
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsCompleteDialog.tsx`
- Modify: `src/app/(app)/repair-requests/__tests__/RepairRequestsContext.completeMutation.test.tsx`
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`
- Modify: `supabase/tests/repair_request_cost_smoke.sql`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_fix_repair_request_complete_empty_payload.sql`

---

## Task 1: Dialog Validation

**Files:**

- Test: `src/app/(app)/repair-requests/__tests__/RepairRequestsCompleteDialog.test.tsx`
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsCompleteDialog.tsx`

- [ ] **Step 1: Write the failing Issue #262 dialog test**

Add one red test that proves the current bug at the UI boundary:

```tsx
it("keeps Hoàn thành disabled for blank or whitespace-only repair results", async () => {
  const user = userEvent.setup()
  setupContext()

  render(<RepairRequestsCompleteDialog />)

  const confirmButton = screen.getByRole("button", { name: "Xác nhận hoàn thành" })
  expect(confirmButton).toBeDisabled()

  await user.type(screen.getByLabelText("Kết quả sửa chữa"), "   ")
  expect(confirmButton).toBeDisabled()

  await user.click(confirmButton)
  expect(mockMutate).not.toHaveBeenCalled()
})
```

Expected red behavior before implementation:

- FAIL because the confirm button is enabled when `isPending` is false.

- [ ] **Step 2: Run the red dialog test**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__/RepairRequestsCompleteDialog.test.tsx" -t "keeps Hoàn thành disabled"
```

Expected:

- Fails on `toBeDisabled()`.
- If it passes, the test is not proving the current bug. Re-check the setup before editing production code.

- [ ] **Step 3: Implement the minimal dialog disable logic**

In `CompleteDialogForm`, derive a single disabled flag from the active text field:

```tsx
const activeCompletionText =
  completionType === "Hoàn thành" ? completionResult : nonCompletionReason
const isConfirmDisabled = isPending || activeCompletionText.trim().length === 0
```

Update the confirm button:

```tsx
<Button onClick={handleConfirm} disabled={isConfirmDisabled}>
```

Keep `handleConfirm` as-is so payloads are still trimmed before mutation.

- [ ] **Step 4: Verify the red test is green**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__/RepairRequestsCompleteDialog.test.tsx" -t "keeps Hoàn thành disabled"
```

Expected:

- PASS.

- [ ] **Step 5: Add focused green-path assertions**

Add or update tests that must pass after Step 3:

```tsx
it("enables Hoàn thành after a non-empty repair result and submits trimmed payload", async () => {
  const user = userEvent.setup()
  setupContext()

  render(<RepairRequestsCompleteDialog />)

  await user.type(screen.getByLabelText("Kết quả sửa chữa"), "  Đã thay bộ nguồn  ")
  const confirmButton = screen.getByRole("button", { name: "Xác nhận hoàn thành" })

  expect(confirmButton).toBeEnabled()

  await user.click(confirmButton)

  expect(mockMutate).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 7,
      completion: "Đã thay bộ nguồn",
      reason: null,
    }),
    { onSuccess: mockCloseAllDialogs }
  )
})
```

For the included `Không HT` hardening, add:

```tsx
it("keeps Không HT disabled for blank or whitespace-only reasons", async () => {
  const user = userEvent.setup()
  setupContext({
    dialogState: {
      requestToComplete,
      completionType: "Không HT",
    },
  })

  render(<RepairRequestsCompleteDialog />)

  const confirmButton = screen.getByRole("button", { name: "Xác nhận không hoàn thành" })
  expect(confirmButton).toBeDisabled()

  await user.type(screen.getByLabelText("Lý do không hoàn thành"), "   ")
  expect(confirmButton).toBeDisabled()

  await user.click(confirmButton)
  expect(mockMutate).not.toHaveBeenCalled()
})
```

Expected note:

- The `enables after typing` test is a green-path regression assertion, not a red test. It may pass before Step 3 and must not be counted as proof of the bug.

- [ ] **Step 6: Run the full dialog test file**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__/RepairRequestsCompleteDialog.test.tsx"
```

Expected:

- PASS.

---

## Task 2: Context Mutation Guard

**Files:**

- Test: `src/app/(app)/repair-requests/__tests__/RepairRequestsContext.completeMutation.test.tsx`
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`

- [ ] **Step 1: Write a failing mutation guard test for blank completion**

The guard must cover the real dialog payload shape: blank completion is `""`, not `null`.

Add a harness variant that calls:

```tsx
context.completeMutation.mutate({
  id: 99,
  completion: "",
  reason: null,
  repairCost: null,
})
```

Test expectation:

```tsx
await waitFor(() => {
  expect(mockCallRpc).not.toHaveBeenCalled()
  expect(mockToast).toHaveBeenCalledWith(
    expect.objectContaining({
      variant: "destructive",
      title: "Lỗi cập nhật yêu cầu",
      description: "Phải nhập kết quả sửa chữa hoặc lý do không hoàn thành",
    })
  )
})
```

Expected red behavior before implementation:

- FAIL because `callRpc` is called with `p_completion: ""`.

- [ ] **Step 2: Run the red context test**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__/RepairRequestsContext.completeMutation.test.tsx" -t "rejects blank completion before calling RPC"
```

Expected:

- Fails because the mutation currently calls `repair_request_complete`.

- [ ] **Step 3: Implement the minimal mutation guard**

In `useCompleteMutation.mutationFn`, before `callRpc`, normalize both fields:

```tsx
const completion = data.completion?.trim() ?? ""
const reason = data.reason?.trim() ?? ""

if (completion.length === 0 && reason.length === 0) {
  throw new Error("Phải nhập kết quả sửa chữa hoặc lý do không hoàn thành")
}
```

Then pass normalized nullable values to RPC so future callers cannot send whitespace through this context:

```tsx
p_completion: completion.length > 0 ? completion : null,
p_reason: reason.length > 0 ? reason : null,
```

Keep `p_chi_phi_sua_chua` unchanged.

- [ ] **Step 4: Verify context tests**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__/RepairRequestsContext.completeMutation.test.tsx"
```

Expected:

- Existing cost propagation test still passes.
- New blank completion guard test passes.

---

## Task 3: SQL RPC Guard

**Files:**

- Test: `supabase/tests/repair_request_cost_smoke.sql`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_fix_repair_request_complete_empty_payload.sql`

- [ ] **Step 1: Add a failing SQL smoke case that catches the actual stored-status bug**

Append case 6 to `supabase/tests/repair_request_cost_smoke.sql`. Use existing helpers:

- `pg_temp._rr_cost_create_approved_request`
- `pg_temp._rr_cost_set_claims`

The test must verify both:

- blank completion raises `SQLSTATE 22023`
- the request remains unchanged after the rejected call

Use this shape:

```sql
-- 6) Empty completion payload must raise and leave the request approved.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_request_id bigint;
  v_status text;
  v_completed_at timestamptz;
  v_completion text;
  v_reason text;
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

  v_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix);
  PERFORM pg_temp._rr_cost_set_claims('to_qltb', v_user_id, v_tenant);

  BEGIN
    PERFORM public.repair_request_complete(v_request_id::integer, '   ', NULL, NULL);
    RAISE EXCEPTION 'Expected whitespace-only completion to raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '22023' THEN
      RAISE EXCEPTION 'Expected SQLSTATE 22023 for whitespace completion, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  SELECT trang_thai, ngay_hoan_thanh, ket_qua_sua_chua, ly_do_khong_hoan_thanh
  INTO v_status, v_completed_at, v_completion, v_reason
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  IF v_status <> 'Đã duyệt'
     OR v_completed_at IS NOT NULL
     OR v_completion IS NOT NULL
     OR v_reason IS NOT NULL THEN
    RAISE EXCEPTION
      'Blank completion must not mutate request; got status=%, completed_at=%, completion=%, reason=%',
      v_status, v_completed_at, v_completion, v_reason;
  END IF;

  RAISE NOTICE 'OK: empty completion payload guard passed';
END $$;
```

Optional hardening cases may be added after the required red test is proven:

- `p_completion = ''`
- both `p_completion` and `p_reason` are `NULL`
- `p_reason = '   '` for the `Không HT` path

- [ ] **Step 2: Run the SQL smoke test red**

Apply no migration yet. Run the project’s normal SQL smoke-test mechanism for `supabase/tests/repair_request_cost_smoke.sql`.

Expected:

- Fails because the blank completion call does not raise and/or mutates the request to `Không HT`.

- [ ] **Step 3: Create the migration with the minimal SQL guard**

Create a timestamped migration:

```bash
node scripts/npm-run.js run db:migration -- fix_repair_request_complete_empty_payload
```

If the script is not suitable in this repo, create:

```text
supabase/migrations/YYYYMMDDHHMMSS_fix_repair_request_complete_empty_payload.sql
```

The migration must `CREATE OR REPLACE FUNCTION public.repair_request_complete(...)` with the current full function body from the latest migration as the base.

Requirements:

- Preserve signature:
  - `p_id integer`
  - `p_completion text DEFAULT NULL`
  - `p_reason text DEFAULT NULL`
  - `p_chi_phi_sua_chua numeric DEFAULT NULL`
- Preserve `SECURITY DEFINER`.
- Preserve `SET search_path = public, pg_temp`.
- Preserve existing JWT claim checks, tenant checks, locking, cost guard, audit, and `repair_request_sync_equipment_status`.
- Add the empty-payload guard before selecting `v_status`/`v_result`/`v_reason`.

Guard:

```sql
IF (
  coalesce(trim(p_completion), '') = ''
  AND coalesce(trim(p_reason), '') = ''
) THEN
  RAISE EXCEPTION 'Phải nhập kết quả sửa chữa hoặc lý do không hoàn thành'
    USING errcode = '22023';
END IF;
```

Then keep the existing branch:

```sql
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
```

Finish with matching privileges:

```sql
GRANT EXECUTE ON FUNCTION public.repair_request_complete(integer, text, text, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_complete(integer, text, text, numeric) FROM PUBLIC;
```

- [ ] **Step 4: Verify SQL smoke test green**

Apply the migration in the target test environment, then run:

```bash
docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_cost_smoke.sql
```

Expected:

- Existing 5 cases pass.
- New case 6 passes and confirms the request remains `Đã duyệt` after rejected blank completion.

- [ ] **Step 5: Run Supabase security advisor**

Run via Supabase MCP:

```text
mcp__supabase__get_advisors(security)
```

Expected:

- No new security regression from the migration.

---

## Task 4: Required Verification Order

Run these after all TypeScript/React and SQL changes are complete, in this exact order for this repo:

- [ ] **Step 1: Explicit any gate**

```bash
node scripts/npm-run.js run verify:no-explicit-any
```

Expected:

- PASS.

- [ ] **Step 2: Typecheck**

```bash
node scripts/npm-run.js run typecheck
```

Expected:

- PASS.

- [ ] **Step 3: Focused tests**

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__/RepairRequestsCompleteDialog.test.tsx"
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__/RepairRequestsContext.completeMutation.test.tsx"
```

Expected:

- PASS.

- [ ] **Step 4: SQL smoke**

Run `supabase/tests/repair_request_cost_smoke.sql` after applying the migration.

Expected:

- PASS.

- [ ] **Step 5: React Doctor diff**

```bash
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected:

- No new relevant warnings from the changed React files.

- [ ] **Step 6: Manual browser check**

Open the repair request complete dialog:

- `Hoàn thành` with empty or whitespace-only `Kết quả sửa chữa`: confirm disabled, no RPC fires.
- `Hoàn thành` after typing non-empty result: confirm enabled, submits trimmed result.
- `Không HT` with empty or whitespace-only reason: confirm disabled.

Record manual verification status in the implementation notes.

---

## Completion Notes

- Do not claim the work is complete unless the red tests were observed failing before production changes.
- Do not count “enables after typing” as a red test; that is a green-path regression assertion.
- If only the Issue #262 minimum is implemented, explicitly leave a follow-up issue for the optional `Không HT` hardening.
- If committing under Ralph flow, stop after the single story and use the required commit/status/push workflow from `AGENTS.md`.
