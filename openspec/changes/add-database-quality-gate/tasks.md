# Tasks: Add Database Quality Gate

## Delivery Rules

- Execute phases in order and keep each phase reviewable as a focused PR or
  explicit review checkpoint.
- Use RED tests before implementation changes in every phase.
- Never edit, rename, delete, repair, or rewrite an applied migration.
- Never apply candidate SQL directly to the persistent `qltbyt_test` baseline.
- Use disposable Oracle databases for dynamic validation.
- Never use Supabase CLI for agent-operated database work.
- Never treat a gate PASS, approval, merge, or risk acceptance as live-write
  permission.
- Require a new, explicit, affirmative maintainer permission for the exact live
  target and operation in the current rollout session and use Supabase MCP.
- Treat silence, prior or blanket permission, PASS, merge, approval, waiver, and
  scheduled execution as no live-write permission.
- Keep Phase 2 self-hosted runner work outside this change.
- Do not enable the Oracle timer until the first manual fresh replay passes.
- Do not remove interim repository guidance until the implemented gate is
  verified.

## Phase 0 - Characterization and RED Contract

**Purpose:** Lock current repository and environment behavior before adding the
gate.

- [x] 0.1 Reconfirm the current root migration inventory, ordering edge cases,
      live migration high-water, restored-baseline high-water, SQL-test
      inventory, Oracle runtime, and GitHub ruleset state.
- [x] 0.2 Add failing tests for deterministic finding classifications, aggregate
      outcomes, exit codes `0/1/2`, and JSON/Markdown report consistency.
- [x] 0.3 Add failing tests for canonical terminal-newline normalization and
      content-preserving SHA-256 behavior.
- [x] 0.4 Add failing registry-schema tests for applied lock, waivers,
      invariants, and SQL-test metadata.
- [x] 0.5 Add failing fixture-repository tests for legacy mutation, rename,
      deletion, lock-history mutation, pending-file editability, and ambiguous
      migration ordering.
- [x] 0.6 Add failing tests for identity-based baseline comparison and
      no-new-regressions behavior.
- [x] 0.7 Add failing DANGEROUS approval tests for candidate evidence,
      approval-bearing commits, content invalidation, expiry, revocation, and
      missing review evidence.
- [x] 0.8 Record the expected RED failures without changing production behavior,
      migration SQL, GitHub settings, Oracle databases, or live Supabase.

**Review boundary:** Tests and characterization only.

## Phase 1 - Contract Core and Evidence Model

**Purpose:** Implement the runner-neutral contract shared by every lane.

- [x] 1.1 Implement typed finding, outcome, lane, evidence, and report models.
- [x] 1.2 Implement deterministic JSON serialization, report digesting, and
      Markdown rendering.
- [x] 1.3 Implement exit-code mapping: PASS `0`, FAILED `1`, INCOMPLETE `2`.
- [x] 1.4 Implement stable `ruleId` and `findingFingerprint` generation.
- [x] 1.5 Implement evidence invalidation keys for migration, harness, lock,
      registries, baseline high-water, and executor environment.
- [x] 1.6 Implement strict schema validation for all four committed registries.
- [x] 1.7 Implement one package-command surface with explicit lane selection and
      machine-readable report output.
- [x] 1.8 Make the Phase 0 contract suites pass and add malformed-input,
      determinism, and backward-schema-version coverage.

**Review boundary:** Pure local contract logic; no database, CI, GitHub settings,
or timer changes.

## Phase 2 - Applied History, Static Gate, Baselines, and Approvals

**Purpose:** Protect migration source and produce fast diff-aware findings.

- [x] 2.1 Reuse the repository's changed-file discovery instead of creating a
      second diff implementation.
- [x] 2.2 Implement the protected legacy-cutover contract and bootstrap mode
      without recording the final cutover SHA yet.
- [x] 2.3 Implement and validate the append-only
      `supabase/applied-migrations.lock.json` schema, fixtures, and bootstrap
      generation path.
- [x] 2.4 Implement canonical source membership and deterministic root migration
      ordering; report ambiguity as INCOMPLETE.
- [x] 2.5 Implement static hygiene, transaction, source-order overwrite,
      SECURITY DEFINER/search-path, JWT-guard, explicit-grant, and ILIKE
      sanitization rules required by repository policy.
- [x] 2.6 Implement DANGEROUS statement detection with explanatory evidence
      rather than syntax-only BLOCKING.
- [x] 2.7 Create `supabase/db-quality-gate-waivers.json` with exact-bound,
      additive approval, revoke, and supersede history.
- [x] 2.8 Bootstrap identity-based legacy hygiene and advisor baselines from
      reviewed evidence.
- [x] 2.9 Make static, immutability, baseline, approval, and waiver fixture tests
      pass.

**Review boundary:** Repository-local static behavior and committed metadata
only; no dynamic database execution.

## Phase 3 - Expected State and SQL-Test Registries

**Purpose:** Make structural and semantic database expectations explicit.

- [ ] 3.1 Create `supabase/db-quality-gate-invariants.json` with reviewed table
      classes, owners, allowed operations, enforcement contracts, and evidence.
- [ ] 3.2 Create `supabase/db-quality-gate-tests.json` for the current SQL-test
      corpus with purpose, safety, runner, transaction, fixture, timeout, and
      evidence metadata.
- [ ] 3.3 Create focused Wayfinder decisions for any table whose intended access
      contract cannot be proved; keep gate activation INCOMPLETE until resolved.
- [ ] 3.4 Implement portable application fingerprint collection.
- [ ] 3.5 Implement access fingerprint collection for owners, grants, RLS,
      policies, and routine security properties.
- [ ] 3.6 Implement environment fingerprint collection for PostgreSQL, Supabase,
      and extensions.
- [ ] 3.7 Implement mandatory catalog checks and registry-selected
      `default-safe` SQL execution.
- [ ] 3.8 Prove that opt-in, performance, concurrency, and live-only tests cannot
      enter the default lane accidentally.
- [ ] 3.9 Add tests for unknown classifications, historical baseline debt, new
      tables, and widened access.

**Review boundary:** Registry and collector implementation; no production
security remediation and no indiscriminate SQL-test execution.

## Phase 4 - Disposable Oracle Execution

**Purpose:** Implement baseline-forward and fresh-replay lanes on isolated
databases.

- [ ] 4.1 Implement Oracle connection and health preflight without exposing
      database ports or using Supabase CLI.
- [ ] 4.2 Implement mutual exclusion for clone, replay, catch-up, and refresh
      operations.
- [ ] 4.3 Implement disposable database naming, creation, cleanup, and orphan
      recovery.
- [ ] 4.4 Implement baseline-forward cloning from `qltbyt_test` and ordered
      pending-migration application.
- [ ] 4.5 Implement clean fresh replay from canonical root migration source.
- [ ] 4.6 Run mandatory catalog and registry-selected default-safe SQL checks in
      disposable databases.
- [ ] 4.7 Persist deterministic reports under immutable Oracle run IDs and emit
      GitHub-compatible audit summaries and digests.
- [ ] 4.8 Add success, SQL failure, timeout, unavailable executor, interrupted
      execution, cleanup, disk-pressure, and stale-environment tests.
- [ ] 4.9 Prove no candidate migration is applied directly to `qltbyt_test` and
      no live project is reachable from the dynamic lane.

**Review boundary:** Oracle disposable test databases only; no persistent
baseline catch-up, timer, or live database work.

## Phase 5 - Baseline Health, Synchronization, and Scheduling

**Purpose:** Maintain the restored baseline and reusable evidence safely.

- [ ] 5.1 Implement atomic baseline health and migration high-water evidence.
- [ ] 5.2 Implement incremental catch-up using only migrations read-back as
      already applied live.
- [ ] 5.3 Implement serialized full-refresh recovery without publishing a
      half-restored baseline as healthy.
- [ ] 5.4 Invalidate baseline-forward evidence whenever the baseline high-water
      changes.
- [ ] 5.5 Add fault-injection tests for failed catch-up, interrupted refresh,
      unexplained drift, stale health, and recovery.
- [ ] 5.6 Add an Oracle read-only repository checkout and credential handling
      that commits no secret.
- [ ] 5.7 Add the Oracle-local `systemd` service and timer definitions with
      locking, resource limits, logs, failure status, and cleanup.
- [ ] 5.8 Keep the timer disabled and run the first full replay manually.
- [ ] 5.9 If manual replay fails because of immutable legacy history, stop and
      resolve a bootstrap design without editing applied migrations.
- [ ] 5.10 After a manual PASS, enable the timer, verify one scheduled run, and
      record the evidence ID and digest.

**Review boundary:** Oracle test-environment operations only. The current Codex
VPS has no scheduled role.

## Phase 6 - Pre-Live and Reconciliation State Machine

**Purpose:** Enforce the permission boundary and post-apply recovery contract.

- [ ] 6.1 Implement exact landed-SHA evidence checks; reject PR-head-only PASS
      after squash merge.
- [ ] 6.2 Implement read-only pre-live migration high-water, baseline health,
      report digest, and invalidation-key comparison.
- [ ] 6.3 Prove that PASS only permits asking for explicit permission and cannot
      invoke a live write.
- [ ] 6.4 Document the exact-operation Supabase MCP apply handoff without
      embedding live credentials or an automatic apply command.
- [ ] 6.5 Implement read-back evidence ingestion and canonical SQL-hash
      verification.
- [ ] 6.6 Implement the lock-only reconciliation PR workflow.
- [ ] 6.7 Implement the independent Oracle baseline catch-up and health branch.
- [ ] 6.8 Block every later live migration until both reconciliation branches
      complete and baseline-forward reruns against the new high-water.
- [ ] 6.9 Add state-machine and fault-injection tests for changed content,
      missing, stale, blanket, mismatched, or non-affirmative permission,
      read-back mismatch, lock failure, catch-up failure, merge/push failure,
      and successful recovery.

**Review boundary:** Automation stops before live apply. Any future live write
requires a new, explicit, affirmative maintainer authorization for the exact
target and operation in that rollout session. This covers migration apply, data
mutation, DDL/DCL, grants, policies, functions, triggers, schemas, extensions,
migration metadata, and state-changing RPC or function calls.

## Phase 7 - Phase 1 Enforcement and Operations

**Purpose:** Make the implemented gate enforceable without introducing Phase 2.

- [ ] 7.1 Add migration-aware Lefthook integration for required static checks.
- [ ] 7.2 Add secret-free pull-request CI for static migration validation.
- [ ] 7.3 Define and test the protected-`main` ruleset and activation procedure:
      PR-only updates, required static gate, no force-push/deletion, and
      auditable break-glass handling. Activate it only after the required
      workflow is landed.
- [ ] 7.4 Confirm manual/Oracle dynamic evidence remains a separate mandatory
      pre-live boundary rather than a GitHub-hosted dynamic check.
- [ ] 7.5 Add operator runbooks for local static checks, Oracle manual runs,
      evidence lookup, timer operation, baseline recovery, pre-live review, and
      reconciliation.
- [ ] 7.6 Update `AGENTS.md` and `CLAUDE.md` together only after the implemented
      harness contract is verified.
- [ ] 7.7 Prove no self-hosted GitHub runner, inbound database exposure,
      Supabase CLI database path, or automatic live apply was introduced.

**Review boundary:** Phase 1 only. Phase 2 requires a separate proposal after
runner-security review.

## Phase 8 - Verification and Independent Review

**Purpose:** Verify the complete implementation before any rollout claim.

- [ ] 8.1 Run formatting and all repository gates required by the changed
      implementation languages.
- [ ] 8.2 Run all focused unit, fixture-repository, disposable-database,
      fault-injection, state-machine, workflow, and runbook contract tests.
- [ ] 8.3 Run the implemented static, baseline-forward, and manual fresh-replay
      lanes and verify report determinism and exit codes.
- [ ] 8.4 Run `openspec validate add-database-quality-gate --strict` and inspect
      `openspec show add-database-quality-gate`.
- [ ] 8.5 Run the custom `post_implementation_reviewer` against the fixed base
      and Wayfinder #936; resolve valid findings and repeat until clear.
- [ ] 8.6 Verify the final diff remains within the approved implementation
      boundary and contains no unrelated migration or debt remediation.
- [ ] 8.7 Record rollback and recovery readiness for ruleset activation,
      baseline state, Oracle evidence, and timer enablement.

**Review boundary:** No live database write or migration apply is part of
implementation verification.

## Phase 9 - Phase 1 Activation and Handoff

**Purpose:** Activate the reviewed gate and leave an auditable operating state.

- [ ] 9.1 Merge and push the runner, static workflow, and ruleset definition
      through the existing approved repository process.
- [ ] 9.2 Activate protected `main` with the implemented static gate required.
- [ ] 9.3 Briefly freeze migration merges and create a dedicated bootstrap PR
      from the exact protected `main` SHA.
- [ ] 9.4 Generate the final cutover and baseline records with
      `legacyBaseline.commit` set to that bootstrap base SHA; verify the PR does
      not modify, add, delete, or rename migration SQL.
- [ ] 9.5 Merge and push the bootstrap PR, verify the cutover relationship, and
      confirm all four registries and baseline evidence are complete and
      reviewable.
- [ ] 9.6 Verify a manual baseline-forward run and the first manual fresh replay
      both PASS on the landed activation commit.
- [ ] 9.7 Enable and verify the Oracle-local timer only after step 9.6.
- [ ] 9.8 Confirm GitHub contains the audit pointer and Oracle contains the full
      report for the activation run.
- [ ] 9.9 Confirm Phase 2 remains disabled and create a separate Wayfinder
      decision before any self-hosted runner work.
- [ ] 9.10 Update linked issue and PR status, push all repository changes,
      verify the branch is synchronized, and hand off the exact commands and
      recovery state.

**Final boundary:** Activation establishes the gate only. It does not authorize
or perform a live migration.
