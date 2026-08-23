# Phase 6 Implementation Plan — Pre-Live and Reconciliation State Machine

Change: `add-database-quality-gate`
Covers: tasks 6.1–6.9 in `tasks.md`
Spec deltas: `specs/database-quality-gate/spec.md` — "Exact landed-commit
pre-live boundary", "Verified live read-back", "Independent post-apply
reconciliation"
Design context: `design.md` §8 (landed commit before live permission), §9 (two
mandatory reconciliation branches)

Status: planned, not started. Phases 0–5 are implemented and green.

## 0. Scope and Non-Goals

In scope:

- Implement the two remaining gate lanes (`pre-live`, `reconciliation`) that
  the lane enum already declares but no runner serves yet.
- Exact landed-SHA evidence enforcement, Oracle-authoritative report lookup,
  read-only live-state ingestion, verified and durably stored live read-back,
  evidence-bound lock-only reconciliation PR preparation, independent Oracle
  baseline catch-up, and the blocking rules between them.
- State-machine and fault-injection tests proving PASS never implies
  permission and reconciliation gates every later migration.
- Reconcile the already-live Phase 5 migration
  `20260819062043_technical_configuration_baseline_cross_dossier_copy` through
  the protected-main rollout interlock in §7 before any later migration enters
  pre-live. This bootstrap is read-only toward live.

Out of scope (fail-closed stays):

- No Supabase MCP invocation from harness code. The operator performs MCP
  reads and writes; the harness ingests canonical observations, verifies them,
  and persists only non-secret evidence on Oracle.
- No live database connection, credential, or write path of any kind.
- No protected-`main` activation or CI wiring (Phase 7).
- No full migration-history reconstruction.
- A gate PASS, merge, approval, or waiver never grants live-write permission.

## 1. Current-State Grounding (Phases 0–5)

Facts the plan builds on (verified against the working tree):

- `scripts/db-quality-gate/types.ts:5` — `GATE_LANES = ["static",
"baseline-forward", "pre-live", "reconciliation"]`. Both Phase 6 lanes exist
  as types but fall through to a synthesized fail-closed INCOMPLETE report in
  `cli.ts` (exit code 2). No runner exists.
- Evidence model: findings carry stable `ruleId` + `fingerprint`;
  reports carry `subjectCommit`, `digest`, lane-specific `inputHashes`, and
  `baselineMigrationHighWater`. `createEvidenceInvalidationKeys()` exists as a
  Phase 1 contract helper but production reports currently use lane-specific
  hash keys instead of one embedded `EvidenceInvalidationKeys` object. Phase 6
  must verify the actual static and baseline-forward report keys rather than
  assuming the helper is already wired. Deterministic digest remains
  `reportDigest` over canonicalized JSON (`serialization.ts`); exit codes
  remain PASS=0 / FAILED=1 / INCOMPLETE=2.
- `git-evidence.ts`: `resolveGitCommit`, `currentHeadCommit`,
  `readFileAtCommit`, `listFilesAtCommit`, `isAncestorCommit`. No squash-merge
  awareness yet — nothing distinguishes PR-head PASS from landed-SHA PASS.
- `approvals.ts`: DANGEROUS approvals are commit-bound
  (`approvalCommit === finalCommit`), with expiry, revocation, supersede, and
  mandatory review evidence. Reuse this binding style for pre-live evidence.
- `applied-lock-history.ts`: `preservesAppliedLockHistory` (append-only check)
  and `hasAppendedAppliedEntries` ("appended applied entries lack independent
  read-back authority" — already surfaced as INCOMPLETE debt by registry
  and migration-repository rules). The current lock has `applied: []`, so a
  Phase 6 lock append cannot pass the existing static contract without adding
  a durable read-back authority binding.
- `baseline-state.ts`: atomic published state on the Oracle VM
  (`/opt/supabase-test/quality-gate/baseline/current.json`) with `healthy`,
  `migrationHighWater`, `confirmedMigrations`, `recovery?`, plus
  `isBaselineForwardEvidenceReusable(report, state)`.
- `baseline-maintenance.ts` + `-cli.ts`: `catch-up | full-refresh | health`
  operations with runId-keyed mutual exclusion, exposed as
  `npm run db:quality-gate:baseline`.
- Oracle executor: immutable per-run report persistence
  (`persistReport → { evidenceId: "oracle:<runId>" }`, chmod a-w), SSH pinned
  host key, disposable-only apply guard.
- CLI: `runDatabaseQualityGateCommand(args)` with `--lane --run-id
--subject-commit --created-at`; stdout JSON only; non-static lanes require
  `--run-id`; `--subject-commit` must equal HEAD.
- Tests: vitest under `scripts/__tests__/database-quality-gate-*.test.ts`,
  fixture repositories with real git commits, scripted fake executors via
  `commandRecorder()` — fault injection without `vi.mock`.
- Read-only verification on 2026-08-23: live and `qltbyt_test` both contain 325
  migrations at high-water `20260819062043`; the published Oracle baseline is
  healthy and confirms local path
  `supabase/migrations/20260819031200_technical_configuration_baseline_cross_dossier_copy.sql`
  at SHA-256
  `52d5a5c38595f3b294bd9003d10a6ae6259253fefe5e1a19b49ff158cb8eeba4`.
  `supabase_migrations.schema_migrations` exposes `version`, `name`, and
  `statements` but no trustworthy `appliedAt` timestamp.

## 2. Architecture Decisions

### D1 — Live state is ingested evidence, never a direct connection

The harness holds no live credentials and opens no connection to the live
project. Pre-live consumes an operator-produced observation exported from a
read-only Supabase MCP session (`list_migrations` / `execute_sql`) and rejects
observations for any project other than the configured live project:

```
LiveMigrationObservation {
  schemaVersion: 1
  source: "supabase-mcp"
  capturedAt: ISO-8601
  projectRef: "cdthersvldpnlbvpufrr" // identity binding only; never used to connect
  migrations: [{ version, name }]    // unique and strictly ordered ascending
}
```

Rules:

- strict zod validation; 14-digit unique versions; non-empty names; strictly
  ascending order
- evaluate freshness against a production clock captured once as report
  `createdAt`; caller-supplied `--created-at` is rejected for Phase 6 lanes
- tests inject the clock through dependencies rather than CLI arguments
- maximum age is 15 minutes; more than 2 minutes in the future is invalid
- wrong `projectRef`, stale/future `capturedAt`, malformed content, or duplicate
  versions ⇒ INCOMPLETE
- the canonical observation hash folds into `report.inputHashes`

Rationale: preserve the secret-free, runner-neutral contract, reject
wrong-project evidence, and keep every live touch inside an explicit human/MCP
session.

### D2 — Reconciliation state is derived from immutable evidence, not a new mutable state store

Reconciliation status is recomputed from five committed/published facts:

1. Git trust anchor: the read-only protected-main verifier confirms the Phase 7
   PR-only/static-check/no-force-push/no-deletion ruleset is active. Unavailable
   or inactive protection keeps reconciliation INCOMPLETE; Phase 6 never
   activates or edits the ruleset.
2. Oracle read-back evidence: a canonical `ReadBackRecord` is stored under an
   immutable run ID and remains readable with the expected digest.
3. Applied-lock branch: `supabase/applied-migrations.lock.json` at landed HEAD
   contains one appended future-applied entry:

   ```
   {
     path,
     sha256,
     liveVersion,
     liveName,
     readBackEvidenceId,
     readBackDigest
   }
   ```

   `path` + `sha256` remain the migration identity. The additional fields are
   immutable authority/audit bindings for future `applied` entries; legacy
   entries remain unchanged.

4. Baseline branch: published baseline state is healthy, has no `recovery`
   field, `migrationHighWater` equals the confirmed live version, and the
   confirmed migration identity matches the reviewed local file hash.
5. Rerun requirement: the Oracle-authoritative baseline-forward report for the
   current subject commit has
   `baselineMigrationHighWater` equal to the new high-water and passes
   `isBaselineForwardEvidenceReusable`.

Both branches are evaluated independently so either can fail without blocking
the other's progress (spec scenario coverage).

### D3 — Automation boundary

Gate lane commands remain report-oriented. A separate
`db:quality-gate:reconcile-lock` command performs the stateful local Git
preparation; the main lane parser does not gain a valueless boolean flag.

The lock preparation command:

- requires a clean worktree and exact landed `HEAD`
- refreshes the public `origin/main` ref and requires
  `HEAD == subjectCommit == origin/main`; a feature-branch HEAD is rejected
- verifies protected `main` is active through the read-only Phase 7 trust
  checker; unavailable/inactive protection stops before branch creation
- loads and verifies the immutable Oracle read-back evidence before editing
- rejects a pre-existing/conflicting branch or already-appended identity
- creates `db-gate/reconcile-lock-<version>`, appends the evidence-bound entry,
  verifies full append-only history + canonical hashes, commits, and prints the
  exact push/PR commands
- makes no push, PR, or remote mutation; its only network operations are the
  public read-only `origin/main` fetch and pinned read-only Oracle evidence
  lookup
- restores the original branch/worktree state on branch creation, validation,
  or commit failure

Merge/push failure handling is tested at the documented operator boundary.
Live apply remains a manual Supabase MCP step performed by an explicitly
authorized maintainer.

### D4 — Module layout (reuse-first)

New files under `scripts/db-quality-gate/`, each well under the 450-line
ceiling:

| File                            | Responsibility                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-live-live-state.ts`        | `LiveMigrationObservation` zod schema, parse, freshness, canonical hashing                                                               |
| `protected-main.ts`             | Read-only verification of the Phase 7 protected-main trust anchor; never activates or mutates rulesets                                   |
| `oracle-evidence-store.ts`      | Read/write immutable non-secret report and read-back evidence by run ID through the pinned Oracle SSH boundary                           |
| `read-back.ts`                  | `ReadBackObservation`/`ReadBackRecord` schemas, canonical live SQL-hash verification, Oracle persistence                                 |
| `read-back-cli.ts`              | Validate an MCP-exported read-back observation and persist the canonical record before lock preparation                                  |
| `pre-live.ts`                   | Pre-live runner: fresh static run, Oracle baseline-forward evidence lookup, invalidation comparison, live/baseline/reconciliation checks |
| `reconciliation.ts`             | Branch evaluation state machine, blocking rules, lane report                                                                             |
| `reconciliation-lock-pr.ts`     | Lock-only PR preparation (branch, validated append, commit, next-step output)                                                            |
| `reconciliation-lock-pr-cli.ts` | Dedicated stateful key/value CLI; no valueless flag in the gate CLI                                                                      |

Modified: `cli.ts` (dispatch both lanes and parse their key/value inputs),
`git-evidence.ts` / `static-lane.ts` (trusted landed-parent diff rather than
`origin/main == HEAD`), `dynamic-lane-inputs.ts` (project future applied entries
back to `{path, sha256}` migration identities), `dynamic-lane-types.ts` /
Oracle remote code (shared evidence store),
`registries.ts`, `applied-lock-history.ts`, `migration-repository.ts`, and
static-lane evidence/tests (future-applied read-back pointer semantics),
`package.json` (read-back and lock-preparation commands), and
`docs/runbooks/db-quality-gate-oracle.md`. No changes to applied migration SQL
or the PASS/FAILED/INCOMPLETE exit-code contract.

## 3. Work Breakdown (RED-first per Delivery Rules)

Every task lands failing tests first, then implementation. Test files follow
`scripts/__tests__/database-quality-gate-<area>.test.ts` naming and reuse
`loadDatabaseQualityGateModule`, `createFixtureRepository`,
`commitFixtureRepository`, and the scripted fake executor layer.

### Checkpoint A — Pre-live lane (tasks 6.1–6.4)

**6.1 Exact landed-SHA evidence checks**

- RED (`database-quality-gate-pre-live.test.ts`):
  - PR-head-only baseline-forward evidence after squash merge ⇒ BLOCKING
    `prelive/evidence-not-landed` + INCOMPLETE
  - feature-branch HEAD, stale/unavailable `origin/main`, or subject commit not
    equal to refreshed `origin/main` ⇒ INCOMPLETE
  - unreadable Oracle report, unknown run ID, wrong lane, non-PASS outcome,
    recomputed-digest mismatch, or an arbitrary local report path ⇒ INCOMPLETE
  - exact landed report loaded from Oracle with matching digest ⇒ accepted
- Impl (`pre-live.ts`, `git-evidence.ts`, `oracle-evidence-store.ts`):
  - fetch the public `origin/main` ref without credentials; resolve
    `--subject-commit` via `resolveGitCommit`; require
    `subjectCommit == HEAD == origin/main`
  - resolve the landed commit's first parent and run `runStaticLane` over that
    immutable parent-to-HEAD diff; do not reuse its production default
    `origin/main`, which equals HEAD after synchronization and would hide the
    squash-merged migration diff
  - persist the finalized fresh static report to Oracle before it can satisfy
    pre-live
  - load the baseline-forward full report by immutable Oracle run ID; never
    accept a caller-supplied report file as authoritative
  - require `outcome=PASS`, `requiredChecksComplete=true`,
    `evidenceAvailable=true`, exact lane/subject, readable full report, and
    recomputed digest equality
  - independently recompute the actual lane-specific immutable keys from HEAD;
    compare baseline-forward `inputHashes.baselineState` to the current
    published baseline hash and validate all required static input hashes
- Acceptance: a self-consistent fabricated JSON report is insufficient;
  PR-head-only PASS and feature-branch HEAD are rejected; a migration in
  `landed-parent..HEAD` is still statically inspected after
  `origin/main == HEAD`; exact landed evidence is accepted only while every
  required input remains valid.

**6.2 Read-only comparisons**

- RED: wrong project, stale/future observation, duplicate or unordered
  versions, malformed observation ⇒ INCOMPLETE; live high-water ahead of
  baseline high-water ⇒ BLOCKING `prelive/baseline-behind-live`.
- Impl (`pre-live.ts`, `pre-live-live-state.ts`): parse + hash observation,
  compare live migration list against applied-lock entries and against
  published baseline high-water (read through existing Oracle client when
  configured); capture one trusted production-clock value as report
  `createdAt` for the 15-minute age and 2-minute future-skew policy; inject time
  only through test dependencies; absent executor environment ⇒ INCOMPLETE,
  never PASS.
- Acceptance: all comparisons are read-only; missing Oracle access cannot
  produce PASS; observations from another Supabase project cannot produce PASS.

**6.3 PASS ≠ permission proof**

- RED: a fully green pre-live report must contain a deterministic WARNING
  finding `prelive.permission.explicit-required` with evidence
  `{ nextAction: "request-explicit-permission" }`; state-machine test asserts
  no code path can emit a write action or accept a "permission" input.
- Impl: reuse the existing `GateFinding` contract instead of adding an
  unversioned top-level `GateReport` field; no flag acknowledges permission.
- Acceptance: exhaustive CLI flag test shows no permission-acknowledging
  input; report text mandates explicit operator authorization.

**6.4 MCP apply handoff documentation**

- Impl: extend `docs/runbooks/db-quality-gate-oracle.md` with the exact
  handoff: verify landed SHA → run both lanes → present digest-bearing
  Oracle evidence IDs → request affirmative permission → operator applies via
  Supabase MCP → capture and persist read-back evidence for 6.5. No
  credentials or apply command are embedded in tooling.
- Acceptance: runbook review checklist matches spec scenario "Landed commit is
  ready for permission request".

### Checkpoint B — Reconciliation state machine (tasks 6.5–6.9)

**6.5 Read-back ingestion + canonical SQL-hash verification**

- RED (`database-quality-gate-read-back.test.ts`): read-back record whose
  observed canonical SQL hash differs from local migration source ⇒
  verification fails; wrong project/name/path, empty statements, missing
  record, or future/stale capture ⇒ reconciliation-required; matching evidence
  binds `{migrationPath, sha256, liveVersion, liveName}`.
- Impl (`read-back.ts`, `read-back-cli.ts`, `oracle-evidence-store.ts`):
  accept the strict MCP-exported observation:

  ```
  ReadBackObservation {
    schemaVersion: 1
    source: "supabase-mcp"
    projectRef: "cdthersvldpnlbvpufrr"
    capturedAt: ISO-8601
    migrationPath: canonical local path
    liveVersion: 14 digits
    liveName: non-empty
    statements: non-empty string[]
  }
  ```

  The importer:

  - canonicalizes `array_to_string(statements, E'\n')` using the same one
    optional terminal-newline rule as migration source hashing
  - computes `observedCanonicalSha256`, `statementCount`, `canonicalBytes`, and
    `rawObservationDigest` internally
  - recomputes the reviewed local file hash from
    `readFileAtCommit(subjectCommit)` and compares it to the observed hash
  - captures trusted receipt time through a production clock; rejects stale,
    future, wrong-project, wrong-name, and wrong-path observations
  - persists the normalized computed `ReadBackRecord` and raw observation
    digest under an immutable Oracle run ID

  A caller-provided local/expected digest, count, or byte length is not accepted
  as live authority.

- Acceptance: mismatch/missing/match behaviors match spec scenarios under
  "Verified live read-back"; later reconciliation can reload the full record
  from Oracle and verify its digest without the temporary observation file.

**6.6 Lock-only reconciliation PR workflow**

- RED: prepared append must satisfy `preservesAppliedLockHistory`;
  non-append edits, missing/rewritten evidence pointers, dirty worktree,
  existing branch, wrong HEAD, inactive/unavailable protected-main trust,
  branch creation failure, and commit failure are surfaced as INCOMPLETE with
  cleanup.
- Impl:
  - extend future `applied` entry schema with D2 authority fields while keeping
    legacy entries and migration identity projection stable
  - make `preservesAppliedLockHistory` compare the complete prior applied
    entries, including evidence bindings
  - replace the unconditional `registry.applied-lock.readback` /
    `migration.applied-readback` debt with fail-closed validation: an appended
    entry is statically acceptable only when it has a complete immutable
    evidence pointer matching path/hash/version/name
  - `reconciliation-lock-pr.ts` loads the full Oracle read-back evidence before
    creating `db-gate/reconcile-lock-<version>`, appends exactly one valid
    entry, validates, commits, and prints push/PR commands
- Acceptance: the secret-free static gate can validate append-only structure
  and the audit pointer; only the reconciliation lane may treat the Oracle
  full record as authoritative and complete the branch.

**6.7 Independent Oracle baseline catch-up branch**

- Impl: thin orchestration over existing `runBaselineCatchUp` +
  `runBaselineHealthRecovery` (already exposed via
  `npm run db:quality-gate:baseline`) invoked with the confirmed-live
  migration; failures leave published unhealthy+recovery state (existing
  behavior) which the state machine reads.
- Acceptance: catch-up failure does not affect lock-branch status and vice
  versa (independence proven by tests).

**6.8 Blocking rule until both branches complete**

- RED: while either branch is incomplete, pre-live for any subsequent pending
  migration returns BLOCKING `reconciliation/incomplete`; after both complete
  and baseline-forward reruns against the new high-water, blocking clears;
  unprotected `main` can never complete reconciliation.
- Impl (`reconciliation.ts`): derive branch status per D2; reload the lock
  entry's Oracle read-back evidence pointer; consume the read-only
  protected-main verifier; expose `evaluateReconciliation()` used by pre-live;
  wire `--lane reconciliation` dispatch in `cli.ts`.
- Acceptance: mirrors spec scenarios "Lock and baseline reconciliation
  succeed", "Applied-lock update fails", "Baseline catch-up fails"; the
  already-live Phase 5 migration remains blocking until its bootstrap lock PR
  lands and baseline-forward reruns on that landed SHA.

**6.9 State-machine and fault-injection tests**

Consolidated matrix (see §5) covering changed content, wrong-project evidence,
missing/stale/future observations, unreadable or fabricated reports,
blanket/mismatched/non-affirmative permission posture, read-back mismatch,
lock/branch/commit failure, catch-up failure, merge/push failure, Phase 5
bootstrap, and successful recovery — injected via fake executors, fixture git
repos, and mutated evidence files.

## 4. CLI Surface After Phase 6

The gate command keeps stdout JSON and exit codes 0/1/2. Every gate option
remains key/value; stateful preparation uses separate commands:

- `--lane pre-live --run-id <id> --subject-commit <sha>`
  `--baseline-forward-run-id <id> --baseline-forward-digest <sha256>`
  `--live-observation <path> [--baseline-state-path <path>]`
- `--lane reconciliation --run-id <id> --subject-commit <sha>`
  `--baseline-forward-run-id <id> --baseline-forward-digest <sha256>`
- `npm run db:quality-gate:read-back -- --run-id <id>`
  `--subject-commit <sha> --observation <path>`
- `npm run db:quality-gate:reconcile-lock -- --run-id <id>`
  `--subject-commit <sha> --read-back-run-id <id>`
  `--read-back-digest <sha256>`
- Baseline maintenance stays `npm run db:quality-gate:baseline`.

Pre-live derives `<run-id>-static` for its fresh static report and persists that
report before aggregate PASS. Arbitrary local static/dynamic report paths and
valueless `--prepare-lock-pr` are not part of the contract. Phase 6 production
lanes reject caller-supplied `--created-at`; tests inject a clock dependency.

## 5. Test Matrix (state machine × fault injection)

| #   | Given                                                                 | When                             | Then                                                        |
| --- | --------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| 1   | Evidence bound to PR head or feature-branch HEAD                      | pre-live                         | INCOMPLETE; refreshed `origin/main` equality required       |
| 2   | Local/fabricated report or unreadable Oracle run ID                   | pre-live                         | INCOMPLETE; digest alone is insufficient                    |
| 3   | Oracle reports match landed SHA                                       | inputs unchanged since runs      | accepted                                                    |
| 4   | Any required lane-specific input hash changed                         | pre-live compares current inputs | INCOMPLETE, rerun required                                  |
| 5   | Observation wrong-project, stale, future, backdated, or malformed     | pre-live                         | INCOMPLETE; caller cannot set evaluation time               |
| 6   | Live ahead of baseline                                                | pre-live                         | BLOCKING finding                                            |
| 7   | Full green pre-live                                                   | inspect report                   | WARNING requests explicit permission; no write path exists  |
| 8   | Read-back observed live hash mismatch                                 | read-back ingestion              | no Oracle authority record; reconciliation required         |
| 9   | Dirty worktree, wrong HEAD, unprotected main, or Git failure          | prepare lock                     | INCOMPLETE with cleanup                                     |
| 10  | Evidence pointer missing or rewritten                                 | static/reconcile                 | append rejected or reconciliation incomplete                |
| 11  | Lock branch push/merge fails                                          | reconcile                        | lock branch incomplete, catch-up may proceed independently  |
| 12  | Catch-up fails                                                        | reconcile                        | baseline branch incomplete, lock branch independent         |
| 13  | Both branches complete + rerun vs new high-water                      | pre-live next migration          | unblocked                                                   |
| 14  | Blanket/prior/non-affirmative permission posture                      | any lane                         | ignored by design; no permission input exists               |
| 15  | Existing `20260819062043` live/baseline state with empty applied lock | Phase 6 bootstrap                | blocked until evidence-bound lock PR lands and rerun passes |

## 6. Verification Order (per AGENTS.md)

1. `node scripts/npm-run.js run format:check` (or rely on Lefthook staged
   Prettier auto-fix)
2. `node scripts/npm-run.js run verify:no-explicit-any`
3. `node scripts/npm-run.js run verify:dedupe`
4. `node scripts/npm-run.js run typecheck`
5. Focused vitest: `database-quality-gate-pre-live*`, `-read-back`,
   `-reconciliation*`, `-reconciliation-lock-pr`, CLI parser coverage,
   registry/migration-repository append-authority regressions, plus the
   existing gate suites
6. `node scripts/npm-run.js run react-doctor` (repo default diff-only gate)
7. `openspec validate add-database-quality-gate --strict`

Code-deduplication skill review before commit: new modules must not duplicate
hashing/validation logic already in `contract.ts` / `serialization.ts` /
`registries.ts` — import instead of copy.

## 7. Rollout Strategy

- Two focused PRs: Checkpoint A (6.1–6.4 + matrix rows 1–7), Checkpoint B
  (6.5–6.9 + matrix rows 8–15). Each PR updates its `tasks.md` checkboxes
  only after its tests pass.
- No migration SQL, registry content, or live-environment change ships in the
  two implementation PRs.
- After both Phase 6 implementation PRs land, execute the protected-main
  interlock in the design's canonical order:
  1. implement and land Phase 7 tasks 7.1–7.3: local hook integration,
     secret-free static PR workflow, and the reviewed ruleset definition
  2. activate protected `main`; verify PR-only updates, required static gate,
     no force-push/deletion, and auditable break-glass behavior
  3. capture the existing live `20260819062043` row, including raw
     `statements[]`, through read-only Supabase MCP
  4. validate and persist the computed read-back record on Oracle
  5. prepare, push, review, and merge the evidence-bound lock-only PR under the
     active ruleset
  6. verify the already-healthy Oracle baseline still matches
     `20260819062043`; do not run catch-up when no catch-up is needed
  7. run static and baseline-forward on the landed lock-bearing SHA, then run
     reconciliation to PASS
- The bootstrap performs no live write. The lock remains untrusted and
  reconciliation remains INCOMPLETE until protected `main` is active. Phase 7
  tasks 7.4–7.7 continue only after this bootstrap checkpoint passes.

## 8. Open Questions

None blocking after this review:

- freshness is fixed at 15 minutes with 2 minutes maximum future skew, measured
  against one trusted production-clock value stored as report `createdAt`;
  tests inject the clock and production Phase 6 CLIs reject `--created-at`
- live project identity is fixed to `cdthersvldpnlbvpufrr`
- temporary MCP exports stay outside the repository; the runbook uses
  `/tmp/db-quality-gate/<run-id>/` and durable authority is Oracle evidence
- permission next-step output uses the existing WARNING finding contract,
  avoiding an unversioned `GateReport` schema change
