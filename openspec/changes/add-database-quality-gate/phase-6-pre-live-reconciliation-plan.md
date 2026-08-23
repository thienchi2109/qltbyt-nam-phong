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
- Exact landed-SHA evidence enforcement, read-only live-state ingestion,
  verified live read-back, lock-only reconciliation PR preparation,
  independent Oracle baseline catch-up branch, and the blocking rules between
  them.
- State-machine and fault-injection tests proving PASS never implies
  permission and reconciliation gates every later migration.

Out of scope (fail-closed stays):

- No Supabase MCP invocation from harness code. The operator performs MCP
  reads and writes; the harness only ingests and verifies canonical evidence.
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
- Evidence model: findings carry stable `ruleId` + `findingFingerprint`;
  reports carry `subjectCommit`, `digest`, `inputHashes`,
  `baselineMigrationHighWater`. Invalidation keys (`contract.ts`):
  `appliedLock`, `baselineMigrationHighWater`, `executorEnvironment`,
  `harness`, `migration`, `registries`. Deterministic digest via
  `reportDigest` over canonicalized JSON (`serialization.ts`); exit codes
  PASS=0 / FAILED=1 / INCOMPLETE=2.
- `git-evidence.ts`: `resolveGitCommit`, `currentHeadCommit`,
  `readFileAtCommit`, `listFilesAtCommit`, `isAncestorCommit`. No squash-merge
  awareness yet — nothing distinguishes PR-head PASS from landed-SHA PASS.
- `approvals.ts`: DANGEROUS approvals are commit-bound
  (`approvalCommit === finalCommit`), with expiry, revocation, supersede, and
  mandatory review evidence. Reuse this binding style for pre-live evidence.
- `applied-lock-history.ts`: `preservesAppliedLockHistory` (append-only check)
  and `hasAppendedAppliedEntries` ("appended applied entries lack independent
  read-back authority" — already surfaced as INCOMPLETE debt by registry
  rules).
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

## 2. Architecture Decisions

### D1 — Live state is ingested evidence, never a direct connection

The harness holds no live credentials and opens no connection to the live
project. Pre-live consumes operator-produced observation files exported from a
read-only Supabase MCP session (`list_migrations` / `execute_sql`), stored as
canonicalized JSON:

```
LiveMigrationObservation {
  schemaVersion: 1
  source: "supabase-mcp"
  capturedAt: ISO-8601
  projectRef: string            // display only, never used to connect
  migrations: [{ version, name, appliedAt }]   // ordered ascending
}
```

Rules: strict zod validation; stale `capturedAt` ⇒ INCOMPLETE finding; the
observation's canonical hash folds into `report.inputHashes`. Rationale:
preserves the secret-free, runner-neutral contract and keeps every live touch
inside an explicit human/MCP session.

### D2 — Reconciliation state is derived, not stored

No new mutable store. Reconciliation status is recomputed from three
committed/published artifacts:

1. Applied-lock branch: `supabase/applied-migrations.lock.json` at landed HEAD
   contains the appended `{path, sha256}` entry AND a verified read-back
   record matching it.
2. Baseline branch: published baseline state is healthy, has no `recovery`
   field, `migrationHighWater` equals the confirmed live version, and the
   confirmed migration identity matches the reviewed local file hash.
3. Rerun requirement: a baseline-forward report exists for the current
   subject commit whose `baselineMigrationHighWater` equals the new high-water
   (checked with `isBaselineForwardEvidenceReusable`).

Both branches are evaluated independently so either can fail without blocking
the other's progress (spec scenario coverage).

### D3 — Automation boundary

Reconciliation commands prepare and validate; they do not push. The lock-only
branch command creates a local branch, appends the entry, verifies
`preservesAppliedLockHistory` + canonical hashes, commits, and prints the
exact push/PR commands for the operator. Merge/push failure handling is tested
by injecting failures at that documented boundary. Live apply remains a
manual Supabase MCP step performed by an explicitly authorized maintainer.

### D4 — Module layout (reuse-first)

New files under `scripts/db-quality-gate/`, each well under the 450-line
ceiling:

| File | Responsibility |
| --- | --- |
| `pre-live-live-state.ts` | `LiveMigrationObservation` zod schema, parse, freshness, canonical hashing |
| `read-back.ts` | `ReadBackRecord` schema + canonical SQL-hash verification against local migration source |
| `pre-live.ts` | Pre-live lane runner: landed-SHA checks, digest/invalidation comparison, comparisons vs observation and baseline state |
| `reconciliation.ts` | Branch evaluation state machine, blocking rules, lane report |
| `reconciliation-lock-pr.ts` | Lock-only PR preparation (branch, validated append, commit, next-step output) |

Modified: `cli.ts` (dispatch both lanes), `dynamic-lane-inputs.ts` /
`report` helpers only if shared typing needs widening,
`docs/runbooks/db-quality-gate-oracle.md` (handoff section). No changes to
applied migration SQL, registries semantics, or exit-code contract.

## 3. Work Breakdown (RED-first per Delivery Rules)

Every task lands failing tests first, then implementation. Test files follow
`scripts/__tests__/database-quality-gate-<area>.test.ts` naming and reuse
`loadDatabaseQualityGateModule`, `createFixtureRepository`,
`commitFixtureRepository`, and the scripted fake executor layer.

### Checkpoint A — Pre-live lane (tasks 6.1–6.4)

**6.1 Exact landed-SHA evidence checks**

- RED (`database-quality-gate-pre-live.test.ts`): given a report digest bound
  to a PR-head commit that is not HEAD (simulating post-squash state), pre-live
  emits a BLOCKING finding `prelive/evidence-not-landed` and outcome INCOMPLETE;
  given digests whose subject commit equals HEAD, no such finding.
- Impl (`pre-live.ts`, `git-evidence.ts`): resolve `--subject-commit` via
  `resolveGitCommit`; require supplied lane-evidence files (static +
  baseline-forward reports) whose `subjectCommit` matches exactly; verify each
  digest recomputes with `reportDigest`; add invalidation-key comparison so any
  harness/registry/baseline change since the run invalidates evidence.
- Acceptance: PR-head-only PASS after squash merge is rejected; landed-SHA
  PASS with matching inputs is accepted; tampered digest rejected.

**6.2 Read-only comparisons**

- RED: stale observation (`capturedAt` older than policy window) ⇒ INCOMPLETE;
  live high-water ahead of baseline high-water ⇒ BLOCKING
  `prelive/baseline-behind-live`; observation malformed ⇒ INCOMPLETE.
- Impl (`pre-live.ts`, `pre-live-live-state.ts`): parse + hash observation,
  compare live migration list against applied-lock entries and against
  published baseline high-water (read through existing Oracle client when
  configured; absent executor environment ⇒ INCOMPLETE, never PASS).
- Acceptance: all comparisons are read-only; missing Oracle access cannot
  produce PASS.

**6.3 PASS ≠ permission proof**

- RED: a fully green pre-live report must contain an explicit finding/
  metadata field stating permission is still required; state-machine test
  asserts no code path in the pre-live runner can emit a write action or
  accept a "permission" input.
- Impl: report carries `nextAction: "request-explicit-permission"` constant;
  no flag exists to acknowledge permission.
- Acceptance: exhaustive CLI flag test shows no permission-acknowledging
  input; report text mandates explicit operator authorization.

**6.4 MCP apply handoff documentation**

- Impl: extend `docs/runbooks/db-quality-gate-oracle.md` with the exact
  handoff: verify landed SHA → run both lanes → present digest-bearing
  evidence → request affirmative permission → operator applies via Supabase
  MCP → capture read-back output for 6.5. No credentials, no apply command
  embedded in tooling.
- Acceptance: runbook review checklist matches spec scenario "Landed commit is
  ready for permission request".

### Checkpoint B — Reconciliation state machine (tasks 6.5–6.9)

**6.5 Read-back ingestion + canonical SQL-hash verification**

- RED (`database-quality-gate-read-back.test.ts`): read-back record whose
  canonical SQL hash differs from local migration source ⇒ verification fails;
  missing record ⇒ reconciliation-required; matching record binds
  `{migrationPath, sha256, liveVersion}` triple.
- Impl (`read-back.ts`): zod schema `ReadBackRecord { schemaVersion,
  migrationPath, expectedSha256, liveVersion, liveName, capturedAt, source:
  "supabase-mcp" }`; recompute file hash from `readFileAtCommit(HEAD)`; bind
  record into evidence by hashing it into `inputHashes`.
- Acceptance: mismatch/missing/match behaviors match spec scenarios under
  "Verified live read-back".

**6.6 Lock-only reconciliation PR workflow**

- RED: prepared append must satisfy `preservesAppliedLockHistory`;
  non-append edits rejected; branch creation failure and commit failure are
  surfaced as INCOMPLETE with cleanup.
- Impl (`reconciliation-lock-pr.ts`): from a verified read-back record, create
  local branch `db-gate/reconcile-lock-<version>`, append entry to
  `supabase/applied-migrations.lock.json`, validate, commit, print exact
  push/PR commands (D3). No network calls.
- Acceptance: only valid appends are produced; operator actions remain
  documented, not automated.

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
  and baseline-forward reruns against the new high-water, blocking clears.
- Impl (`reconciliation.ts`): derive branch status per D2; expose
  `evaluateReconciliation()` used by pre-live; wire `--lane reconciliation`
  dispatch in `cli.ts`.
- Acceptance: mirrors spec scenarios "Lock and baseline reconciliation
  succeed", "Applied-lock update fails", "Baseline catch-up fails".

**6.9 State-machine and fault-injection tests**

Consolidated matrix (see §5) covering changed content, missing/stale/blanket/
mismatched/non-affirmative permission posture, read-back mismatch, lock
failure, catch-up failure, merge/push failure, and successful recovery —
injected via fake executors, fixture git repos, and mutated evidence files.

## 4. CLI Surface After Phase 6

Unchanged contract: same flags, stdout JSON, exit codes 0/1/2. New optional
inputs consumed only by the two new lanes:

- `--lane pre-live --run-id <id> --subject-commit <sha>`
  `--static-report <path> --dynamic-report <path>`
  `--live-observation <path> [--baseline-state-path <path>]`
- `--lane reconciliation --run-id <id> --subject-commit <sha>`
  `--read-back <path> [--prepare-lock-pr]`
- Baseline maintenance stays `npm run db:quality-gate:baseline`.

## 5. Test Matrix (state machine × fault injection)

| # | Given | When | Then |
| --- | --- | --- | --- |
| 1 | Evidence bound to PR head only | squash-merge landed | INCOMPLETE, rerun required |
| 2 | Digests match landed SHA | inputs unchanged since runs | accepted |
| 3 | Any invalidation key changed | pre-live compares keys | INCOMPLETE, rerun required |
| 4 | Observation stale/malformed | pre-live | INCOMPLETE finding |
| 5 | Live ahead of baseline | pre-live | BLOCKING finding |
| 6 | Full green pre-live | inspect report | nextAction = request permission; no write path exists |
| 7 | Read-back hash mismatch | reconcile | reconciliation-required, later migrations blocked |
| 8 | Lock branch push/merge fails | reconcile | lock branch incomplete, catch-up may proceed independently |
| 9 | Catch-up fails | reconcile | baseline branch incomplete, lock branch independent |
| 10 | Both branches complete + rerun vs new high-water | pre-live next migration | unblocked |
| 11 | Blanket/prior/non-affirmative permission posture | any lane | ignored by design; no permission input exists |

## 6. Verification Order (per AGENTS.md)

1. `node scripts/npm-run.js run format:check` (or rely on Lefthook staged
   Prettier auto-fix)
2. `node scripts/npm-run.js run verify:no-explicit-any`
3. `node scripts/npm-run.js run verify:dedupe`
4. `node scripts/npm-run.js run typecheck`
5. Focused vitest: `database-quality-gate-pre-live*`, `-read-back`,
   `-reconciliation*`, plus regression run of existing gate suites
6. `node scripts/npm-run.js run react-doctor` (repo default diff-only gate)
7. `openspec validate add-database-quality-gate --strict`

Code-deduplication skill review before commit: new modules must not duplicate
hashing/validation logic already in `contract.ts` / `serialization.ts` /
`registries.ts` — import instead of copy.

## 7. Rollout Strategy

- Two focused PRs: Checkpoint A (6.1–6.4 + matrix rows 1–6), Checkpoint B
  (6.5–6.9 + matrix rows 7–11). Each PR updates its `tasks.md` checkboxes
  only after its tests pass.
- No migration SQL, registry content, or live-environment change ships in
  either PR.
- Phase 7 enforcement work starts only after Phase 6 lands.

## 8. Open Questions

None blocking. Implementation-level choices (exact freshness window for
observations, evidence-file location convention outside the repo, wording of
operator-facing next-step output) follow existing conventions in
`baseline-maintenance-cli.ts` and the Oracle runbook and may be tuned during
review without changing this contract.
