# Implementation Tasks

Each phase has a narrow review boundary. Do not combine Phase 1 runtime work with
unrelated equipment, frontend, audit, or schema changes.

**Task-sizing rule:** each checklist item must produce one observable result and
be independently reviewable or verifiable. PR 2 has a hard cap of one migration
and two existing focused test files. If implementation requires another source
file, shared helper, refactor, or schema addition, stop and propose a separate
follow-up change instead of expanding the PR.

## Phase 0 - Proposal And Approval (PR 1: Docs Only)

**Review boundary:** OpenSpec artifacts only. No runtime code and no live DB
writes.

- [x] 0.1 Document the current ordering root cause and read-only live evidence.
- [x] 0.2 Define the liquidation chronology, legacy-null, filter, pagination,
      requested-sort, and opt-out requirements.
- [x] 0.3 Record the rejected `updated_at`, audit-join, client-sort, and new
      timestamp alternatives.
- [x] 0.4 Split implementation, rollout, and archive into separate review
      boundaries.
- [x] 0.5 Run
      `openspec validate update-equipment-liquidation-group-ordering --strict`.
- [x] 0.6 Obtain proposal approval before starting Phase 1.

**Exit criteria:** strict validation passes and the proposal PR is approved.

## Phase 1 - SQL Ordering Contract (PR 2: Migration Plus Focused Tests)

**Review boundary:** at most three changed files: one superseding migration and
two existing focused test files. No frontend files, helper extraction, unrelated
SQL cleanup, or live DB apply.

### Phase 1A - RED: Lock the source contract

- [x] 1.1 Create the implementation branch from the latest clean `main`.
- [x] 1.2 Add a failing source-contract assertion requiring the liquidation
      chronology key before the requested sort.
- [x] 1.3 Run the focused migration test and confirm the new assertion fails for
      the current SQL.

### Phase 1B - GREEN: Change only the RPC ordering expression

- [x] 1.4 Create a migration whose filename sorts after
      `20260722094302_equipment_list_liquidation_last.sql`.
- [x] 1.5 Copy the latest local `equipment_list_enhanced` definition into the
      superseding migration.
- [x] 1.6 Add the null-safe ISO-text `ngay_ngung_su_dung` chronology key between
      the liquidation bucket and requested sort.
- [x] 1.7 Add or retain source-contract assertions for the unchanged 18-argument
      signature and default-false flag.
- [x] 1.8 Add or retain source-contract assertions for unchanged JWT guards,
      tenant scope, `SECURITY DEFINER`, fixed `search_path`, and grants.
- [x] 1.9 Add or retain source-contract assertions for unchanged filters, result
      envelope, and pagination.
- [x] 1.10 Run the focused migration source-contract test and confirm it passes.

### Phase 1C - Prepare the transactional smoke coverage

- [x] 1.11 Extend the transactional smoke fixture with null, old, same-day, and
      newest liquidation dates.
- [x] 1.12 Add an exact-sequence expectation proving null or blank legacy dates
      precede every dated liquidation row.
- [x] 1.13 Add a same-date expectation proving the requested sort orders rows
      within that date cohort.
- [x] 1.14 Add an equal-date-and-sort expectation proving equipment ID ascending
      is the final tie-breaker.
- [x] 1.15 Add an unfiltered smoke expectation proving the newest dated
      liquidation row is last in the liquidation group.
- [x] 1.16 Add a warehouse-filtered smoke expectation proving the same newest
      row is last in the filtered result.
- [x] 1.17 Add a custom-sort expectation proving liquidation chronology remains
      stronger than the requested sort.
- [x] 1.18 Add an unfiltered page-boundary expectation proving chronology is
      applied before pagination.
- [x] 1.19 Add a warehouse-filtered page-boundary expectation proving the same
      chronology is applied before pagination.
- [x] 1.20 Review the SQL fixture and expected sequences without executing it
      against the currently deployed function.

### Phase 1D - Regression gates and PR handoff

- [x] 1.21 Run the focused migration source-contract Vitest file.
- [x] 1.22 Run the existing caller-scope Vitest file.
- [x] 1.23 Run `node scripts/npm-run.js run format:check`.
- [x] 1.24 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [x] 1.25 Run `node scripts/npm-run.js run verify:dedupe`.
- [x] 1.26 Run `node scripts/npm-run.js run typecheck`.
- [x] 1.27 Run
      `openspec validate update-equipment-liquidation-group-ordering --strict`.
- [x] 1.28 Confirm the final diff changes no more than the planned migration and
      two focused test files.

**Exit criteria:** PR 2 is green, reviewable as one ordering change, and merged
without applying the migration live.

## Phase 2 - Live Rollout And Verification (Operational Checkpoint)

**Review boundary:** Supabase MCP operations and recorded evidence only. Do not
mix follow-up code into the rollout.

### Phase 2A - Approval and read-only preflight

- [x] 2.1 Request explicit user permission for the specific migration apply and
      rollback-only smoke write set.
- [x] 2.2 Inspect the live migration state read-only.
- [x] 2.3 Inspect the live function signature and body read-only.
- [x] 2.4 Inspect the live function security attributes and grants read-only.

### Phase 2B - Apply the approved migration

- [x] 2.5 Apply the approved superseding migration through Supabase MCP.

### Phase 2C - Verify behavior and deployment safety

- [x] 2.6 Verify the live migration version and ordering expression read-only.
- [x] 2.7 Verify the live signature and default-false flag read-only.
- [x] 2.8 Verify the live security attributes and grants read-only.
- [x] 2.9 Run
      `supabase/tests/equipment_list_enhanced_overload_regression.sql` read-only
      through Supabase MCP.
- [x] 2.10 Run the approved transactional smoke fixture and confirm it rolls
      back all fixture rows.
- [x] 2.11 Run Supabase MCP security advisors.
- [x] 2.12 Run Supabase MCP performance advisors and triage only findings caused
      by this change.
- [x] 2.13 Verify read-only that the liquidation warehouse still has unchanged
      row counts and no data backfill occurred.
- [x] 2.14 Record migration version, smoke result, advisor result, and rollback
      readiness in the tracking issue or rollout handoff.

Evidence: [Phase 2 rollout record](rollout.md).
Implementation: PR #817 (`eb180b9d`).
Rollout documentation: PR #818 (`9c82c71e`).

### Phase 2D - Conditional forward rollback

- [x] 2.15 If Phase 2C fails, stop the rollout and open a separate forward-only
      rollback PR; otherwise record this subsection as not applicable.
- [x] 2.16 Before any rollback apply, request explicit user authorization for
      that exact live DB write; otherwise record this task as not applicable.
- [x] 2.17 After an authorized rollback, re-run the overload regression,
      function-security inspection, and applicable ordering smoke; otherwise
      record this task as not applicable.

**Exit criteria:** live ordering is verified, no data was rewritten, and any
change-caused advisor finding is resolved or explicitly tracked.

## Phase 3 - Completion And Archive (Direct Main: Docs Only)

**Review boundary:** OpenSpec status/spec publication only. No runtime changes.

- [x] 3.1 Mark completed tasks with links or identifiers for PR 2 and rollout
      evidence.
- [x] 3.2 Run
      `openspec archive update-equipment-liquidation-group-ordering --yes`.
- [x] 3.3 Run
      `openspec validate equipment-liquidation-ordering --type spec --strict --no-interactive`
      and `openspec validate --specs --strict --no-interactive`.
- [x] 3.4 Review the archive diff and confirm it only moves the change and
      publishes the capability spec.
- [x] 3.5 Publish the archive directly to `main` under explicit user
      authorization, replacing the planned archive PR.
- [x] 3.6 Sync local `main` with `origin/main` after the direct push.
- [x] 3.7 Confirm no docs branch requires pruning because Phase 3 was completed
      directly on `main`.

**Exit criteria:** the deployed contract is represented in current OpenSpec
truth and the repository is clean and synchronized.
