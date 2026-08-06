# P15A2 Dossier Delete Audit Design

## Context

P15A deployed `technical_configuration_dossiers_delete(UUID, BIGINT)` as a
dormant, authenticated-only RPC. It serializes through the dossier row, rejects
archived, stale, and historically locked dossiers, and deletes only the dossier
aggregate root. P15C would make that permanent delete reachable through the
application proxy and UI.

P15A intentionally deferred audit logging while the RPC was dormant. P15C must
remain blocked until the delete records durable audit evidence.

## Decision

Add one DB-only P15A2 leaf tracked by Issue #869. It replaces only
`technical_configuration_dossiers_delete(UUID, BIGINT)` and preserves the P15A
signature, response, lock order, eligibility errors, grants, and cascade
behavior.

After the editable-dossier guard and locked-history check succeed, the function
reads the locked dossier root metadata and calls `public.audit_log()` before the
root delete. The audit call is fail-closed: any result distinct from `TRUE`
raises the fixed `PT500/audit_log_failed` exception, so PostgreSQL rolls back
both the audit attempt and the delete transaction.

## Audit Event

- `action_type`: `technical_configuration_dossier_delete`
- `entity_type`: `technical_configuration_dossier`
- `entity_id`: `NULL`
- `entity_label`: dossier name
- `action_details`:
  - `dossier_id`
  - `device_type_name`
  - `name`
  - `description`
  - `revision`
  - `delete_kind: "hard"`

The shared audit schema stores `entity_id` as `BIGINT`, while dossiers use UUID.
P15A2 will not widen the shared audit schema or helper. The UUID is retained as
forensic identity in `action_details` and must be verified with
`action_details->>'dossier_id' = <uuid>::text`; it is not a first-class indexed
entity lookup. The dossier name remains in `entity_label`. Existing audit
retention remains 365 days rather than permanent retention.

## Transaction And Concurrency

The existing editable-dossier guard continues to acquire the dossier row lock
first. P15A2 does not add a competing lock order. The root snapshot, audit call,
and delete all execute while that lock is held.

The audit row is inserted before the root delete and has no foreign key to the
dossier, so it survives the aggregate cascade. Any audit failure aborts before
the delete statement.

The existing two-session concurrency gate remains authoritative for lock order.
P15A2 updates it to require exactly one token-matched delete audit for the
delete-first winner, zero for the lock-first loser, and zero dossier/audit
residue after cleanup.

## Verification

Source tests must prove:

- the P15A2 migration sorts after every local predecessor that defines the
  delete RPC, its guards, or
  `public.audit_log(TEXT, TEXT, BIGINT, TEXT, JSONB)`;
- the P15A signature, security boundary, grants, response, and guard ordering
  remain unchanged;
- the root snapshot and fail-closed audit call occur after eligibility checks
  and before the root delete;
- the UUID and root metadata are stored in `action_details`;
- the rollback-only success gate verifies the complete audit payload without
  replacing shared functions;
- a separate isolated rollback-only gate forces audit failure with no data loss
  or audit residue;
- the updated two-session gate preserves both winner orderings and accounts for
  committed audit rows.

The success gate contains no shared-function DDL and still requires separate
live DB write authorization. The forced-failure gate transactionally replaces
the exact `public.audit_log` overload and is forbidden on live DB. It may run
only in an isolated database. After a separately authorized live migration
apply, live verification is limited to the success-path audit gate and updated
two-session concurrency gate.
Any future forced-failure live proof requires separate approval, a maintenance
window, short lock timeout, exact helper-definition precondition, immediate
rollback, and post-rollback definition/ACL verification. P15A2 adds no
production test branch or GUC bypass. No live DB write is authorized by this
design approval.

## Scope Boundary

P15A2 does not change the audit table/helper signature, add an audit UUID
column, expose the delete RPC through the proxy, or add TypeScript/React UI.
P15C remains blocked until P15A2 is merged, applied, and both the success-path
audit gate and updated concurrency gate pass on live after separate approvals.
