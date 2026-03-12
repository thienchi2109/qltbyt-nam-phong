# Device Quota Decision Delete Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure authorized equipment managers can delete draft quota decisions without violating immutable audit guarantees.

**Architecture:** Remove the FK-driven `ON DELETE SET NULL` mutation on `lich_su_dinh_muc` by replacing it with an insert-time validation trigger so audit rows stay append-only while parents can be deleted. Validate behavior with a dedicated SQL regression test that simulates the failing delete path and re-run it after the fix.

**Tech Stack:** Supabase Postgres 15, SQL migrations, TanStack Query clients (no code changes expected), helper scripts (`node scripts/run-cmd.js`, `node scripts/npm-run.js`), TDD via psql regression scripts.

---

### Task 1: Add regression SQL test for decision delete

**Files:**
- Create: `supabase/tests/device_quota/dinh_muc_quyet_dinh_delete.sql`

**Step 1: Write the failing test**

```sql
-- supabase/tests/device_quota/dinh_muc_quyet_dinh_delete.sql
\echo 'DEVICE QUOTA DECISION DELETE REGRESSION TEST'
BEGIN;
-- Snapshot initial counts
SELECT count(*) AS before_count FROM public.quyet_dinh_dinh_muc;

-- Use equipment-manager claims (to_qltb) scoped to don_vi 17
SELECT set_config(
  'request.jwt.claims',
  '{"app_role":"to_qltb","don_vi":"17","user_id":"24"}',
  true
);

-- Create a throwaway draft decision (keeps test isolated)
WITH draft AS (
  SELECT public.dinh_muc_quyet_dinh_create(
    'TEST-DELETE-001',
    CURRENT_DATE,
    CURRENT_DATE,
    NULL,
    'Tester',
    'Truong phong',
    NULL,
    NULL
  ) AS payload
)
SELECT payload->>'id' AS created_id FROM draft;

-- Attempt to delete the newly created draft
DO $$
DECLARE
  v_id BIGINT;
  v_result JSONB;
BEGIN
  SELECT (payload->>'id')::BIGINT INTO v_id FROM (
    SELECT public.dinh_muc_quyet_dinh_create(
      'TEST-DELETE-002',
      CURRENT_DATE,
      CURRENT_DATE,
      NULL,
      'Tester',
      'Truong phong',
      NULL,
      NULL
    ) AS payload
  ) s;

  v_result := public.dinh_muc_quyet_dinh_delete(v_id, NULL, 'regression-test');

  IF COALESCE(v_result->>'success', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Delete RPC did not return success: %', v_result;
  END IF;
END $$;

ROLLBACK;
```

**Step 2: Run test to verify it fails**

_Run via Supabase MCP (psql unavailable locally):_

```sql
mcp__supabase__execute_sql <<'SQL'
BEGIN;
-- ... same body as above ...
ROLLBACK;
SQL
```

Expected: FAIL with `Audit log records are immutable...` (current bug). Capture MCP error for reference.

**Step 3: (Later) re-run to ensure it passes once fixes land**

Same MCP command; expect success banner and no exception after schema changes (Task 2).

_Result log:_
- ✅ Initial run failed with `Audit log records are immutable...` (as expected)

---

### Task 2: Replace ON DELETE behavior with insert-time validation trigger

**Files:**
- Create: `supabase/migrations/20260224_fix_quyet_dinh_audit_fk.sql`

**Step 1: Author migration SQL (following schema-immutability + lock-ddl-safe-migration)**

```sql
BEGIN;
LOCK TABLE public.lich_su_dinh_muc IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE public.lich_su_dinh_muc
  DROP CONSTRAINT IF EXISTS lich_su_dinh_muc_quyet_dinh_id_fkey;
CREATE OR REPLACE FUNCTION public.validate_decision_audit_reference() ...;
CREATE TRIGGER trg_validate_decision_audit_reference ...;
COMMIT;
```

**Step 2: Apply migration via Supabase MCP (psql unavailable)**

```sql
mcp__supabase__execute_sql <<'SQL'
BEGIN;
-- migration body ...
COMMIT;
SQL
```

**Step 3: Document reasoning**

Comments embedded in migration (`schema-audit-log` guidance) explaining FK removal to preserve append-only audit.

**Step 4: Re-run regression SQL (Task 1) to confirm PASS**

- ✅ MCP execution now succeeds (returns created_id, no exceptions)

**Step 5: Manual verification for denied roles**

```sql
mcp__supabase__execute_sql <<'SQL'
BEGIN;
SELECT set_config('request.jwt.claims','{"app_role":"regional_leader","don_vi":"17","user_id":"22"}', true);
SELECT public.dinh_muc_quyet_dinh_delete(999999, NULL, 'unauthorized-test');
ROLLBACK;
SQL
```

- ✅ Still raises `Insufficient permissions...`

**Step 6: Stage migration + test files**

```bash
git add supabase/migrations/20260224_fix_quyet_dinh_audit_fk.sql \
        supabase/tests/device_quota/dinh_muc_quyet_dinh_delete.sql
```

---

### Task 3: Update documentation + verification checklist

**Files:**
- Modify: `docs/device-quota/PLAN.md`
- Modify: `docs/plans/2026-02-24-device-quota-decision-delete.md`

**Step 1: Update PLAN doc**

- Added bullet for `dinh_muc_quyet_dinh_delete`: “Audit: Insert-only log validated via trigger; FK dropped to keep immutable rows from blocking delete.”

**Step 2: Add verification checklist to this plan**

_Verifications completed:_
- ❌ Regression test (pre-fix) – fails with immutability error (expected)
- ✅ Migration applied via Supabase MCP (lock + validator trigger)
- ✅ Regression test (post-fix) – passes
- ✅ Role denial check for `regional_leader`
- ☐ Lint pending (no TS changes, but still run during final verification)

**Step 3: Final TDD verification (pending)**

Will run after docs updated:

```bash
node scripts/run-cmd.js psql "$SUPABASE_DB_URL" -f supabase/tests/device_quota/dinh_muc_quyet_dinh_delete.sql
node scripts/npm-run.js run lint
```

(Use Supabase MCP for SQL command if `psql` unavailable.)

**Step 4: Commit**

```bash
git commit -m "fix: allow deleting draft quota decisions"
```

Include migration + regression test + docs.

---

Plan complete and saved to `docs/plans/2026-02-24-device-quota-decision-delete.md`. Two execution options:

1. **Subagent-Driven (this session)** – I’ll stay here, invoke superpowers:subagent-driven-development, and tackle each task with checkpoints.
2. **Parallel Session (separate)** – Open a new session using superpowers:executing-plans for batch execution with milestones.

Which approach do you prefer?
