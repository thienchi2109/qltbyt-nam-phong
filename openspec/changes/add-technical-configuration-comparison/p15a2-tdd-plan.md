# P15A2 TDD Plan - Dossier Delete Audit Hardening

> **For agentic workers:** Execute test-first with
> `supabase-postgres-best-practices`, `superpowers:test-driven-development` and
> `karpathy-coding-heuristics`. Use Supabase MCP for every live DB operation. Do
> not run the forced-failure gate on live DB.

## Goal

Add fail-closed audit evidence to the dormant P15A dossier hard-delete without
changing its signature, authorization, lock order, eligibility errors, response
or proxy exposure.

**Tracking issue:** [#869](https://github.com/thienchi2109/qltbyt-nam-phong/issues/869)

## Hard Entry Gate

- P15A is merged, applied and its authorization/cascade plus two-session gates
  are green.
- Live read-only inspection confirms the exact delete signature, grants,
  `SECURITY DEFINER`, `search_path`, editable guard and locked-history order.
- Live read-only inspection confirms the exact
  `public.audit_log(TEXT, TEXT, BIGINT, TEXT, JSONB)` helper and 365-day audit
  retention.
- The local migration timestamp sorts after every delete/guard/baseline-lock
  predecessor and every migration that defines the exact audit helper overload.
- If any evidence differs, stop and repair that prerequisite in its own leaf.

## Pre-Implementation Discovery

- [ ] Recall AgentMemory for prior P15A/P15B decisions.
- [ ] Use Code Review Graph minimal context before broad source reading.
- [ ] Use GitNexus impact analysis after narrowing indexed symbols, then
      backstop SQL relationships with exact search and live Supabase MCP
      read-only inspection.

## Frozen Audit Contract

- Keep `technical_configuration_dossiers_delete(UUID, BIGINT) -> JSONB`.
- Preserve `{ "data": { "id": <uuid> } }`, P15A errors and authenticated-only
  execution.
- After editable and locked-history guards, snapshot the locked dossier root.
- Call `public.audit_log()` before the root `DELETE`.
- Use:
  - `action_type = technical_configuration_dossier_delete`
  - `entity_type = technical_configuration_dossier`
  - `entity_id = NULL`
  - `entity_label = dossier name`
  - `action_details = dossier_id, device_type_name, name, description, revision,
delete_kind: "hard"`
- Treat the UUID as forensic JSONB identity, verified with
  `action_details->>'dossier_id' = <uuid>::text`; do not claim indexed entity
  lookup.
- Fail closed with `IF v_audit_ok IS DISTINCT FROM TRUE` and exact
  `PT500/audit_log_failed`.
- Keep the existing 365-day audit retention unchanged.

## Planned Files

- Create:
  `src/app/api/rpc/__tests__/technical-configuration-dossier-delete-audit-migration.test.ts`
- Create:
  `supabase/migrations/20260806031201_technical_configuration_dossier_delete_audit.sql`
- Create:
  `supabase/tests/technical_configuration_dossier_delete_audit_phase_gate.sql`
- Create:
  `supabase/tests/technical_configuration_dossier_delete_audit_failure_phase_gate.sql`
- Modify:
  `supabase/tests/technical_configuration_dossier_delete_concurrency_phase_gate.sql`
- Modify this OpenSpec change and `p15c-tdd-plan.md`.

## Chunk 1: RED - Source Contract

- [ ] Require exactly one P15A2 migration after all delete, guard, baseline-lock
      and exact audit-helper predecessors.
- [ ] Freeze signature, security boundary, grants, P15A guard order and response.
- [ ] Freeze root snapshot, exact audit payload, fail-closed condition and
      audit-before-delete order.
- [ ] Require a rollback-only success gate without shared-helper replacement
      and a separate isolated forced-failure gate.
- [ ] Require the existing concurrency gate to assert and clean token-matched
      audit evidence for both winner orders.
- [ ] Run only the new source test and observe RED because migration/gate changes
      are absent.

## Chunk 2: GREEN - Migration

- [ ] Replace only the delete RPC in the correctly ordered migration.
- [ ] Preserve dossier-row-first serialization and locked-history rejection.
- [ ] Snapshot root metadata while the dossier lock is retained.
- [ ] Insert audit evidence before root deletion.
- [ ] Raise exact `PT500/audit_log_failed` when audit result is not `TRUE`.
- [ ] Preserve all P15A revokes/grants and dormant proxy boundary.
- [ ] Rerun the source test and confirm the migration contract is GREEN.

## Chunk 3: GREEN - SQL Proof Artifacts

- [ ] Add a success-only rollback gate without shared-function replacement and
      compare the complete audit payload by JSONB equality.
- [ ] Add a separate isolated forced-failure gate, transactionally replace only
      the exact audit-helper overload and rely on final `ROLLBACK` to restore it.
- [ ] Assert the failure leaves dossier and descendants intact and creates no
      failure-token audit row.
- [ ] Update the two-session gate: delete-first commits exactly one delete audit;
      lock-first commits zero; cleanup removes only token-matched audit rows and
      proves zero dossier/audit residue.
- [ ] Do not execute either SQL artifact against live DB in this implementation
      session; never execute the forced-failure gate on live DB.

## Chunk 4: Verification And Review

- [ ] Run format, no-explicit-any, diff-only dedupe and typecheck gates.
- [ ] Run P15A/P15A2 source tests, proxy whitelist regression and all five P15B
      metadata-edit suites.
- [ ] Run React Doctor, strict OpenSpec validation and `git diff --check`.
- [ ] Rerun Code Review Graph changed-file analysis and GitNexus impact analysis
      against the completed diff.
- [ ] Request focused subagent review, fix actionable findings and rerun affected
      gates.
- [ ] Commit with hooks enabled, push and open the Issue #869 PR.
- [ ] Process valuable PR comments and pause before any live migration apply.

## Live Boundary

No live DB write is authorized by plan approval. A future migration apply,
success-path audit gate and updated two-session concurrency gate each require
explicit authorization. The forced-failure helper-replacement gate is
isolated-environment-only and is not part of routine live verification.
