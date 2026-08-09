# P2B TDD Plan - Atomic Hierarchical Import Apply

## Goal

Implement Issue #882 / Phase P2B as one deploy-safe leaf:

- reconcile the complete hierarchy atomically;
- preserve compatible row identity and criterion codes;
- keep legacy import apply unchanged and available;
- expose a stable public v2 apply seam that remains not activated until P6A;
- avoid UI, workbook, reader, and later-leaf activation work.

## Preflight

Local repository:

- branch baseline: clean `main` at `fe63808ff14ca54815e5319671008ba07ff23917`;
- implementation branch: `feat/882-p2b-atomic-hierarchy-import-apply`;
- latest local P2A migration:
  `20260809001300_technical_configuration_baseline_hierarchy_import_preview.sql`.

Read-only live Supabase:

- migration tail: `20260809015144`;
- P2A metadata, validator, preview, P1E mutation helpers, and legacy import body hashes
  match local;
- function signatures, `SECURITY DEFINER`, volatility, `search_path`, and grants match;
- subgroup schema, composite constraints, and indexes match local;
- counts remain 3 baseline versions, 12 groups, 0 subgroups, 155 direct criteria,
  and 0 subgroup criteria.

Any mismatch in those contracts is a stop condition. No live write is authorized in P2B.

## Scope Decisions

### Internal capability

Add `_technical_configuration_baseline_import_apply_v2(...)` as the complete atomic
write capability.

It must:

1. acquire the existing editable-version/revision lock;
2. call the P2A validator again under that lock;
3. reject row errors before mutation;
4. resolve stable and generated group/subgroup identities;
5. update and create groups;
6. update and create subgroups;
7. move/update and create criteria;
8. delete omitted criteria, subgroups, and groups in dependency-safe order;
9. advance `next_criterion_number` only by the count of created criteria;
10. increment revision exactly once;
11. return the resulting hierarchy snapshot plus the exact validation preview.

The function is `SECURITY DEFINER`, pins `search_path = public, pg_temp`, and is
revoked from `public`, `anon`, `authenticated`, and `service_role`.

### Guarded public seam

Add `technical_configuration_baseline_import_apply_v2(...)` to the shared RPC
registry/allowlist, but keep it fail-closed with:

```text
SQLSTATE: PT409
message: hierarchical_import_apply_not_activated
```

The wrapper must not call the internal capability before P6A. The current production
hook remains on `technical_configuration_baseline_import_apply`.

### Legacy contract

Do not redefine:

- `technical_configuration_baseline_import_preview`;
- `technical_configuration_baseline_import_apply`.

Lock their local/live body hashes in focused and SQL security tests.

## TDD Evidence

RED:

```text
technical-configuration-baseline-hierarchy-apply-migration.test.ts
9 tests failed because the P2B migration and phase gates did not exist.
```

GREEN after the minimum phase-scoped implementation:

```text
technical-configuration-baseline-hierarchy-apply-migration.test.ts
9 tests passed.
```

The focused test locks:

- migration order and function signatures;
- lock-before-validation-before-mutation order;
- dependency-safe reconciliation order;
- ID/code/counter/revision invariants;
- preview/apply parity;
- activation guard and ACLs;
- legacy hashes and production-hook non-activation;
- rollback-only functional/security phase-gate coverage;
- the 450-line artifact ceiling.

## Rollback-Only SQL Gates

`technical_configuration_baseline_hierarchy_import_apply_phase_gate.sql` covers:

- complete create/update/move/delete/reorder reconciliation;
- preview/apply parity;
- stable criterion IDs/codes;
- sequential new codes and counter movement;
- one revision increment;
- authoritative empty-tree replacement;
- stale revision, tampered identity, validation error, and injected late-failure rollback.

`technical_configuration_baseline_hierarchy_import_apply_security_phase_gate.sql`
covers:

- stable public not-activated error;
- legacy/public/internal privilege contracts;
- legacy function body hashes.

Both gates use `BEGIN`/`ROLLBACK`. They are committed for a separately authorized
post-migration run and are not executed against live Supabase in this phase.

## Verification

Required before handoff:

1. focused P2B migration test;
2. legacy import, P2A preview, hierarchy mutation, registry/whitelist, and baseline
   contract regressions;
3. full technical-configuration tests;
4. full SQL/RPC migration tests;
5. format, no-explicit-any, dedupe, typecheck, and React Doctor;
6. OpenSpec strict validation;
7. Code Review Graph and GitNexus change review;
8. independent subagent review to zero findings;
9. branch commit and push without opening a PR.

## Completion Boundary

P2B is ready for the user's next-step decision only when all local gates pass, the
independent review has zero findings, the branch is pushed, legacy behavior is still
locked, and live Supabase remains unchanged.
