# Phase 13 Expert Account Assignment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents are available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable global/raw-admin backend creation and role assignment for canonical `chuyen_gia` accounts while preserving the complete expert scope invariant and keeping the user-management UI dormant until Phase 14.

**Architecture:** Add one correctly ordered append-only migration that replaces the existing `user_create` and `user_update_profile` functions without changing their signatures. Expert creation validates and writes one canonical unit membership; expert role assignment locks the target row, canonicalizes scope from the existing `current_don_vi`, and rolls back atomically on any invalid state. Existing role behavior, server-side expert denial, and UI dormancy remain unchanged.

**Tech Stack:** PostgreSQL 17 / Supabase migrations, PL/pgSQL `SECURITY DEFINER` RPCs, Vitest migration-contract tests, repository Database Quality Gate, Oracle disposable baseline-forward databases.

---

## Approved Boundary

- Phase 13 is backend-only. Do not modify add/edit user dialogs, role selector constants, navigation, routes, or other Phase 14 UI surfaces.
- Keep the public signatures of `public.user_create(...)` and
  `public.user_update_profile(...)` unchanged.
- Do not add a new public RPC or a shared `SECURITY DEFINER` helper.
- A role transition to `chuyen_gia` uses the target's existing
  `current_don_vi` as the canonical assigned unit.
- Expert creation rejects any requested membership outside the canonical unit.
- Expert role assignment establishes exactly one canonical membership and
  retires obsolete memberships in the same transaction.
- Preserve existing global/raw-admin authorization, password hashing, audit
  behavior, ACLs, and every non-expert role path.
- No live Supabase write is authorized by this plan. Live apply requires a
  separate explicit maintainer confirmation for the exact MCP operation.

## File Map

- Create:
  `supabase/migrations/20260825104037_enable_expert_account_assignment.sql`
  - Replaces only `public.user_create(...)` and
    `public.user_update_profile(...)`.
- Create:
  `supabase/tests/technical_configuration_expert_account_assignment_phase_gate.sql`
  - Runtime role/caller/scope/rollback/ACL coverage on disposable gate
    databases.
- Modify:
  `supabase/tests/user_create_role_allowlist_phase_gate.sql`
  - Preserve Issue #953's seven-role and unknown-role regression coverage while
    superseding the old blanket expert rejection.
- Modify:
  `supabase/db-quality-gate-tests.json`
  - Register the new rollback-safe Phase 13 SQL gate.
- Modify:
  `src/app/api/rpc/__tests__/user-tenant-management-rbac-characterization.test.ts`
  - Add a focused latest-migration contract proving both user role mutation RPCs
    accept `chuyen_gia` while remaining global/raw-admin-owned.
- Modify:
  `openspec/changes/add-technical-configuration-expert-role/tasks.md`
  - Check Phase 13 tasks only after the reviewed implementation passes both DB
    lanes once; then amend the implementation commit and rerun both lanes on the
    resulting final SHA.

## Chunk 1: RED Contracts

### Task 0: Prove Phase 13 deployment prerequisites

- [ ] Use read-only Supabase MCP queries to confirm the target environment has
      deployed Phases 9, 11, 12, and Issue #953, including migration
      `20260825095237_harden_user_create_role_allowlist`.
- [ ] Obtain the target application's deployed release SHA from the deployment
      provider and confirm that exact release contains the Phase 3-12 route,
      shell, standalone API, proxy, session, module-guard, and account-scope
      boundaries required by the Phase 13 deploy gate. Missing or unverifiable
      release evidence is `BLOCKING / INCOMPLETE`.
- [ ] Read back `user_create`, `user_update_profile`, and
      `user_reassign_expert_scope` metadata to confirm their deployed signatures,
      `SECURITY DEFINER`, fixed `search_path`, and ACL contracts.
- [ ] Confirm there are no live expert accounts before backend assignment is
      enabled; any existing expert data requires a separate migration/data
      review before proceeding.
- [ ] Confirm the Oracle restored baseline is healthy at the same live migration
      high-water with no recovery marker or stale gate resources.
- [ ] Before baseline-forward, prove the pending migration set contains only
      `20260825104037_enable_expert_account_assignment.sql`. Any unrelated
      pending migration is `BLOCKING / INCOMPLETE`.

### Task 1: Add failing server-side migration characterization

- [ ] Extend
      `src/app/api/rpc/__tests__/user-tenant-management-rbac-characterization.test.ts`
      with a focused test that extracts the latest `user_create` and
      `user_update_profile` definitions and expects both definitions to contain
      the canonical `'chuyen_gia'` role.
- [ ] Assert the latest `user_update_profile` definition locks the target
      `nhan_vien` row with `FOR UPDATE` before scope mutation.
- [ ] Run:

  ```bash
  node scripts/npm-run.js exec vitest run \
    src/app/api/rpc/__tests__/user-tenant-management-rbac-characterization.test.ts
  ```

- [ ] Expected RED: the new expert-role assertions fail against the Issue #953
      migration and the pre-Phase-13 `user_update_profile`.

### Task 2: Define the Phase 13 SQL behavior gate

- [ ] Create
      `supabase/tests/technical_configuration_expert_account_assignment_phase_gate.sql`
      as a `BEGIN`/`ROLLBACK` test with isolated fixtures.
- [ ] Cover successful expert creation by stored/JWT `global`.
- [ ] Cover successful expert creation by stored/JWT raw `admin`.
- [ ] Assert created expert fields:
      `role = 'chuyen_gia'`, `don_vi = current_don_vi`, resolved
      `dia_ban_id`, `khoa_phong IS NULL`, exactly one canonical membership with
      no override, and one `USER_CREATE` audit row.
- [ ] Cover expert creation rejection for:
      unauthorized stored/JWT roles, missing unit, inactive unit, unit without
      active region, unknown role, and any additional membership.
- [ ] Assert rejected create calls leave no `nhan_vien`, membership, or audit
      rows.
- [ ] Cover successful normal-user to expert transition by global and raw
      `admin`, starting with mismatched home/current fields and obsolete
      memberships.
- [ ] Assert role transition canonicalizes home/current/region, keeps exactly
      one membership, updates profile fields, and writes one `USER_UPDATE`
      audit row.
- [ ] Cover runtime update rejection for:
      stored/JWT non-admin roles, a JWT/stored-role mismatch, and an authenticated
      expert caller.
- [ ] Assert every rejected update returns `42501` and leaves profile, role,
      home/current unit, region, memberships, and audit state unchanged.
- [ ] Cover invalid transition rollback and prove username, full name, role,
      department, home/current unit, region, memberships, and audit state remain
      unchanged.
- [ ] Cover existing expert profile update and expert-to-non-expert transition.
- [ ] Verify both replaced functions retain `SECURITY DEFINER`,
      `search_path = public, pg_temp`, deny `PUBLIC`/`anon`, and grant
      `authenticated`/`service_role`.

### Task 3: Supersede the Issue #953 test narrowly

- [ ] Keep all seven supported non-expert role creation cases.
- [ ] Keep unknown, null, and empty role rejection.
- [ ] Replace the old blanket `chuyen_gia` rejection with an invalid expert
      scope case that still proves validation occurs before password hashing and
      account writes.
- [ ] Keep the existing guard-order and ACL metadata assertions.
- [ ] Register the new Phase 13 SQL file in
      `supabase/db-quality-gate-tests.json` with this complete contract:
      `evidence = ["OpenSpec add-technical-configuration-expert-role Phase 13"]`,
      the exact new SQL `path`, `purpose = phase-gate`,
      `fixtureContract = isolated-fixture`, `runnerRequirements = ["psql"]`,
      `safety = default-safe`, `timeoutSeconds = 90`, and
      `transactionContract = rollback-required`.

## Chunk 2: GREEN Migration

### Task 4: Replace `user_create` with guarded expert support

- [ ] Copy the latest Issue #953 function as the source baseline; do not edit the
      applied migration.
- [ ] Keep claim parsing and stored-caller verification unchanged.
- [ ] Extend the explicit role allowlist with `chuyen_gia`.
- [ ] For `chuyen_gia`, before password hashing:
  - validate the canonical unit is active;
  - resolve an active `dia_ban_id` through `don_vi`;
  - reject any non-null membership distinct from `p_current_don_vi`.
- [ ] Insert expert rows with `don_vi`, `current_don_vi`, and `dia_ban_id`
      populated from the canonical unit.
- [ ] Insert only the canonical membership for experts; preserve existing
      membership behavior for all other roles.
- [ ] Keep audit payload shape and ACL statements compatible.

### Task 5: Replace `user_update_profile` with atomic role assignment

- [ ] Start from the latest deployed `user_update_profile` body and preserve its
      signature and non-expert behavior.
- [ ] Extend the explicit role allowlist with `chuyen_gia`.
- [ ] Lock the target `nhan_vien` row with `FOR UPDATE` and read the current
      username, stored role, and `current_don_vi`.
- [ ] When the requested role is `chuyen_gia`:
  - require a non-null current unit;
  - validate the unit and resolved region are active;
  - upsert the canonical membership with `role_override = NULL`;
  - update profile fields, role, `don_vi`, `current_don_vi`, and `dia_ban_id`;
  - delete every non-canonical membership;
  - recheck the exact invariant before writing the audit row.
- [ ] Raise `22023` for incomplete/invalid expert scope and `42501` for caller
      authorization failures. Any exception must roll back all writes.
- [ ] When the requested role is not `chuyen_gia`, retain the previous update
      behavior.
- [ ] Revoke `PUBLIC`/`anon` and grant only `authenticated`/`service_role`.

### Task 6: Prove GREEN locally

- [ ] Run the focused Vitest characterization and confirm GREEN.
- [ ] Run the unchanged proxy expert-deny and UI dormancy suites:

  ```bash
  node scripts/npm-run.js exec vitest run \
    src/app/api/rpc/__tests__/user-tenant-management-rbac-characterization.test.ts \
    src/app/api/rpc/__tests__/rpc-expert-boundary.unit.test.ts \
    src/lib/__tests__/technical-expert-role-dormancy.test.ts
  ```

- [ ] Run OpenSpec strict validation.
- [ ] Run formatting and TypeScript gates in repository order.

## Chunk 3: Review, Immutable Commit, And Database Quality Gate

### Task 7: Review and create the immutable Phase 13 commit

- [ ] Run `post_implementation_reviewer` against base `4a1a7a50` and the approved
      Phase 13 OpenSpec boundary.
- [ ] Fix valid findings and rerun affected gates.
- [ ] Run all focused checks and the final verification chain below.
- [ ] Keep Phase 13 tasks 13.1-13.6 unchecked and commit the complete reviewed
      implementation without bypassing hooks. This is the gate-candidate SHA.
- [ ] Do not edit implementation, tests, registries, or migration SQL after this
      commit. Any such edit creates a new gate-candidate SHA and restarts both DB
      lanes.

### Task 8: Gate, finalize the checklist, rerun both lanes, and push

- [ ] On the clean gate-candidate SHA, run the exact-SHA static lane and record
      its outcome and digest:

  ```bash
  GATE_CANDIDATE_SHA="$(git rev-parse HEAD)"
  node scripts/npm-run.js run db:quality-gate -- \
    --lane static \
    --run-id "phase13-candidate-${GATE_CANDIDATE_SHA:0:12}" \
    --subject-commit "$GATE_CANDIDATE_SHA"
  ```

- [ ] If the static lane reports `DANGEROUS`, stop and request an explicit
      migration-scoped maintainer approval. First rerun the unchanged candidate
      SHA with persistence enabled:

  ```bash
  RECORDED_GATE_CANDIDATE_SHA="<recorded 40-character gate-candidate SHA>"
  GATE_CANDIDATE_SHA="$(git rev-parse HEAD)"
  test "$GATE_CANDIDATE_SHA" = "$RECORDED_GATE_CANDIDATE_SHA" || exit 1
  node scripts/npm-run.js run db:quality-gate -- \
    --lane static \
    --persist-candidate-report true \
    --run-id "phase13-dangerous-${GATE_CANDIDATE_SHA:0:12}" \
    --subject-commit "$GATE_CANDIDATE_SHA"
  ```

      Review the persisted report before adding a waiver. Do not treat approval
          as live-write permission. Create the canonical approval commit as a direct
          child of the gate-candidate SHA; run its static lane with
          `--landed-parent-commit "$GATE_CANDIDATE_SHA"` and explicit approval
          subject SHA, then run Oracle `baseline-forward` on that same approval SHA.

- [ ] Run the canonical Oracle `baseline-forward` operation against a disposable
      clone using the exact same gate-candidate SHA for a clean PASS flow, or the
      direct-child approval SHA for a `DANGEROUS` flow, with a unique Phase 13
      run ID.
- [ ] Require PASS evidence for both static and baseline-forward on that exact
      preliminary completion SHA. An unavailable Oracle executor or unreadable
      evidence is `BLOCKING / INCOMPLETE`.
- [ ] Confirm Oracle cleanup: no disposable gate databases, blocked backends,
      invalid indexes, or stale gate locks.
- [ ] Only after both lanes PASS on the preliminary completion SHA, update
      Phase 13 tasks 13.1-13.6 in `tasks.md`. Amend the gate-candidate commit for
      a clean PASS flow, or amend the direct-child approval commit for a
      `DANGEROUS` flow, without bypassing hooks; record the resulting immutable
      final Phase 13 SHA.
- [ ] Rerun the exact-SHA static command and Oracle `baseline-forward` against
      that final SHA. For a clean PASS flow, use the normal non-persisting static
      command. For a `DANGEROUS` flow, use the landed-static command with the
      unchanged gate-candidate SHA as `--landed-parent-commit` and the amended
      approval SHA as `--subject-commit`. Require both lanes to PASS again; the
      earlier preliminary evidence is not final completion evidence.
- [ ] Push `feat/expert-role-phase-13` and verify it is synchronized with origin.
- [ ] If merge/rebase produces a different landed SHA, rerun both static and
      Oracle baseline-forward against the actual landed commit before Phase 13 is
      considered complete or eligible for live apply. The landed static lane must
      bind the clean landed HEAD and its exact first parent:

  ```bash
  LANDED_SHA="$(git rev-parse HEAD)"
  LANDED_PARENT_SHA="$(git rev-parse "${LANDED_SHA}^1")"
  node scripts/npm-run.js run db:quality-gate -- \
    --landed-parent-commit "$LANDED_PARENT_SHA" \
    --lane static \
    --run-id "landed-${LANDED_SHA:0:12}" \
    --subject-commit "$LANDED_SHA"
  ```

      For a normal or squash landing, confirm the first-parent diff includes the
          Phase 13 migration and gate-registry changes. For a canonical
          `DANGEROUS` approval landing, confirm the first parent is the persisted
          candidate SHA, the direct diff contains the matching evidence/waiver
          artifacts, and the quality-gate runner widens the trusted diff from the
          candidate's parent so it includes the Phase 13 migration and registry.
          Any empty, unbound, or incomplete trusted diff is
          `BLOCKING / INCOMPLETE`.

- [ ] Do not apply the migration to live in Phase 13 implementation closeout
      unless the maintainer separately authorizes that exact Supabase MCP write.

### Final verification chain

- [ ] Run final verification:

  ```bash
  node scripts/npm-run.js run format:check
  node scripts/npm-run.js run verify:no-explicit-any
  node scripts/npm-run.js run verify:dedupe
  node scripts/npm-run.js run typecheck
  node scripts/npm-run.js exec vitest run \
    src/app/api/rpc/__tests__/user-tenant-management-rbac-characterization.test.ts \
    src/app/api/rpc/__tests__/rpc-expert-boundary.unit.test.ts \
    src/lib/__tests__/technical-expert-role-dormancy.test.ts
  node scripts/npm-run.js run react-doctor
  npx openspec validate add-technical-configuration-expert-role --strict
  ```
