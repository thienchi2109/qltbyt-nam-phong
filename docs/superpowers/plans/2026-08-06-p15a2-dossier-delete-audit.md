# P15A2 Dossier Delete Audit Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fail-closed, durable audit evidence before the dormant technical-configuration dossier hard-delete can be activated by P15C.

**Architecture:** Replace only the existing delete RPC in one correctly ordered migration. Preserve P15A locking and errors, capture the locked dossier root, call the shared audit helper before deletion, and abort the transaction when auditing fails. Update the existing concurrency gate to account for committed audit evidence. Keep proxy/client/UI work in P15C.

**Tech Stack:** PostgreSQL PL/pgSQL, Supabase migrations and rollback-only SQL gates, Vitest source-contract tests, OpenSpec.

---

## Pre-Implementation Discovery

- [ ] Recall AgentMemory for the P15A/P15B boundary and prior live-gate
      decisions.
- [ ] Use Code Review Graph minimal context before broad source reading.
- [ ] Use GitNexus impact analysis after narrowing indexed symbols; backstop SQL
      function relationships with exact search and live Supabase MCP read-only
      inspection.

## Chunk 1: Freeze The P15A2 Contract

### Task 1: Add OpenSpec ownership and dependency

**Files:**

- Create: `openspec/changes/add-technical-configuration-comparison/p15a2-tdd-plan.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/contracts.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/implementation-plan.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/test-matrix.md`
- Modify: `openspec/changes/add-technical-configuration-comparison/p15c-tdd-plan.md`

- [ ] Add P15A2 as a DB-only audit-hardening leaf between P15A and P15C.
- [ ] Freeze the audit event fields and fail-closed ordering from the approved design.
- [ ] State that P15C remains blocked until P15A2 is merged, applied, and its
      success-path audit plus updated concurrency gates pass.
- [ ] Mark forced audit failure as isolated-environment-only, never a routine
      live rollback-only gate.
- [ ] Preserve P15C non-scope for migrations and SQL changes.
- [ ] Run strict OpenSpec validation and confirm it remains green.
- [ ] Commit the approved design/plan/OpenSpec contract.

## Chunk 2: RED Source Contract

### Task 2: Write the failing migration-source test

**Files:**

- Create: `src/app/api/rpc/__tests__/technical-configuration-dossier-delete-audit-migration.test.ts`

- [ ] Write a test that expects exactly one migration containing the P15A2 marker.
- [ ] Require timestamp ordering after every local delete/guard predecessor and
      the exact `public.audit_log(TEXT, TEXT, BIGINT, TEXT, JSONB)` helper.
- [ ] Require the unchanged delete signature, `SECURITY DEFINER`, `search_path`,
      authenticated-only grant, and `{ data: { id } }` response.
- [ ] Require the editable guard, locked-history check, dossier root snapshot,
      fail-closed `audit_log()` call, and root delete in that order.
- [ ] Require `IS DISTINCT FROM TRUE` and the exact
      `PT500/audit_log_failed` failure.
- [ ] Require `entity_id` to be `NULL`, the dossier UUID/root metadata in
      `action_details`, and action/entity constants from the design.
- [ ] Require a rollback-only success gate without shared-helper replacement,
      a separate isolated forced-failure gate, and the audit-aware concurrency
      gate changes.
- [ ] Run only the new test and verify RED because the migration and gate do not
      exist.
- [ ] Commit the RED test.

## Chunk 3: GREEN Migration And Gate

### Task 3: Add the minimal audit-hardening migration

**Files:**

- Create: `supabase/migrations/20260806031201_technical_configuration_dossier_delete_audit.sql`

- [ ] Copy the deployed P15A delete contract without changing its signature,
      guard ordering, locked-history rule, response, or grants.
- [ ] Store the global user ID returned by the editable-dossier guard only if
      needed for diagnostics; do not duplicate claim parsing.
- [ ] Read the dossier root metadata while the guard's row lock is held.
- [ ] Call `public.audit_log()` with the frozen event shape before `DELETE`.
- [ ] Raise `PT500/audit_log_failed` when the helper result
      `IS DISTINCT FROM TRUE`, so `FALSE` and `NULL` both fail closed.
- [ ] Keep `SECURITY DEFINER` and `SET search_path = public, pg_temp`.
- [ ] Revoke from `PUBLIC`, `anon`, `authenticated`, and `service_role`, then
      grant only `authenticated`, matching P15A.
- [ ] Run the new source test and verify GREEN.

### Task 4: Add isolated audit proof and update concurrency proof

**Files:**

- Create: `supabase/tests/technical_configuration_dossier_delete_audit_phase_gate.sql`
- Create: `supabase/tests/technical_configuration_dossier_delete_audit_failure_phase_gate.sql`
- Modify: `supabase/tests/technical_configuration_dossier_delete_concurrency_phase_gate.sql`

- [ ] Keep the success gate rollback-only and free of shared-function
      replacement so it is eligible for later separately authorized live use.
- [ ] Mark the forced-failure script as isolated-environment-only and forbidden
      on live DB.
- [ ] For success, call the production delete RPC and assert one audit row keeps
      the exact UUID/root snapshot after the dossier and descendants are
      deleted, using complete JSONB equality.
- [ ] For failure, transactionally replace only the exact `audit_log` overload
      with a `RETURN FALSE` body, assert exact `PT500/audit_log_failed`, then
      prove dossier/descendants remain and no failure-token audit row exists.
- [ ] Let each transaction roll back its fixtures; let the isolated failure
      transaction also restore the helper.
- [ ] Update the two-session gate to assert exactly one token-matched delete
      audit for delete-first, zero for lock-first, token-scoped audit cleanup,
      and zero dossier/audit residue.
- [ ] Run the source test again; do not execute the SQL gate against live DB.
- [ ] Commit the GREEN migration and gate.

## Chunk 4: Regression And Review

### Task 5: Run local verification

**Files:**

- Test: `src/app/api/rpc/__tests__/technical-configuration-dossier-delete-audit-migration.test.ts`
- Test: `src/app/api/rpc/__tests__/technical-configuration-dossier-delete-migration.test.ts`
- Test: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

- [ ] Run `node scripts/npm-run.js run format:check`.
- [ ] Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] Run `node scripts/npm-run.js run verify:dedupe`.
- [ ] Run `node scripts/npm-run.js run typecheck`.
- [ ] Run the P15A/P15A2 source and whitelist tests.
- [ ] Run the five P15B metadata-edit suites.
- [ ] Source-inspect the isolated gate only; do not execute it on live DB.
- [ ] Run `node scripts/npm-run.js run react-doctor`.
- [ ] Run strict OpenSpec validation.
- [ ] Run `git diff --check`.

### Task 6: Review and publish

- [ ] Rerun Code Review Graph changed-file detection and GitNexus impact
      analysis against the completed diff.
- [ ] Dispatch a focused subagent code review.
- [ ] Fix actionable findings and rerun affected gates.
- [ ] Commit all final changes with hooks enabled.
- [ ] Push `feat/869-p15a2-dossier-delete-audit`.
- [ ] Open a PR linked to Issue #869, explicitly stating no live DB write was
      performed and P15C remains blocked.
- [ ] Triage and address valuable PR comments, rerunning affected gates.
- [ ] Pause before migration apply and ask for explicit live DB write
      permission. If granted later, request separate authorization for the
      success-path audit gate and updated two-session concurrency gate.
- [ ] Never run the forced-failure helper-replacement gate on live DB as part of
      this leaf.
