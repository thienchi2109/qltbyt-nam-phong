# Repair Request Equipment Status Invariant Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `thiet_bi.tinh_trang_hien_tai` a consistent, test-backed invariant across the repair-request lifecycle so sequences like `complete -> create another request -> delete that request` cannot leave stale equipment status behind.

**Architecture:** Treat equipment-status sync as a database invariant, not a per-RPC side effect. Add an explicit pre-request status snapshot on `yeu_cau_sua_chua`, introduce one PL/pgSQL helper that resolves the correct equipment status from the set of surviving repair requests plus the deleted request fallback snapshot, then route `repair_request_create`, `repair_request_approve`, `repair_request_complete`, and `repair_request_delete` through that helper. Drive the whole change from failing SQL smoke tests that reproduce the current bug and adjacent multi-request edge cases before adding the migration and safe legacy-data reconciliation.

**Tech Stack:** Supabase Postgres, PL/pgSQL migrations, SQL smoke tests, GitHub CLI, Supabase MCP

---

## Scope And Assumptions

- This plan fixes the equipment-status invariant only.
- Follow-up UI validation issue for blank completion results is tracked separately in GitHub issue `#262`.
- Assumption: if a repair request reaches `Hoàn thành` and no other repair request for the same equipment is still active, the equipment status should be `Hoạt động`.
- Assumption: deleting the last active repair request should restore the deleted request's pre-request equipment status snapshot when available.
- Decision gate: if product wants special handling for `Không HT` when no active request remains, lock that rule before implementing Task 2. Do not silently invent a new rule mid-migration.

## File Map

**Files to create**
- `supabase/tests/repair_request_equipment_status_invariant_smoke.sql`
- `supabase/migrations/20260415113000_repair_request_equipment_status_invariant.sql`

**Files to modify**
- `supabase/tests/repair_request_lifecycle_audit_smoke.sql`
- `progress.txt`

**External references**
- GitHub issue `#262` for the blank completion-result follow-up
- Deployed RPCs inspected via Supabase MCP:
  - `public.repair_request_create(integer, text, text, date, text, text, text)`
  - `public.repair_request_complete(integer, text, text, numeric)`
  - `public.repair_request_delete(integer)`

## Chunk 1: Reproduce The Invariant Failures First

### Task 1: Freeze the current bug and the adjacent edge cases with failing SQL smoke tests

**Files:**
- Create: `supabase/tests/repair_request_equipment_status_invariant_smoke.sql`
- Modify: `supabase/tests/repair_request_lifecycle_audit_smoke.sql`

- [ ] **Step 1: Write the primary failing repro for the current production bug**

In `supabase/tests/repair_request_equipment_status_invariant_smoke.sql`, add a transaction-wrapped test that:
- creates request `A` for one equipment
- approves and completes request `A`
- asserts equipment is `Hoạt động`
- creates request `B` on the same equipment
- deletes request `B`
- expects equipment to return to `Hoạt động`

Use explicit `RAISE EXCEPTION` messages naming each intermediate status.

- [ ] **Step 2: Run the new smoke file to verify RED**

Run:
```bash
docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_equipment_status_invariant_smoke.sql
```

Expected:
- FAIL on the `delete B` assertion because current `repair_request_delete` leaves `thiet_bi.tinh_trang_hien_tai = 'Chờ sửa chữa'`

- [ ] **Step 3: Add the active-sibling guard case**

In the same smoke file, add a second test that:
- creates request `A`
- leaves `A` active
- creates request `B`
- deletes request `B`
- expects equipment to remain `Chờ sửa chữa` because request `A` is still active

This prevents over-correcting `delete` to always restore `Hoạt động`.

- [ ] **Step 4: Add the pre-request snapshot restore case**

In the same smoke file, add a third test that:
- inserts equipment with a non-default status such as `Ngưng sử dụng`
- creates a repair request for that equipment
- deletes the only request
- expects the equipment status to return to `Ngưng sử dụng`

This is the forward-looking guard that prevents future variants of the same bug on non-`Hoạt động` equipment.

- [ ] **Step 5: Run the smoke file again to verify RED still reflects the intended gaps**

Run:
```bash
docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_equipment_status_invariant_smoke.sql
```

Expected:
- FAIL on current implementation
- failure messages point to missing status recomputation or missing snapshot support, not to fixture/setup mistakes

- [ ] **Step 6: Tighten the existing lifecycle smoke around delete**

Modify `supabase/tests/repair_request_lifecycle_audit_smoke.sql` delete coverage so the delete path also asserts the equipment status after delete, not just audit/history.

Keep the existing audit assertions intact; add one explicit status assertion only.

- [ ] **Step 7: Run the lifecycle smoke to verify RED on the delete-status assertion**

Run:
```bash
docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_lifecycle_audit_smoke.sql
```

Expected:
- FAIL in the delete section on equipment-status recomputation

- [ ] **Step 8: Commit the red test slice**

Run:
```bash
git add supabase/tests/repair_request_equipment_status_invariant_smoke.sql supabase/tests/repair_request_lifecycle_audit_smoke.sql
git commit -m "test: capture repair request equipment status invariant regressions"
```

## Chunk 2: Centralize Equipment Status Resolution In The Database

### Task 2: Add snapshot support and one helper that owns repair-driven equipment status

**Files:**
- Create: `supabase/migrations/20260415113000_repair_request_equipment_status_invariant.sql`
- Read only: `supabase/migrations/20260219223500_fix_repair_request_toctou_race.sql`
- Read only: `supabase/migrations/20260412100000_add_repair_request_cost_statistics.sql`
- Read only: `supabase/migrations/20260406082000_fix_request_lifecycle_review_followups.sql`

- [ ] **Step 1: Write the failing migration-facing expectations into comments before code**

At the top of the new migration, document the invariant the helper must implement:
- active request exists -> `Chờ sửa chữa`
- no active request, surviving completed request exists -> `Hoạt động`
- no surviving active/completed request after a delete -> restore deleted request snapshot if provided
- otherwise leave status unchanged

This comment is a design lock. Do not start coding before the invariant is written down.

- [ ] **Step 2: Add the schema support for snapshot-based restoration**

In `supabase/migrations/20260415113000_repair_request_equipment_status_invariant.sql`, add:
- nullable column `tinh_trang_thiet_bi_truoc_yeu_cau text` to `public.yeu_cau_sua_chua`

Do not backfill speculative values into this column for old rows. New rows are the authoritative forward fix.

- [ ] **Step 3: Implement a single helper that resolves equipment status**

In the same migration, create:
- `public.repair_request_sync_equipment_status(p_thiet_bi_id bigint, p_deleted_request_previous_status text DEFAULT NULL)`

Keep it `SECURITY DEFINER` with `SET search_path = public, pg_temp`.

Implementation shape:
- lock or read surviving requests for `p_thiet_bi_id`
- if any request is `Chờ xử lý` or `Đã duyệt`, set equipment to `Chờ sửa chữa`
- else if any surviving request is `Hoàn thành`, set equipment to `Hoạt động`
- else if `p_deleted_request_previous_status` is non-empty, restore that snapshot
- else leave `thiet_bi.tinh_trang_hien_tai` unchanged

- [ ] **Step 4: Override `repair_request_create` to capture snapshot and call the helper**

Replace the inline status update in `public.repair_request_create(...)` so it:
- captures the locked equipment status into `tinh_trang_thiet_bi_truoc_yeu_cau`
- inserts the request row
- calls `public.repair_request_sync_equipment_status(...)`

Preserve the existing row lock, claim guards, audit log, and history behavior.

- [ ] **Step 5: Override `repair_request_approve` and `repair_request_complete` to use the helper**

Replace their direct `UPDATE public.thiet_bi` logic with calls to `public.repair_request_sync_equipment_status(...)` after the request row is updated.

Preserve:
- row locking
- idempotency guards
- cost handling
- audit/history fail-closed behavior

- [ ] **Step 6: Override `repair_request_delete` to restore from the deleted-row snapshot**

Change `public.repair_request_delete(...)` so it:
- reads and locks the request plus equipment
- stores `v_locked.tinh_trang_thiet_bi_truoc_yeu_cau`
- deletes the row
- calls `public.repair_request_sync_equipment_status(v_locked.thiet_bi_id, v_locked.tinh_trang_thiet_bi_truoc_yeu_cau)`

Do not skip the helper when the deleted request was still `Chờ xử lý`.

- [ ] **Step 7: Run the new invariant smoke file to verify GREEN**

Run:
```bash
docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_equipment_status_invariant_smoke.sql
```

Expected:
- PASS

- [ ] **Step 8: Run the lifecycle smoke to verify GREEN**

Run:
```bash
docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_lifecycle_audit_smoke.sql
```

Expected:
- PASS

- [ ] **Step 9: Commit the invariant-helper slice**

Run:
```bash
git add supabase/migrations/20260415113000_repair_request_equipment_status_invariant.sql supabase/tests/repair_request_equipment_status_invariant_smoke.sql supabase/tests/repair_request_lifecycle_audit_smoke.sql
git commit -m "fix: centralize repair request equipment status sync"
```

## Chunk 3: Reconcile Legacy Data And Prove The Repair Query Stays Clean

### Task 3: Add safe backfill and prove the known mismatch query goes to zero

**Files:**
- Modify: `supabase/migrations/20260415113000_repair_request_equipment_status_invariant.sql`
- Test: `supabase/tests/repair_request_equipment_status_invariant_smoke.sql`

- [ ] **Step 1: Add a safe reconciliation update for the already-bad legacy rows**

Extend the new migration with a data-fix statement that sets equipment to `Hoạt động` only when:
- there exists at least one `Hoàn thành` repair request for the equipment
- there are no surviving active repair requests (`Chờ xử lý`, `Đã duyệt`) for that equipment
- current equipment status is not already `Hoạt động`

This is the migrationized form of the manual backfill already validated on production data.

- [ ] **Step 2: Add a smoke assertion for the reconciliation query**

In `supabase/tests/repair_request_equipment_status_invariant_smoke.sql`, add a final assertion that the mismatch query:
- `completed request` joined to equipment with non-`Hoạt động` status
returns zero rows for the test fixtures after the migration logic runs.

- [ ] **Step 3: Run the invariant smoke again to verify GREEN**

Run:
```bash
docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_equipment_status_invariant_smoke.sql
```

Expected:
- PASS

- [ ] **Step 4: Verify the real reconciliation query on the target database**

Run via Supabase MCP or `psql`:
```sql
SELECT yc.id AS repair_request_id, yc.thiet_bi_id, yc.trang_thai, tb.tinh_trang_hien_tai
FROM public.yeu_cau_sua_chua yc
JOIN public.thiet_bi tb ON tb.id = yc.thiet_bi_id
WHERE yc.trang_thai = 'Hoàn thành'
  AND COALESCE(tb.tinh_trang_hien_tai, '') <> 'Hoạt động';
```

Expected:
- zero rows after the migration/backfill is applied

- [ ] **Step 5: Run Supabase security advisors after the migration**

Use Supabase MCP:
- `get_advisors(security)`

Expected:
- no new advisor findings caused by the migration

- [ ] **Step 6: Commit the reconciliation slice**

Run:
```bash
git add supabase/migrations/20260415113000_repair_request_equipment_status_invariant.sql supabase/tests/repair_request_equipment_status_invariant_smoke.sql
git commit -m "fix: reconcile legacy repair equipment status mismatches"
```

## Chunk 4: Final Verification, Documentation, And Session Handoff

### Task 4: Close with evidence and durable notes

**Files:**
- Modify: `progress.txt`
- External: GitHub issue `#262`

- [ ] **Step 1: Run the full focused verification set**

Run:
```bash
docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_equipment_status_invariant_smoke.sql
docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_lifecycle_audit_smoke.sql
docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_cost_smoke.sql
```

Expected:
- PASS on all three smoke files

- [ ] **Step 2: Record the implementation outcome in `progress.txt`**

Append a progress entry summarizing:
- the invariant helper
- the snapshot column
- the delete regression fix
- the legacy-data reconciliation
- the open follow-up in issue `#262`

- [ ] **Step 3: Verify the git diff is scoped**

Run:
```bash
git diff --stat
git diff -- supabase/migrations/20260415113000_repair_request_equipment_status_invariant.sql supabase/tests/repair_request_equipment_status_invariant_smoke.sql supabase/tests/repair_request_lifecycle_audit_smoke.sql progress.txt
```

Expected:
- only the planned files changed
- no UI code mixed into this invariant fix

- [ ] **Step 4: Land the work using the repo’s mandatory verification/push workflow**

Run:
```bash
git pull --rebase
git push
git status
```

Expected:
- push succeeds
- `git status` reports the branch is up to date with `origin`

- [ ] **Step 5: Hand off the remaining explicit follow-up**

Reference GitHub issue `#262` in the final session handoff as the intentionally deferred UI/DB contract cleanup for blank completion results.
