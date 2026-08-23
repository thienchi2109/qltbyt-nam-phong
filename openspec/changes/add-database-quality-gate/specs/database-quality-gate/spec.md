## ADDED Requirements

### Requirement: Deterministic gate result contract

The system SHALL separate finding classification from aggregate gate outcome,
SHALL emit deterministic machine-readable evidence, and SHALL return exit code
`0` for PASS, `1` for FAILED, and `2` for INCOMPLETE.

#### Scenario: Completed checks have no unresolved blocking finding

- **GIVEN** every required lane completed with trustworthy evidence
- **AND** no unresolved DANGEROUS or BLOCKING finding remains
- **WHEN** the gate aggregates the results
- **THEN** the outcome is PASS
- **AND** the process exits with code `0`

#### Scenario: A deterministic mandatory rule fails

- **GIVEN** a required integrity, execution, approval, or security rule fails
  deterministically
- **WHEN** the gate aggregates the results
- **THEN** the outcome is FAILED
- **AND** the process exits with code `1`

#### Scenario: Required evidence is unavailable

- **GIVEN** a required executor, report, baseline input, or trustworthy result is
  unavailable or interrupted
- **WHEN** the gate aggregates the results
- **THEN** the outcome is INCOMPLETE
- **AND** the process exits with code `2`
- **AND** the result cannot be waived

#### Scenario: Warning does not hide successful completion

- **GIVEN** every required check completes
- **AND** only WARNING findings remain
- **WHEN** the gate aggregates the results
- **THEN** the outcome is PASS
- **AND** every warning remains visible in evidence

### Requirement: Stable finding identity and report evidence

The system SHALL identify each finding with a stable rule and fingerprint and
SHALL bind every report to the subject commit, migration content, gate inputs,
baseline state, and executor environment.

#### Scenario: Equivalent finding is compared across runs

- **GIVEN** the same rule, object or statement scope, and canonical content
  produce a finding in two runs
- **WHEN** the gate compares the runs
- **THEN** both findings have the same `findingFingerprint`
- **AND** identity-based baseline comparison can distinguish old debt from a new
  regression

#### Scenario: Relevant input changes after PASS

- **GIVEN** a PASS report exists
- **WHEN** the migration, finding identity, harness, applied lock, waiver
  registry, invariant registry, test registry, baseline high-water, or executor
  environment changes
- **THEN** the prior report is invalid for the changed invocation
- **AND** the required lane must run again

### Requirement: Applied migration immutability

The system SHALL protect legacy migration paths and canonical contents from an
exact Git cutover and SHALL maintain future applied migrations in an append-only
lock.

#### Scenario: Legacy migration is changed

- **GIVEN** a migration path existed at the protected legacy cutover
- **WHEN** its path or canonical content is modified, renamed, or deleted
- **THEN** the gate emits a non-waivable BLOCKING finding
- **AND** the aggregate outcome is FAILED

#### Scenario: Pending migration is edited

- **GIVEN** a post-cutover migration is absent from the legacy baseline and
  applied lock
- **WHEN** its content changes before live apply
- **THEN** it remains pending and editable
- **AND** any evidence bound to its prior content is invalidated

#### Scenario: Applied lock history is rewritten

- **GIVEN** an applied migration record already exists in the committed lock
- **WHEN** that record is changed, removed, reordered, or replaced
- **THEN** the gate emits a non-waivable BLOCKING finding

### Requirement: Canonical migration source and static validation

The system SHALL use a deterministic canonical root migration source and SHALL
run diff-aware static checks for every migration-related change.

#### Scenario: Migration source membership is ambiguous

- **GIVEN** a SQL path cannot be classified deterministically as canonical
  migration source or excluded support history
- **WHEN** source inventory runs
- **THEN** the result is INCOMPLETE
- **AND** dynamic replay does not guess an order or execute the ambiguous file

#### Scenario: Migration diff violates a mandatory repository rule

- **GIVEN** a changed migration violates applied-history, source-order,
  mandatory security, or integrity policy
- **WHEN** the static lane runs
- **THEN** it emits a BLOCKING finding
- **AND** the result is FAILED

#### Scenario: Migration contains reviewable dangerous SQL

- **GIVEN** a changed migration contains potentially destructive,
  lock-sensitive, irreversible, broad data-changing, or privilege-expanding SQL
- **WHEN** the static lane runs
- **THEN** it emits an explanatory DANGEROUS finding
- **AND** syntax alone does not convert the finding to BLOCKING

### Requirement: Exact-bound DANGEROUS approval

The system SHALL require a committed, reviewable, content-bound risk approval
for every DANGEROUS finding and SHALL preserve the finding's classification
after approval.

#### Scenario: Dangerous finding has no valid approval

- **GIVEN** a DANGEROUS finding exists
- **AND** no exact, current approval matches its fingerprint, migration content,
  and candidate evidence
- **WHEN** the gate aggregates results
- **THEN** the outcome is FAILED
- **AND** the process exits with code `1`

#### Scenario: Approval-bearing commit is verified

- **GIVEN** a candidate run produced stable finding and migration evidence
- **AND** a committed approval references that evidence
- **WHEN** the final gate runs on the approval-bearing commit
- **THEN** the DANGEROUS finding remains classified as DANGEROUS
- **AND** it may be accepted for aggregate PASS
- **AND** the final PASS is bound to the approval-bearing commit

#### Scenario: Approved migration content changes

- **GIVEN** a valid risk approval exists
- **WHEN** the approved migration content changes
- **THEN** the approval is invalid
- **AND** the changed migration requires new candidate evidence and review

### Requirement: Baseline-forward validation

The system SHALL apply the ordered pending migration set only to a disposable
clone of the restored Oracle baseline for every migration-related diff.

#### Scenario: Pending migrations validate successfully

- **GIVEN** the restored baseline is healthy
- **AND** an ordered pending migration set exists
- **WHEN** baseline-forward validation runs
- **THEN** the system clones `qltbyt_test` into a per-run database
- **AND** applies only the pending set
- **AND** runs mandatory catalog and selected default-safe checks
- **AND** records evidence
- **AND** drops the per-run database

#### Scenario: Candidate migration fails

- **GIVEN** baseline-forward validation is running on a disposable clone
- **WHEN** a candidate migration or mandatory check fails
- **THEN** the result is FAILED
- **AND** the persistent `qltbyt_test` baseline is unchanged
- **AND** the per-run database is cleaned up

#### Scenario: Oracle executor is unavailable

- **GIVEN** baseline-forward validation is required
- **WHEN** the Oracle executor or required database evidence is unavailable
- **THEN** the result is INCOMPLETE
- **AND** the migration cannot be declared complete or promoted for live
  permission

### Requirement: Layered expected-state validation

The system SHALL compare portable application structure, access/security state,
and environment compatibility as separate deterministic fingerprint layers.

#### Scenario: Raw physical differences are non-portable

- **GIVEN** logical application structure is equivalent
- **AND** physical column order, owner restoration, ACL restoration, or
  extension-owned objects differ by environment
- **WHEN** expected-state comparison runs
- **THEN** those facts are evaluated in their designated access or environment
  layer
- **AND** they do not create a false portable-application mismatch

#### Scenario: Required fingerprint cannot be collected

- **GIVEN** a mandatory fingerprint layer is required
- **WHEN** trustworthy catalog evidence cannot be collected
- **THEN** the result is INCOMPLETE
- **AND** the missing layer is identified in the report

### Requirement: Explicit table security intent

The system SHALL enforce each approved table-security contract and SHALL keep
explicit unresolved historical table intent visible as non-blocking registry
debt until a focused decision records an approved contract.

#### Scenario: Historical table intent is unknown

- **GIVEN** an application-owned table lacks sufficient evidence for its
  intended access contract
- **WHEN** security registry validation runs
- **THEN** the registry records that table explicitly as unresolved debt
- **AND** no access contract is inferred or enforced for that table
- **AND** the unresolved historical entry does not block an unrelated migration
- **AND** a focused Wayfinder decision is required
- **AND** current ACL or RLS state is not treated as intended policy

#### Scenario: Existing unchanged mismatch remains baseline debt

- **GIVEN** an approved intended contract exists
- **AND** an unchanged historical mismatch is identity-baselined
- **WHEN** an unrelated migration is validated
- **THEN** the historical mismatch remains visible
- **AND** it does not become an unrelated new regression

#### Scenario: Historical routine search-path debt remains unchanged

- **GIVEN** the restored Oracle baseline contains an existing unsafe
  `SECURITY DEFINER` routine search path
- **WHEN** baseline-forward compares the restored baseline with its disposable
  post-migration clone
- **THEN** the unchanged finding remains visible as historical debt
- **AND** it does not block the candidate
- **BUT** a new routine or changed unsafe search path remains BLOCKING

#### Scenario: New table widens exposure

- **GIVEN** a new table or changed access contract exposes additional direct
  operations
- **WHEN** it fails the approved intended security contract
- **THEN** the gate emits a BLOCKING finding
- **AND** the result is FAILED

### Requirement: Registry-selected SQL-test execution

The system SHALL execute only SQL tests whose committed metadata permits the
requested lane and SHALL keep purpose separate from execution safety.

#### Scenario: Default-safe test is selected

- **GIVEN** a SQL test is classified `default-safe`
- **AND** its runner, transaction, fixture, timeout, and cleanup contracts are
  satisfied
- **WHEN** the default dynamic lane runs
- **THEN** the test may execute on the disposable database
- **AND** its result is included in gate evidence

#### Scenario: Special test is present

- **GIVEN** a SQL test is classified opt-in, performance, concurrency, or
  live-only
- **WHEN** the default lane selects tests
- **THEN** the test is excluded
- **AND** its filename alone cannot override its safety classification

### Requirement: Authoritative Oracle evidence

The system SHALL store the full deterministic report on Oracle under an
immutable run ID and SHALL use GitHub only as an audit pointer.

#### Scenario: Exact report is reusable

- **GIVEN** a prior exact-commit report exists on Oracle
- **AND** its digest and every invalidation key still match
- **WHEN** pre-live review evaluates reuse
- **THEN** the report may satisfy the corresponding required lane

#### Scenario: GitHub summary exists without the full report

- **GIVEN** GitHub contains a report summary and digest
- **BUT** the full Oracle report cannot be read or verified
- **WHEN** pre-live review evaluates the evidence
- **THEN** the result is INCOMPLETE
- **AND** the GitHub summary cannot substitute for machine evidence

### Requirement: Local migration gate trigger

The system SHALL run local static validation when a repository diff changes a
canonical migration or committed DB Quality Gate registry.

#### Scenario: Unrelated local change

- **GIVEN** the repository diff changes no canonical migration or gate registry
- **WHEN** the local migration gate runs
- **THEN** it exits successfully with `SKIP`
- **AND** it does not execute the static lane

#### Scenario: Migration or gate registry changes

- **GIVEN** the repository diff changes a canonical migration, applied lock,
  baseline, waiver, invariant, or SQL-test registry
- **WHEN** Lefthook runs after commit or before push
- **THEN** the existing static lane executes
- **AND** its `PASS`, `FAILED`, or `INCOMPLETE` result controls the hook exit
  code
- **AND** pre-push blocks publication when the result is not `PASS`

#### Scenario: Local trigger cannot be evaluated

- **GIVEN** changed-file discovery, report parsing, or outcome validation fails
- **WHEN** the local migration gate runs
- **THEN** it reports `INCOMPLETE`
- **AND** it exits with code `2`

### Requirement: Exact landed-commit pre-live boundary

The system SHALL require complete valid evidence for the landed `main` commit
before requesting permission for a live apply.

Live-write permission SHALL be a new, explicit, affirmative maintainer
authorization in the current rollout session, bound to the exact live target
and operation. A live write includes migration apply, data mutation, DDL/DCL,
grants, policies, functions, triggers, schemas, extensions, migration metadata,
and state-changing RPC or function calls. Silence, prior or blanket permission,
PASS, merge, approval, waiver, or scheduled execution SHALL NOT substitute.

#### Scenario: Only PR-head evidence exists after squash merge

- **GIVEN** a migration PR was squash-merged
- **AND** the available PASS is bound only to the pre-merge PR head
- **WHEN** pre-live review runs
- **THEN** the evidence is insufficient for the landed commit
- **AND** the required gate must run on the landed SHA

#### Scenario: Landed commit is ready for permission request

- **GIVEN** static and baseline-forward both passed for the landed SHA
- **AND** read-only live and baseline comparisons are healthy
- **WHEN** pre-live review completes
- **THEN** the operator may request explicit permission for the exact live apply
- **AND** no live write occurs automatically

#### Scenario: Gate passes without live permission

- **GIVEN** the gate outcome is PASS
- **WHEN** permission is absent, stale, blanket, non-affirmative, or bound to a
  different target or operation
- **THEN** the migration is not applied to live
- **AND** Supabase MCP is not invoked for a write

### Requirement: Verified live read-back

The system SHALL trust a live apply only after read-only evidence confirms the
new live migration record and canonical SQL hash.

#### Scenario: Read-back matches reviewed migration

- **GIVEN** the maintainer explicitly authorized the exact live apply
- **AND** the migration was applied through Supabase MCP
- **WHEN** read-back returns the new live record
- **THEN** its canonical SQL hash matches the reviewed local migration
- **AND** reconciliation may begin

#### Scenario: Read-back is missing or mismatched

- **GIVEN** a live apply may have succeeded
- **WHEN** read-back is unavailable or the canonical SQL hash differs
- **THEN** the system enters reconciliation-required state
- **AND** no later live migration may proceed
- **AND** applied SQL or live migration metadata is not edited

### Requirement: Independent post-apply reconciliation

The system SHALL require both applied-lock reconciliation and restored-baseline
reconciliation after verified live read-back.

#### Scenario: Lock and baseline reconciliation succeed

- **GIVEN** live read-back verified the applied migration
- **WHEN** the lock-only PR is merged and pushed
- **AND** `qltbyt_test` catches up to the confirmed-live high-water
- **AND** baseline health checks pass
- **AND** baseline-forward reruns against the new high-water
- **THEN** reconciliation is complete
- **AND** a later migration may enter pre-live review

#### Scenario: Applied-lock update fails

- **GIVEN** live read-back succeeded
- **WHEN** the lock-only branch, PR, merge, or push fails
- **THEN** applied history remains reconciliation-required
- **AND** Oracle catch-up may still proceed independently
- **AND** no later live migration may proceed

#### Scenario: Baseline catch-up fails

- **GIVEN** live read-back succeeded
- **WHEN** Oracle catch-up or baseline health verification fails
- **THEN** baseline reconciliation remains incomplete
- **AND** the applied-lock record may still be reconciled independently
- **AND** no later live migration may proceed

### Requirement: Local static enforcement and manual dynamic boundary

The system SHALL enforce static validation locally without provisioning GitHub
workflows, branch rulesets, or a self-hosted runner.

#### Scenario: Static validation completes locally

- **GIVEN** a relevant local diff
- **WHEN** the static lane completes
- **THEN** the hook prints a concise outcome, digest, and finding counts
- **AND** it does not print individual historical finding records
- **AND** it requires no Oracle or live database credential

#### Scenario: Dynamic validation is required

- **GIVEN** baseline-forward or pre-live evidence is required
- **WHEN** the dynamic lane runs
- **THEN** it executes through the approved Oracle/manual path
- **AND** inability to run is INCOMPLETE
- **AND** local static success does not imply dynamic PASS

#### Scenario: GitHub enforcement is requested

- **GIVEN** a GitHub workflow, protected-branch ruleset, or runner integration is
  proposed
- **WHEN** the current change boundary is evaluated
- **THEN** it is excluded
- **AND** a separate reviewed proposal is required
