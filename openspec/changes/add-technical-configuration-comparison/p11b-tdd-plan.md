# P11B Manual Assessment Persistence And Security Implementation Plan

> **For agentic workers:** Execute this plan test-first. Do not apply the migration
> or run the rollback-only live DB gate without separate explicit user approval.

**Goal:** Add the dormant database persistence and guarded RPC contract for
manual technical-configuration assessments without exposing it through the
application proxy, client, hooks, query keys or UI.

**Architecture:** Store one assessment per exact comparison-set/criterion pair.
The row persists only the two canonical P11A axes, notes, audit metadata and its
own optimistic revision. Two `SECURITY DEFINER` RPCs provide bounded reads and
row-level upserts behind the existing global-user guard, exact ownership checks,
archived-dossier protection and deny-by-default table access.

**Tech Stack:** PostgreSQL/Supabase migrations, PL/pgSQL, RLS, Vitest migration
source tests and rollback-only SQL phase gates.

---

## Scope And Frozen Inputs

- Base commit: `81200b8410abb300f084043b409d7edf3be5a1c1` from merged P11A.
- Create:
  `supabase/migrations/20260729134453_technical_configuration_manual_assessments.sql`.
- Create:
  `supabase/tests/technical_configuration_manual_assessments_phase_gate.sql`.
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-manual-assessments-migration.test.ts`.
- Update:
  `openspec/changes/add-technical-configuration-comparison/tasks.md`.
- Keep `src/lib/technical-configuration-evaluation.ts` unchanged.
- Do not change RPC allowlists/manifests, typed clients, hooks, query keys,
  routes, UI components or AI runtime artifacts.
- Do not use the Supabase CLI.
- Live DB inspection remains read-only unless the user separately authorizes
  the exact migration apply or rollback-only phase gate.

## Frozen Persistence Contract

`public.technical_configuration_manual_assessments` contains:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `comparison_set_id UUID NOT NULL`
- `baseline_version_id UUID NOT NULL`
- `criterion_id UUID NOT NULL`
- nullable `technical_axis TEXT`
- nullable `evidence_axis TEXT`
- `notes TEXT NOT NULL DEFAULT ''`
- `revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0)`
- standard `created_at`, `created_by`, `updated_at`, `updated_by`
- `UNIQUE (comparison_set_id, criterion_id)`
- composite FK `(comparison_set_id, baseline_version_id)` to the exact
  comparison set with `ON DELETE CASCADE`
- composite FK `(criterion_id, baseline_version_id)` to the exact criterion
  with `ON DELETE CASCADE`
- checks accepting only the P11A canonical ASCII values or SQL `NULL`

The table does not contain derived status, stale state, machine result, source
response, supplementary information, document or citation data.

## Frozen RPC Contract

`technical_configuration_assessments_list(UUID, INTEGER, INTEGER)`:

- requires non-null `p_comparison_set_id`
- requires `p_page >= 1` and `1 <= p_page_size <= 100`
- requires an existing comparison set and global/admin session
- remains readable when the owning dossier is archived
- does not create a comparison set or mutate dossier/assessment revisions
- returns `{ data, total, page, page_size }`
- orders by baseline group order, criterion order and criterion ID

`technical_configuration_assessment_upsert(UUID, UUID, TEXT, TEXT, TEXT, BIGINT)`:

- accepts nullable canonical axes and nullable notes
- canonicalizes SQL `NULL` notes to `''`
- requires an existing exact comparison set and criterion in the same baseline
- rejects archived dossiers and non-global/missing claims fail-closed
- creates only when `p_expected_revision = 0`, returning revision `1`
- updates only when `p_expected_revision` equals the current assessment
  revision, incrementing that row revision exactly once
- returns `PT409/stale_revision` for create/update revision conflicts
- never increments dossier revision

Both RPCs return only:

`id`, `comparison_set_id`, `baseline_version_id`, `criterion_id`,
`technical_axis`, `evidence_axis`, `notes`, `revision`, `created_by`,
`created_at`, `updated_by`, `updated_at`.

## Chunk 1: RED - Freeze Migration And Boundary Contract

- [x] Create the focused Vitest migration-source test.
- [x] Assert the migration timestamp sorts after every existing local migration
      touching the same technical-configuration ownership chain.
- [x] Freeze the exact table columns, canonical checks, unique key, composite
      FKs, cascade behavior and supporting indexes.
- [x] Freeze both RPC signatures, argument nullability, SQLSTATE messages,
      deterministic wire fields and list ordering.
- [x] Freeze first-create revision `0 -> 1`, exact-update increment and stale
      conflict behavior without dossier revision mutation.
- [x] Freeze global/admin claim guards, archived mutation denial, RLS policy,
      table revokes, service-role table grant and RPC execute grants.
- [x] Freeze the no-derived/no-stale/no-machine boundary.
- [x] Freeze rollback-only phase-gate markers for auth, ownership, archive,
      conflict, source preservation, cascades and direct privileges.
- [x] Run:
      `node scripts/npm-run.js run test -- src/app/api/rpc/__tests__/technical-configuration-manual-assessments-migration.test.ts`.
- [x] Confirm RED because the migration and SQL phase-gate files do not exist.

## Chunk 2: GREEN - Add Minimal Persistence And RPCs

- [x] Create the ordered migration inside one `BEGIN`/`COMMIT` transaction.
- [x] Add the assessment table, composite-child indexes and canonical checks.
- [x] Enable RLS and add an explicit deny-all policy for `anon` and
      `authenticated`.
- [x] Revoke all direct table privileges from `PUBLIC`, `anon` and
      `authenticated`; grant only `SELECT`, `INSERT`, `UPDATE` and `DELETE`
      to `service_role`.
- [x] Implement the bounded list RPC with the existing global-user helper.
- [x] Implement the upsert RPC with an active-dossier lock, exact
      comparison-set/criterion ownership and row-level optimistic concurrency.
- [x] Map concurrent first-create conflicts to `PT409/stale_revision`.
- [x] Revoke function execution from all roles, then grant only
      `authenticated` and `service_role`.
- [x] Run the focused Vitest test and confirm only the missing phase-gate
      assertions remain RED.

## Chunk 3: GREEN - Add Rollback-Only SQL Phase Gate

- [x] Create a transaction-scoped fixture without depending on application
      proxy/client code.
- [x] Prove missing claims and non-global roles fail; raw `admin` succeeds.
- [x] Prove list bounds, exact ordering, wire fields and archived reads.
- [x] Prove canonical nullable axes/notes and reject non-canonical values.
- [x] Prove first create, exact update, stale create, stale update and creation
      audit preservation.
- [x] Prove response, supplementary-information and option-document updates do
      not change the assessment row or its revision.
- [x] Prove exact ownership FKs and option/baseline/dossier cascade cleanup.
- [x] Prove no direct `anon`/`authenticated` table access and exact function
      execute privileges.
- [x] End with `ROLLBACK`.
- [x] Run the focused Vitest migration-source test and confirm GREEN.

## Chunk 4: REFACTOR And Boundary Audit

- [x] Remove duplicated source-test helpers or SQL assertions without widening
      the production contract.
- [x] Confirm migration, source test and phase gate each stay at or below 450
      lines.
- [x] Confirm the diff contains no P11C/P12A proxy, client, hook, query-key or UI
      changes.
- [x] Confirm no P11A domain constants or derivation rules changed.
- [x] Mark `P11B.1` through `P11B.5` complete in `tasks.md`.
- [x] Keep `P11B.6` and `P11B.7` unchecked until their separate live DB
      approvals and executions occur.

## Verification

Run in repository order through one context-mode batch:

1. `node scripts/npm-run.js run format:check`
2. `node scripts/npm-run.js run verify:no-explicit-any`
3. `node scripts/npm-run.js run verify:dedupe`
4. `node scripts/npm-run.js run typecheck`
5. `node scripts/npm-run.js run test -- src/app/api/rpc/__tests__/technical-configuration-manual-assessments-migration.test.ts`
6. `node scripts/npm-run.js run test -- src/lib/__tests__/technical-configuration-evaluation.test.ts`
7. `node scripts/npm-run.js run react-doctor`

Then run Code Review Graph/GitNexus change-impact checks, dispatch a focused
subagent review, triage every finding and rerun affected gates after valid fixes.

## Live DB Gates

- [x] Applied `20260729134453_technical_configuration_manual_assessments.sql`
      after explicit approval through Supabase MCP `apply_migration`; live
      migration registry version: `20260729144351`.
- [x] Preserved the already-applied original migration and applied the
      superseding
      `20260729150646_technical_configuration_manual_assessments_service_role_grants.sql`
      after explicit approval; live migration registry version:
      `20260729155147`.
- [x] Ran `supabase/tests/technical_configuration_manual_assessments_phase_gate.sql`
      again after the privilege repair; every assertion passed and the
      transaction rolled back.
- [x] Ran read-only security/performance advisors after the repair and phase
      gate. The project baseline remains; no blocking P11B regression was
      identified.
- [x] Confirmed `assessment_count = 0`, `fixture_dossier_count = 0`, both RPCs
      and the table still exist, and `service_role` has exactly the four
      required DML privileges.

## Exit Gate

The repository contains a complete, tested and dormant P11B persistence
contract. No application surface can call the new RPCs yet. The authorized
migration is deployed, and the rollback-only phase gate left no fixture data.
