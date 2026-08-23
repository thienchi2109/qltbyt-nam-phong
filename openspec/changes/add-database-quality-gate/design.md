# Design: Database Quality Gate

## Context

The repository has a large migration history, known legacy hygiene and security
debt, custom SQL tests with different execution safety, and a private Oracle VM
that hosts the canonical dynamic test environment. The implemented gate must
stay small enough to verify pending migrations without turning historical
reconstruction into a pre-live dependency.

The design must preserve these hard boundaries:

- applied migrations are immutable
- candidate migrations never run directly on the persistent restored baseline
- a gate PASS never authorizes a live write
- live writes require a new, explicit, affirmative maintainer permission for
  the exact target and operation in that rollout session and use Supabase MCP
- unavailable dynamic validation fails closed
- Oracle database and Supabase ports remain loopback-only
- the agent-operated database path never uses Supabase CLI

Live writes include migration apply; data mutation; DDL or DCL; grant, policy,
function, trigger, schema, extension, or migration-metadata changes; and
state-changing RPC or function calls. Silence, stale or prior permission,
blanket or standing authorization, merge, PASS, approval, waiver, and scheduled
execution are never permission for a live write.

The source decision is Wayfinder #936. Decisions #932, #933, #938, #934, and
#935 own the detailed rationale for execution topology, immutability, baseline
synchronization, severity, waivers, schema security, invariants, and SQL-test
classification.

## Goals / Non-Goals

### Goals

- Provide one runner-neutral contract for static, baseline-forward, pre-live,
  and reconciliation lanes.
- Produce deterministic, queryable evidence with stable finding identities and
  fail-closed outcomes.
- Protect legacy and future applied migration history without rewriting old
  migrations or guessing a one-to-one mapping to live migration records.
- Validate pending migrations on disposable Oracle databases.
- Compare portable application structure, access/security state, and
  environment compatibility as separate layers.
- Run only explicitly classified safe SQL tests in the default lane.
- Make the exact landed-commit PASS-before-permission rule enforceable.
- Keep Phase 1 reviewable as ordered implementation slices.

### Non-Goals

- Provisioning a Phase 2 self-hosted GitHub runner.
- Applying any migration or authorizing any live write.
- Editing, renaming, deleting, repairing, or rewriting applied migrations or
  live migration metadata.
- Remediating all historical migration, advisor, grant, RLS, index, or
  performance debt.
- Converting all SQL tests to pgTAP.
- Running performance, concurrency, opt-in, or live-only tests in the default
  lane.
- Defining application deployment ordering.
- Creating a production-data freshness service or replacing backup and recovery
  ownership.

## Decisions

### 1. Use one runner-neutral gate contract with explicit lanes

The implementation exposes one gate contract with these lanes:

| Lane               | Purpose                                                                            | Required execution                        |
| ------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------- |
| `static`           | Inspect changed migration source and committed registries                          | Local, hooks, and secret-free PR CI       |
| `baseline-forward` | Apply the ordered pending set to a disposable clone of `qltbyt_test`               | Every migration-related diff              |
| `pre-live`         | Confirm exact-commit evidence and compare live migration state read-only           | Before requesting live permission         |
| `reconciliation`   | Verify read-back, applied lock, restored baseline catch-up, and rerun requirements | After an explicitly authorized live apply |

Each lane emits the same report schema and finding model. The blocking pre-live
aggregate is PASS only when `static` and `baseline-forward` both PASS for the
same exact landed commit and no unresolved DANGEROUS or BLOCKING finding
remains.

Alternatives considered:

- Separate static and dynamic capabilities: rejected because they would
  duplicate evidence, severity, and authorization contracts.
- A single opaque command with no lane identity: rejected because operators and
  CI need to distinguish completed evidence from unavailable evidence.

### 2. Separate finding classification from aggregate outcome

Findings use `WARNING`, `DANGEROUS`, or `BLOCKING`. Gate outcomes use `PASS`,
`FAILED`, or `INCOMPLETE`.

| Outcome      | Exit code | Meaning                                                                                  |
| ------------ | --------: | ---------------------------------------------------------------------------------------- |
| `PASS`       |         0 | Every required check completed and no unresolved DANGEROUS or BLOCKING finding remains   |
| `FAILED`     |         1 | A deterministic rule, execution, integrity, approval, or mandatory-security check failed |
| `INCOMPLETE` |         2 | Required execution or trustworthy evidence was unavailable or interrupted                |

The deterministic JSON report includes at least:

- schema version and immutable run ID
- lane and outcome
- subject commit and migration identities
- finding `ruleId`, classification, fingerprint, and approval or waiver identity
- relevant lock and registry hashes
- baseline migration high-water input
- executor environment fingerprint
- report digest and timestamps

Markdown is a human-readable rendering of the JSON report, not a second source
of truth.

### 3. Protect applied history with a cutover and append-only lock

The committed applied lock records the exact protected `main` cutover. Root
migration paths and canonical contents present at that cutover are immutable.
The gate verifies the cutover ancestry and protected-ref relationship without
requiring a schema dump or historical version-to-file mapping.

Future applied migrations are appended to
`supabase/applied-migrations.lock.json` only after live read-back verifies the
canonical SQL hash. Existing lock history is append-only. Mutation of a legacy
path, an applied record, or lock history is BLOCKING and non-waivable.

Only post-cutover files absent from both the legacy baseline and future applied
records are pending and editable.

Canonical hashing removes only one optional terminal newline before SHA-256.
Broader text or SQL-semantic normalization is not allowed because it can hide
real edits.

### 4. Use identity-based baselines and exact-bound approvals

Historical migration hygiene and advisor debt is pinned to explicit identity
baselines. A count-only baseline is not accepted because one old finding could
disappear while an unrelated regression replaces it.

The waiver registry is deterministic committed JSON. WARNING does not need a
waiver. DANGEROUS requires exact-bound risk approval. BLOCKING and INCOMPLETE
cannot be waived.

To avoid a self-referential approval commit:

1. a candidate run emits a finding fingerprint, migration content hash, and
   candidate commit
2. the committed approval references that candidate evidence
3. the final run on the approval-bearing commit emits the exact gate commit
   PASS

Changes to the migration, finding identity, harness, lock, registries, baseline
high-water input, or environment fingerprint invalidate reusable evidence.

### 5. Keep expected state in three fingerprint layers and two registries

The gate compares:

1. a portable application fingerprint for logical application-owned structure
2. an access fingerprint for ownership, grants, RLS, policies, and routine
   security properties
3. an environment fingerprint for PostgreSQL, Supabase, and extension
   compatibility

Raw dumps are diagnostic evidence only.

`supabase/db-quality-gate-invariants.json` stores semantic expectations that
cannot be inferred safely from structural replay. Every application-owned table
must have one intended class:

- `app-facing`
- `rpc-only`
- `server-only`
- `intentionally-public`

Each classification records its owner, allowed operations, enforcement
contract, and evidence. Unknown or disputed intent is INCOMPLETE and creates a
focused Wayfinder decision. Existing unchanged mismatches may remain baseline
debt; new tables or widened access must satisfy intended state immediately.

`supabase/db-quality-gate-tests.json` records each selected SQL test's purpose,
safety, runner requirements, transaction contract, fixture contract, timeout,
and evidence. The default lane runs mandatory catalog checks plus only
`default-safe` tests. Filename conventions alone never grant execution safety.

### 6. Run dynamic validation only on disposable Oracle clones

The Oracle VM is the canonical dynamic executor.

Baseline-forward validation:

1. acquires mutual exclusion against clone, catch-up, and refresh operations
2. clones the persistent restored baseline into a per-run database
3. applies only the ordered pending migration set
4. runs required catalog and registry-selected default-safe checks
5. records evidence
6. drops the per-run database on success or failure

Full migration-history reconstruction is a separate maintenance concern. It is
not an executable gate lane, is not required for pre-live PASS, and must be
specified separately before any implementation or scheduling work. Historical
migrations are never edited to manufacture replayability.

### 7. Make Oracle evidence authoritative and GitHub an audit pointer

The full deterministic JSON report is stored on Oracle under an immutable run
ID. GitHub records the outcome, subject commit, migration hashes, report digest,
Oracle evidence ID, and approval links.

Evidence is reusable only when:

- the full report remains readable
- its digest matches
- the subject commit and all invalidation keys match
- the required baseline and environment inputs remain valid

If Oracle evidence is unavailable, a GitHub summary cannot substitute for it.
The result is INCOMPLETE.

### 8. Require the landed commit before live permission

The repository normally squash-merges, so a PR-head PASS does not prove the
landed commit.

The promotion sequence is:

1. merge the reviewed migration through protected `main`
2. run the complete required gate on the landed SHA
3. run read-only pre-live migration and baseline comparisons
4. request explicit permission for the exact live apply
5. if approved, apply only through Supabase MCP
6. read back and verify the live migration record and canonical SQL hash

The gate cannot apply live, request blanket permission, or treat silence, prior
permission, merge, approval, waiver, PASS, or scheduled execution as live
authorization. Permission must be newly and affirmatively granted by the
maintainer for the exact live target and operation in the current rollout
session.

### 9. Model post-apply work as two mandatory reconciliation branches

After successful live read-back:

- the applied migration is appended through a lock-only PR that must merge and
  push
- the confirmed-live migration is caught up to `qltbyt_test`, baseline health is
  verified, and baseline-forward validation reruns against the new high-water

These branches are independent because applied history must still be recorded
when baseline catch-up fails, and baseline health must still recover when a Git
operation fails.

No later live migration may proceed until both branches complete. A live apply
is not rolled back solely because reconciliation failed.

### 10. Enforce migration static checks locally

Phase 7 adds:

- focused tests and one package command
- migration-aware Lefthook checks at post-commit and pre-push
- concise `PASS`, `FAILED`, `INCOMPLETE`, or `SKIP` output
- operator guidance that keeps Oracle baseline-forward manual

The local wrapper reuses the existing changed-file collector and static-lane
command. GitHub Actions, protected-branch rulesets, break-glass procedures, and
self-hosted runners are outside this change.

Manual Oracle dynamic evidence remains mandatory before live permission.
Protected-Git-dependent pre-live and reconciliation paths remain fail-closed
and dormant while no protected-main trust anchor is configured.

## Risks / Trade-offs

- **Historical reconstruction remains unresolved:** the current history has not
  been proven replayable from a clean database.
  - Mitigation: keep reconstruction outside the blocking gate and require a
    separate design before implementing it.
- **Oracle becomes an evidence dependency:** an unavailable VM makes reusable
  dynamic evidence unavailable.
  - Mitigation: return INCOMPLETE and block live permission rather than trusting
    summaries or stale reports.
- **Dynamic runs consume Oracle resources:** cloning and migration execution can
  compete with the restored baseline stack.
  - Mitigation: use mutual exclusion, resource limits, disk checks, per-run
    databases, and guaranteed cleanup.
- **Git and baseline reconciliation can diverge after live apply:** one branch
  may succeed while the other fails.
  - Mitigation: track both postconditions independently and block every later
    apply until both recover.
- **Security intent may be unknown for historical tables:** current ACL/RLS
  state is not proof of intended access.
  - Mitigation: mark unknown intent INCOMPLETE and require evidence or a focused
    Wayfinder decision.
- **Branch protection can impede emergency recovery:** strict rules may delay a
  necessary lock-only reconciliation.
  - Mitigation: define a narrow, auditable break-glass path without allowing
    force-push, history rewrite, or silent check bypass.

## Migration and Rollout

1. Implement contract tests and deterministic report and registry schemas.
2. Implement static and applied-history validation.
3. Bootstrap reviewed security, invariant, waiver, and SQL-test registries.
4. Implement disposable Oracle execution and fault-injection coverage.
5. Implement baseline health, catch-up, evidence, and reconciliation state.
6. Add and verify the migration-aware local Lefthook command.
7. Keep baseline-forward and pre-live execution on the documented manual Oracle
   path.
8. Verify the committed legacy cutover and append-only lock without changing
   migration SQL.
9. Run static and baseline-forward on the exact landed commit before any
   separately authorized live apply and retain digest-bearing Oracle evidence.

No rollout step applies a migration to live. A future migration still follows
the exact permission and reconciliation lifecycle.

## Verification Strategy

- Unit tests cover canonical hashing, deterministic reports, registries,
  finding identity, approval and waiver invalidation, and exit codes.
- Fixture repositories cover legacy mutation, lock tampering, migration source
  ordering, multiple pending migrations, and no-new-regressions behavior.
- Disposable database tests cover successful and failed migration execution,
  selected SQL tests, fingerprint layers, and cleanup.
- Fault-injection tests cover unavailable SSH/PostgreSQL, stale or missing
  evidence, interrupted migration execution or catch-up, high-water mismatch,
  failed read-back, lock failure, and baseline recovery.
- State-machine tests prove that PASS never grants live permission and no later
  apply can proceed before reconciliation completes.
- Local-hook tests prove that relevant diffs run the static lane, unrelated
  diffs skip it, failures propagate, and no GitHub runner is provisioned.

## Open Questions

None block implementation. Internal module names, the optional SQL parser, and
the exact Oracle evidence directory layout and retention period remain
implementation-level choices that must preserve this contract.
