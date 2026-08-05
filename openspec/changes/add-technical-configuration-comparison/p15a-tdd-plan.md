# P15A TDD Plan - Dormant Dossier Hard-Delete Contract

> **For agentic workers:** Execute test-first with
> `superpowers:test-driven-development`, `karpathy-coding-heuristics` and
> `supabase-postgres-best-practices`. Use Supabase MCP for every live DB read or
> write. Do not apply the migration or run the rollback-only live phase gate
> without explicit permission for each live write operation.

## Goal

Add the authoritative database contract for permanently deleting an active
technical-configuration dossier that has never had a locked baseline. Extend
the dossier list with set-based `can_delete`, but keep the delete RPC dormant:
no proxy allowlist, TypeScript adapter or UI belongs to this leaf.

**Tracking issue:** [#864](https://github.com/thienchi2109/qltbyt-nam-phong/issues/864)

## Preconditions

- P3A and P4 are merged and verified on `main`.
- The execution branch starts from clean, synchronized `main`.
- AgentMemory, Code Review Graph and GitNexus are refreshed for the dossier
  list, editable-dossier guard and baseline-lock functions.
- Live DB inspection remains read-only until the user explicitly authorizes an
  apply or rollback-only phase gate.

## Frozen Contract

- RPC:
  `technical_configuration_dossiers_delete(p_id UUID, p_expected_revision BIGINT)`.
- Success response: `{ data: { id: <uuid> } }`.
- The RPC calls `_technical_configuration_require_editable_dossier()` first.
- While retaining the dossier row lock, it rejects any dossier with historical
  `technical_configuration_baseline_versions.status='locked'` using
  `PT409/locked_dossier`.
- A later draft never restores delete eligibility after the first lock.
- On success, delete only `technical_configuration_dossiers`; verified
  `ON DELETE CASCADE` constraints remove descendants in the same transaction.
- The dossier list adds non-null boolean `can_delete`, computed set-based from
  active state plus locked-baseline existence.
- `can_delete` is an affordance, not authorization.
- Archive remains one-way and distinct from hard-delete.
- Baseline lock and delete both lock the dossier row first.
- No new table or speculative index is planned.

## Planned Files

- Create after checking all local migrations touching the dossier list, dossier
  guard or baseline lock:
  `supabase/migrations/<timestamp>_technical_configuration_dossier_delete.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-dossier-delete-migration.test.ts`
- Regression-only; keep unchanged unless its source marker changes:
  `src/app/api/rpc/__tests__/technical-configuration-dossier-migration.test.ts`
- Create:
  `supabase/tests/technical_configuration_dossier_delete_phase_gate.sql`
- Create:
  `supabase/tests/technical_configuration_dossier_delete_concurrency_phase_gate.sql`
- Do not modify:
  `src/app/api/rpc/[fn]/allowed-functions.ts`
- Do not create or modify frontend RPC manifests, adapters, types or components.

## Chunk 1: RED - Freeze Source And Dormancy Contracts

- [ ] Inspect current local migration timestamps and identify the latest file
      redefining the dossier list, editable-dossier guard or baseline lock.
- [ ] Inspect live function definitions, grants, baseline indexes and all
      dossier-descendant foreign keys through read-only Supabase MCP.
- [ ] Write a focused migration-source test for the exact delete signature,
      `{ data: { id } }`, `SECURITY DEFINER` and
      `SET search_path = public, pg_temp`.
- [ ] Require `REVOKE` from `PUBLIC`, `anon` and `service_role`, with
      `GRANT EXECUTE` only to `authenticated`, matching the existing dossier RPC
      boundary.
- [ ] Require editable-dossier guard invocation before locked-baseline
      inspection, dossier-row-first serialization, `PT409/locked_dossier` and
      one root `DELETE` with no manual child-table delete chain.
- [ ] Require additive non-null `can_delete` and set-based locked existence with
      no per-row function/list call.
- [ ] Add a negative assertion that the delete function is absent from
      `allowed-functions.ts` and every technical-configuration RPC manifest.
- [ ] Keep the existing foundation migration test scoped to the historical P1
      file through its `technical_configuration_dossier_foundation` marker. It
      must continue to prove the original five P1 RPCs without claiming that
      later P15A migrations cannot add a delete RPC.
- [ ] Run:
      `rtk node scripts/npm-run.js run test -- src/app/api/rpc/__tests__/technical-configuration-dossier-delete-migration.test.ts src/app/api/rpc/__tests__/technical-configuration-dossier-migration.test.ts src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`.
- [ ] Confirm RED only because the P15A migration and phase-gate artifacts do
      not yet exist.

## Chunk 2: GREEN - Add The Minimal Ordered Migration

- [ ] Create one transaction-scoped migration whose timestamp sorts after every
      local migration identified in Chunk 1.
- [ ] Replace `technical_configuration_dossiers_list` additively so each row
      includes `can_delete` without changing existing pagination/filter totals.
- [ ] Compute eligibility in the list statement with `EXISTS`/`NOT EXISTS` or
      an equivalent set-based join; do not invoke a version-list RPC.
- [ ] Create the delete RPC with the exact signature and common guard.
- [ ] Check locked history under the retained dossier row lock and fail before
      deletion with `locked_dossier`.
- [ ] Delete the aggregate root once and return only the deleted ID.
- [ ] Preserve deny-by-default table access, explicit function grants and fixed
      search paths.
- [ ] Run the focused source/whitelist tests and confirm only SQL runtime cases
      remain RED.

## Chunk 3: GREEN - Add The Rollback-Only SQL Phase Gate

- [ ] Build transaction-scoped fixtures with unique suffixes for: - active dossier with no baseline - active dossier with draft-only descendants - active dossier with historical locked baseline and a later draft - archived dossier
- [ ] Prove global and raw-admin semantics.
- [ ] Prove denied role, missing claim, stale revision, archived dossier,
      missing dossier and locked dossier failures with exact SQLSTATE/message.
- [ ] Prove draft-only aggregate deletion cascades through every current
      descendant table and leaves list/get absent.
- [ ] Prove locked-history rejection leaves root and all descendants unchanged.
- [ ] Prove `can_delete=true` only for active never-locked dossiers and remains
      false after a later draft is created.
- [ ] Add a reproducible two-session concurrency protocol whose labeled SQL
      blocks are executed through two concurrent Supabase MCP sessions.
- [ ] Prove delete-first: delete commits, baseline lock returns
      `PT404/not_found`, exactly one operation succeeds and no descendant row
      survives.
- [ ] Prove lock-first: baseline lock commits, delete returns
      `PT409/locked_dossier`, exactly one operation succeeds and the complete
      locked aggregate remains.
- [ ] Use unique disposable fixtures and include explicit post-assert cleanup.
      Do not replace this gate with static source inspection.
- [ ] End the phase gate with `ROLLBACK`.
- [ ] Run the focused migration-source test and confirm GREEN.

## Chunk 4: Refactor And Static Gate

- [ ] Recheck all cascade constraints against current local and live schema.
- [ ] Use semantic deduplication before adding any SQL helper; prefer the
      existing editable-dossier guard and baseline-lock pattern.
- [ ] Review the list query plan statically and through a rollback-only
      representative fixture. Add an index only if measured evidence proves the
      existing dossier/status indexes are insufficient.
- [ ] Confirm the diff contains no allowlist, adapter, type, React or UI change.
- [ ] Run in repository order through one context-mode batch.

  ```bash
  rtk node scripts/npm-run.js run format:check
  rtk node scripts/npm-run.js run verify:no-explicit-any
  rtk node scripts/npm-run.js run verify:dedupe
  rtk node scripts/npm-run.js run typecheck
  # Run the focused Vitest command from Chunk 1.
  rtk openspec validate add-technical-configuration-comparison --strict
  ```

## Live DB Gate

- [ ] Ask for explicit permission before applying the P15A migration.
- [ ] Apply through Supabase MCP only.
- [ ] Verify function definitions, grants and list response read-only.
- [ ] Ask for separate explicit permission before executing the rollback-only
      phase gate against live DB.
- [ ] Ask for separate explicit permission before executing the two-session
      concurrency gate. Run its labeled blocks through two concurrent Supabase
      MCP sessions, verify both winner orderings and confirm cleanup leaves no
      disposable fixture rows.
- [ ] Run security and performance advisors after the approved gate.
- [ ] Preserve migration version, gate output and advisor findings in the leaf
      handoff.

## Exit Gate

P15A stops after a tested, applied and gated dormant database contract. The
browser cannot invoke hard-delete, metadata editing is unchanged and P15C may
not start until the live P15A evidence is available.
