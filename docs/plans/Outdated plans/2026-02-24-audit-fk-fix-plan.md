# Audit FK Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the remaining mutating FK on `lich_su_dinh_muc.chi_tiet_id`, replace it with insert-time validation, and extend regression coverage so `dinh_muc_quyet_dinh_delete` works for decisions with line items.

**Architecture:** Mirror the existing decision-audit fix: drop the `ON DELETE SET NULL` FK, add a validator trigger for `chi_tiet_id`, restructure regression SQL to cover line items, and document/verify the change. All SQL execution uses Supabase MCP (psql unavailable locally).

**Tech Stack:** Supabase Postgres 15 (SQL migrations, triggers), Supabase MCP tools, docs in Markdown, git.

---

### Task 1: Enhance regression SQL to cover line items

**Files:**
- Modify: `supabase/tests/device_quota/dinh_muc_quyet_dinh_delete.sql`

**Step 1: Write failing test (adds line item creation)
```sql
-- Add block that calls dinh_muc_quyet_dinh_create → dinh_muc_chi_tiet_upsert
-- Confirm delete still fails pre-fix due to chi_tiet FK
```

**Step 2: Run test via Supabase MCP (expect FAIL)**
```sql
mcp__supabase__execute_sql <<'SQL'
BEGIN;
-- full script contents
ROLLBACK;
SQL
```
Expected: `Audit log records are immutable...` (line-item path).

**Step 3: Keep script ready for post-fix run.**

### Task 2: Add migration for chi_tiet FK removal + validator

**Files:**
- Create: `supabase/migrations/20260224_drop_chi_tiet_audit_fk.sql`

**Step 1: Author migration (include lock + validator trigger)**
```sql
BEGIN;
LOCK TABLE public.lich_su_dinh_muc IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE public.lich_su_dinh_muc DROP CONSTRAINT IF EXISTS lich_su_dinh_muc_chi_tiet_id_fkey;
CREATE OR REPLACE FUNCTION public.validate_chi_tiet_audit_reference() ...;
CREATE TRIGGER trg_validate_chi_tiet_audit_reference ...;
COMMIT;
```

**Step 2: Apply migration via Supabase MCP**
```sql
mcp__supabase__execute_sql <<'SQL'
BEGIN;
-- migration body
COMMIT;
SQL
```

### Task 3: Validation + docs + commit

**Files:**
- `supabase/tests/device_quota/dinh_muc_quyet_dinh_delete.sql`
- `docs/device-quota/PLAN.md`
- `docs/plans/2026-02-24-audit-fk-fix-plan.md` (append verification log)

**Step 1: Re-run regression SQL (expect PASS)**
```sql
mcp__supabase__execute_sql <<'SQL'
BEGIN;
-- script
ROLLBACK;
SQL
```

**Step 2: (Optional) run lint to verify TypeScript unaffected**
```bash
node scripts/npm-run.js run lint
```

**Step 3: Update PLAN doc**
- Add note under `dinh_muc_chi_tiet_*` or audit section describing validator trigger for chi_tiet.

**Step 4: Update plan doc**
- Append commands executed + MCP outputs.

**Step 5: Commit**
```bash
git add supabase/tests/device_quota/dinh_muc_quyet_dinh_delete.sql \
        supabase/migrations/20260224_drop_chi_tiet_audit_fk.sql \
        docs/device-quota/PLAN.md \
        docs/plans/2026-02-24-audit-fk-fix-plan.md
```
```bash
git commit -m "fix: remove ChiTiet audit FK mutations"
```

---

Plan complete and saved to `docs/plans/2026-02-24-audit-fk-fix-plan.md`. Two execution options:

1. **Subagent-Driven (this session)** – I’ll stay here, invoke superpowers:subagent-driven-development, and tackle each task with checkpoints.
2. **Parallel Session (separate)** – Open a new session using superpowers:executing-plans for batch execution with milestones.

Which approach do you prefer?
