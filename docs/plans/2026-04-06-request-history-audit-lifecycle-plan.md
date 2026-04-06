# Request History Audit Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure all future Transfer and Repair Request lifecycle transitions write complete request-level audit logs so detail-dialog `Lịch sử` tabs show the full forward-going lifecycle without backfilling old requests.

**Architecture:** Keep `audit_logs` as the single request-history source for Transfers and Repair Requests. Instrument the missing lifecycle RPCs with `public.audit_log(...)`, preserve the existing tenant-safe read RPCs, and only update the transfer history adapter so newly logged action types render friendly labels. Non-goals: no backfill for already completed requests, no dual-source merge from `lich_su_thiet_bi`, and no UI restructuring.

**Tech Stack:** Supabase Postgres RPCs/migrations, Next.js/React, TanStack Query, Vitest, SQL smoke tests, Basic Memory.

**Security Invariants:** Every replaced RPC must stay `SECURITY DEFINER` with `SET search_path = public, pg_temp`, validate JWT claims before business logic, and keep tenant isolation at least as strict as the nearest hardened function already in repo. For single-tenant write paths, use `lower(...)` role parsing, explicit `admin -> global` behavior via `v_is_global := v_role in ('global', 'admin')`, explicit `user_id` guard when the function mutates tracked rows, explicit `don_vi` guard for non-global users, row locking with `FOR UPDATE` on the request/equipment rows being changed, and deny `regional_leader` writes where the existing transfer flow already does so. Do not patch older weak bodies in place without first porting them to the hardened pattern.

**TDD Execution Rule:** Execute every missing audit behavior as its own `RED -> GREEN -> REFACTOR` loop. Add one failing assertion for one action, run it to confirm the intended failure, implement only the minimal migration change for that action, rerun until green, and only then move to the next action. Do not batch all missing audit actions into one large migration edit before seeing the first targeted red state.

---

## Chunk 1: Repair Request Lifecycle Audit Coverage

### Task 1: Add a failing repair lifecycle audit smoke test

**Files:**
- Create: `supabase/tests/repair_request_lifecycle_audit_smoke.sql`
- Reference: `supabase/tests/repair_request_history_smoke.sql`

- [ ] **Step 1: Write the failing smoke test**

```sql
-- Create a scratch equipment row under an active don_vi.
-- Set JWT claims for a tenant-scoped user.
-- Add independent DO blocks in this order:
--   1. update path expects repair_request_update
--   2. approve path expects repair_request_approve
--   3. complete path expects repair_request_complete
--   4. delete path expects repair_request_delete
-- Each block should create only the minimum fixture it needs.
-- Cleanup scratch rows before exit.
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/repair_request_lifecycle_audit_smoke.sql
```

Expected: FAIL on the first missing audit assertion, not on setup or auth.

- [ ] **Step 3: Fix the smoke test harness until the first red state is the intended missing audit action**

```sql
-- If the file errors before the first assertion, fix fixture/setup issues first.
-- The first failure must prove missing behavior, not a broken test harness.
```

- [ ] **Step 4: Commit the failing test scaffold**

```bash
git add supabase/tests/repair_request_lifecycle_audit_smoke.sql
git commit -m "test: add failing repair lifecycle audit smoke coverage"
```

### Task 2: Instrument repair lifecycle RPCs to write audit logs

**Files:**
- Create: `supabase/migrations/20260406110000_add_repair_request_lifecycle_audit_logs.sql`
- Reference: `supabase/migrations/20260405174500_add_repair_request_change_history_list_rpc.sql`
- Reference: `supabase/migrations/2025-09-29/20250925_audit_logs_v2_entities_and_helper.sql`
- Reference: live `repair_request_create(...)` definition from `pg_get_functiondef(...)`

- [ ] **Step 1: Port each repair lifecycle RPC onto the repo's hardened function template only when its red test is active**

```sql
-- Do not rewrite all four functions up front.
-- For each of:
--   repair_request_update
--   repair_request_approve
--   repair_request_complete
--   repair_request_delete
-- rebuild that single function immediately before its corresponding GREEN step with:
--   SECURITY DEFINER
--   SET search_path = public, pg_temp
--   v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb
--   v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')))
--   v_is_global := v_role in ('global', 'admin')
--   v_user_id := nullif(v_claims->>'user_id', '')::bigint
--   explicit missing role / missing user_id guards
--   explicit missing don_vi guard for non-global roles
--   SELECT ... FOR UPDATE on the request row and joined equipment row used for tenant checks
--   tenant check against the equipment/request owner don_vi before any update/delete
```

- [ ] **Step 2: GREEN 1 — implement only `repair_request_update` audit logging**

```sql
PERFORM public.audit_log(
  'repair_request_update',
  'repair_request',
  p_id,
  NULL,
  jsonb_build_object(
    'mo_ta_su_co', p_mo_ta_su_co,
    'hang_muc_sua_chua', p_hang_muc_sua_chua,
    'ngay_mong_muon_hoan_thanh', p_ngay_mong_muon_hoan_thanh,
    'don_vi_thuc_hien', p_don_vi_thuc_hien,
    'ten_don_vi_thue', p_ten_don_vi_thue
  )
);
```

- [ ] **Step 3: Re-run the repair smoke file and confirm it advances to `repair_request_approve`**

Run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/repair_request_lifecycle_audit_smoke.sql
```

Expected: the `repair_request_update` assertion is green and the next red state is `repair_request_approve`.

- [ ] **Step 4: GREEN 2 — implement only `repair_request_approve` audit logging**

```sql
PERFORM public.audit_log(
  'repair_request_approve',
  'repair_request',
  p_id,
  NULL,
  jsonb_build_object(
    'trang_thai', 'Đã duyệt',
    'nguoi_duyet', p_nguoi_duyet,
    'don_vi_thuc_hien', p_don_vi_thuc_hien,
    'ten_don_vi_thue', CASE WHEN p_don_vi_thuc_hien = 'thue_ngoai' THEN p_ten_don_vi_thue ELSE NULL END
  )
);
```

- [ ] **Step 5: Re-run the repair smoke file and confirm it advances to `repair_request_complete`**

Run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/repair_request_lifecycle_audit_smoke.sql
```

Expected: the `repair_request_approve` assertion is green and the next red state is `repair_request_complete`.

- [ ] **Step 6: GREEN 3 — implement only `repair_request_complete` audit logging**

```sql
PERFORM public.audit_log(
  'repair_request_complete',
  'repair_request',
  p_id,
  NULL,
  jsonb_build_object(
    'trang_thai', v_status,
    'ket_qua_sua_chua', CASE WHEN v_status = 'Hoàn thành' THEN p_completion ELSE NULL END,
    'ly_do_khong_hoan_thanh', CASE WHEN v_status <> 'Hoàn thành' THEN p_reason ELSE NULL END
  )
);
```

- [ ] **Step 7: Re-run the repair smoke file and confirm it advances to `repair_request_delete`**

Run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/repair_request_lifecycle_audit_smoke.sql
```

Expected: the `repair_request_complete` assertion is green and the next red state is `repair_request_delete`.

- [ ] **Step 8: GREEN 4 — implement only `repair_request_delete` audit logging**

```sql
PERFORM public.audit_log(
  'repair_request_delete',
  'repair_request',
  p_id,
  NULL,
  jsonb_build_object(
    'thiet_bi_id', v_req.thiet_bi_id,
    'trang_thai', v_req.trang_thai
  )
);
```

- [ ] **Step 9: REFACTOR — clean up shared repair migration code only after all four audit assertions are green**

```sql
-- Deduplicate local helpers or variables only while the full smoke file stays green.
```

- [ ] **Step 10: Verify the new repair functions still preserve existing business side effects**

```sql
-- repair_request_approve must still update yeu_cau_sua_chua + thiet_bi + lich_su_thiet_bi
-- repair_request_complete must still update yeu_cau_sua_chua + thiet_bi + lich_su_thiet_bi
-- repair_request_delete must still preserve the existing delete semantics
```

- [ ] **Step 11: Apply the migration in the dev database**

Run:

```bash
supabase db push
```

Expected: migration applies cleanly and replaces the four RPC bodies.

- [ ] **Step 12: Re-run the repair lifecycle smoke test**

Run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/repair_request_lifecycle_audit_smoke.sql
```

Expected: PASS with all expected audit action types present.

- [ ] **Step 13: Run security advisors after the migration**

Use Supabase MCP:

```text
get_advisors(type="security")
```

Expected: no new security regressions caused by the function replacements.

- [ ] **Step 14: Commit the repair-side DB changes**

```bash
git add supabase/migrations/20260406110000_add_repair_request_lifecycle_audit_logs.sql supabase/tests/repair_request_lifecycle_audit_smoke.sql
git commit -m "feat: add repair request lifecycle audit logs"
```

## Chunk 2: Transfer Lifecycle Audit Coverage

### Task 3: Add a failing transfer lifecycle audit smoke test

**Files:**
- Create: `supabase/tests/transfer_request_lifecycle_audit_smoke.sql`
- Reference: `supabase/migrations/2025-09-15/20250915_transfers_rpcs_hardening.sql`

- [ ] **Step 1: Write the failing smoke test**

```sql
-- Create a scratch equipment row with khoa_phong_quan_ly populated.
-- Set JWT claims for a tenant-scoped user.
-- Add independent DO blocks in this order:
--   1. approve transition expects transfer_request_update_status with trang_thai = da_duyet
--   2. in-progress transition expects transfer_request_update_status with trang_thai = dang_luan_chuyen or da_ban_giao
--   3. completion path expects transfer_request_complete
-- Each block should create only the minimum transfer fixture it needs.
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/transfer_request_lifecycle_audit_smoke.sql
```

Expected: FAIL on the first missing transfer audit assertion, not on setup or auth.

- [ ] **Step 3: Confirm the smoke test uses the persisted request row for assertions**

```sql
-- Read back yeu_cau_luan_chuyen after each transition and compare
-- action_details.trang_thai against the stored row, not just raw input payload.
```

- [ ] **Step 4: Commit the failing transfer smoke test scaffold**

```bash
git add supabase/tests/transfer_request_lifecycle_audit_smoke.sql
git commit -m "test: add failing transfer lifecycle audit smoke coverage"
```

### Task 4: Instrument transfer lifecycle RPCs to write audit logs

**Files:**
- Create: `supabase/migrations/20260406113000_add_transfer_request_lifecycle_audit_logs.sql`
- Modify later for UI mapping: `src/components/transfer-detail-history-adapter.ts`
- Reference: live `transfer_request_update(...)` definition from `pg_get_functiondef(...)`

- [ ] **Step 1: Rebuild `transfer_request_update_status` on top of the hardened transfer write pattern before adding audit logging**

```sql
-- Use transfer_request_update / transfer_request_create as the security template, not the current weaker body.
-- Required guards:
--   v_role := lower(...)
--   v_is_global := v_role in ('global', 'admin')
--   v_user_id := nullif(...user_id...)::bigint
--   missing role guard
--   missing user_id guard
--   missing don_vi guard for non-global users
--   regional_leader write denial
--   SELECT ... FOR UPDATE on yeu_cau_luan_chuyen (and equipment row if needed for later updates)
--   tenant isolation before status mutation
-- Keep existing state-transition validation while moving to the hardened guard shape.
```

- [ ] **Step 2: GREEN 1 — implement only the `da_duyet` audit path for `transfer_request_update_status`**

```sql
PERFORM public.audit_log(
  'transfer_request_update_status',
  'transfer_request',
  p_id,
  NULL,
  jsonb_build_object(
    'trang_thai', p_status,
    'loai_hinh', v_req.loai_hinh,
    'khoa_phong_hien_tai', v_req.khoa_phong_hien_tai,
    'khoa_phong_nhan', v_req.khoa_phong_nhan,
    'don_vi_nhan', v_req.don_vi_nhan,
    'ngay_duyet', CASE WHEN p_status = 'da_duyet' THEN COALESCE((p_payload->>'ngay_duyet')::timestamptz, now()) ELSE NULL END,
    'ngay_ban_giao', CASE WHEN p_status IN ('dang_luan_chuyen', 'da_ban_giao') THEN COALESCE((p_payload->>'ngay_ban_giao')::timestamptz, now()) ELSE NULL END
  )
);
```

- [ ] **Step 3: Re-run the transfer smoke file and confirm it advances to the next missing status path**

Run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/transfer_request_lifecycle_audit_smoke.sql
```

Expected: the `da_duyet` assertion is green and the next red state is the in-progress transition audit.

- [ ] **Step 4: GREEN 2 — extend `transfer_request_update_status` for the in-progress status audit path**

```sql
-- Keep the same action_type = transfer_request_update_status
-- but make the next transition assertion pass with persisted status details.
```

- [ ] **Step 5: Re-run the transfer smoke file and confirm it advances to `transfer_request_complete`**

Run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/transfer_request_lifecycle_audit_smoke.sql
```

Expected: both `transfer_request_update_status` assertions are green and the next red state is `transfer_request_complete`.

- [ ] **Step 6: Rebuild `transfer_request_complete` on top of the same hardened transfer write pattern**

```sql
-- Required guards mirror transfer_request_update_status:
--   lower(...) role parsing
--   v_is_global includes admin
--   missing role / user_id / don_vi guards
--   regional_leader denial
--   row lock on request row before reading mutable state
--   tenant isolation before completion + equipment updates
-- Preserve existing equipment updates and lich_su_thiet_bi inserts.
```

- [ ] **Step 7: GREEN 3 — implement only `transfer_request_complete` audit logging**

```sql
PERFORM public.audit_log(
  'transfer_request_complete',
  'transfer_request',
  p_id,
  NULL,
  jsonb_build_object(
    'trang_thai', 'hoan_thanh',
    'loai_hinh', v_req.loai_hinh,
    'khoa_phong_hien_tai', v_req.khoa_phong_hien_tai,
    'khoa_phong_nhan', v_req.khoa_phong_nhan,
    'don_vi_nhan', v_req.don_vi_nhan,
    'ngay_hoan_thanh', now(),
    'ngay_hoan_tra', COALESCE((p_payload->>'ngay_hoan_tra')::timestamptz, NULL)
  )
);
```

- [ ] **Step 8: Strip spoofable client identity fields from the audit payload and prefer persisted row values**

```sql
-- Do not log raw client-supplied identity fields from p_payload.
-- Prefer persisted values read from the locked request row for:
--   ma_yeu_cau
--   loai_hinh
--   khoa_phong_hien_tai
--   khoa_phong_nhan
--   don_vi_nhan
--   trang_thai
```

- [ ] **Step 9: REFACTOR — clean up shared transfer migration code only after all transfer audit assertions are green**

```sql
-- Refactor guards or payload construction only while the smoke file remains green.
```

- [ ] **Step 10: Apply the transfer migration**

Run:

```bash
supabase db push
```

Expected: migration applies cleanly and replaces both transfer RPC bodies.

- [ ] **Step 11: Re-run the transfer lifecycle smoke test**

Run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/transfer_request_lifecycle_audit_smoke.sql
```

Expected: PASS with the expected action types recorded in `audit_logs`.

- [ ] **Step 12: Run security advisors after the migration**

Use Supabase MCP:

```text
get_advisors(type="security")
```

Expected: no new security regressions caused by the function replacements.

- [ ] **Step 13: Commit the transfer-side DB changes**

```bash
git add supabase/migrations/20260406113000_add_transfer_request_lifecycle_audit_logs.sql supabase/tests/transfer_request_lifecycle_audit_smoke.sql
git commit -m "feat: add transfer lifecycle audit logs"
```

## Chunk 3: Transfer History Rendering and End-to-End Verification

### Task 5: Render new transfer lifecycle actions cleanly in the shared history tab

**Files:**
- Modify: `src/components/transfer-detail-history-adapter.ts`
- Modify: `src/components/__tests__/transfer-detail-history-adapter.test.ts`

- [ ] **Step 1: Write a failing adapter test for status and completion actions**

```ts
it("maps transfer status and completion audit rows into friendly labels", () => {
  expect(
    mapTransferHistoryEntries([
      { action_type: "transfer_request_update_status", action_details: { trang_thai: "da_duyet" }, ... },
      { action_type: "transfer_request_complete", action_details: { trang_thai: "hoan_thanh" }, ... },
    ])
  ).toEqual([
    { actionLabel: "Cập nhật trạng thái luân chuyển", ... },
    { actionLabel: "Hoàn thành luân chuyển", ... },
  ])
})
```

- [ ] **Step 2: Expand the transfer adapter label/detail maps**

```ts
const TRANSFER_HISTORY_ACTION_LABELS = {
  transfer_request_create: "Tạo yêu cầu luân chuyển",
  transfer_request_update: "Cập nhật yêu cầu luân chuyển",
  transfer_request_update_status: "Cập nhật trạng thái luân chuyển",
  transfer_request_complete: "Hoàn thành luân chuyển",
}
```

- [ ] **Step 3: Add any missing detail labels used by the new audit payload**

```ts
ngay_duyet: "Ngày duyệt",
ngay_ban_giao: "Ngày bàn giao",
ngay_hoan_tra: "Ngày hoàn trả",
ngay_hoan_thanh: "Ngày hoàn thành",
```

- [ ] **Step 4: Run the focused adapter tests**

Run:

```bash
node scripts/npm-run.js run test:run -- src/components/__tests__/transfer-detail-history-adapter.test.ts src/app/(app)/repair-requests/__tests__/repairRequestHistoryAdapter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run TypeScript / React verification in repo order**

Run:

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/components/__tests__/transfer-detail-history-adapter.test.ts src/app/(app)/repair-requests/__tests__/repairRequestHistoryAdapter.test.ts
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected: all checks pass.

- [ ] **Step 6: Commit the transfer rendering changes**

```bash
git add src/components/transfer-detail-history-adapter.ts src/components/__tests__/transfer-detail-history-adapter.test.ts
git commit -m "feat: render transfer lifecycle audit history"
```

### Task 6: Verify live forward-only behavior and hand off

**Files:**
- Optional note: `progress.txt`
- Optional memory note: Basic Memory session summary

- [ ] **Step 1: Create one new repair request and drive it through approve/complete**

Expected live DB result:

```sql
select action_type
from public.audit_logs
where entity_type = 'repair_request'
  and entity_id = <new_request_id>
order by created_at asc;
```

Should return `repair_request_create`, `repair_request_approve`, `repair_request_complete` and any update/delete actions actually executed.

- [ ] **Step 2: Create one new transfer request and drive it through approve/start-or-handover/complete**

Expected live DB result:

```sql
select action_type, action_details->>'trang_thai' as trang_thai
from public.audit_logs
where entity_type = 'transfer_request'
  and entity_id = <new_transfer_id>
order by created_at asc;
```

Should return `transfer_request_create`, one or more `transfer_request_update_status`, and `transfer_request_complete`.

- [ ] **Step 3: Open the detail dialogs and confirm the `Lịch sử` tab shows the newly written rows**

Manual check targets:
- Transfers detail dialog
- Repair Requests detail dialog

- [ ] **Step 4: Record the future-only scope explicitly**

```text
No migration backfills old requests.
Only requests created or transitioned after deployment are guaranteed to show full request-level history.
```

- [ ] **Step 5: Push and verify remote state**

Run:

```bash
git pull --rebase
git push
git status
```

Expected: `git status` reports the branch is up to date with `origin`.
