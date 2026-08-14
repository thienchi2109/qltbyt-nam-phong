# P1A Additive Subgroup Schema Implementation Plan

> **For agentic workers:** REQUIRED: use
> `superpowers:test-driven-development`, `supabase-postgres-best-practices`, and
> `superpowers:verification-before-completion`. Use a branch and PR unless the user
> explicitly requests another workflow. The P0 instruction to work on `main` does not
> authorize P1A work on `main`.

**Goal:** Add deploy-safe subgroup storage and nullable criterion subgroup ownership
without changing any current RPC response, client contract, or application behavior.

**Architecture:** Add one RPC-only subgroup table scoped to a baseline version and main
group, then add a nullable composite-scoped subgroup reference to criteria. Existing
criteria remain unchanged direct children. Client compatibility, snapshot producers,
mutations, workbook v2, and UI remain in later leaves.

**Tech stack:** PostgreSQL 17, Supabase migrations, Vitest source-contract tests,
Supabase MCP for explicitly authorized live apply and read-only verification.

---

## Scope Boundary

### In scope

- one new ordered subgroup table;
- nullable `technical_configuration_baseline_criteria.subgroup_id`;
- constraints and indexes enforcing version/group ownership and ordering;
- audit columns consistent with current baseline tables;
- RLS, deny policy, explicit revokes, and `service_role` grant;
- migration source-contract tests;
- data-preserving rollback guidance;
- authorized live apply, advisors, and read-only smoke verification as a separate gate.

### Out of scope

- RPC response or function changes;
- subgroup CRUD/mutation functions;
- proxy allowlist changes;
- generated Supabase types or application wire types;
- baseline editor state;
- comparison, evaluation, progress, or result export;
- XLSX v2;
- feature flags or production UI activation.

## Planned Files

- Create:
  `supabase/migrations/20260807091720_technical_configuration_baseline_subgroups.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-baseline-subgroups-migration.test.ts`
- Modify only if review proves necessary:
  `openspec/changes/revise-technical-configuration-baseline-hierarchy/p1a-tdd-plan.md`

Do not modify `database.types.ts`, RPC allowlists, runtime TypeScript, or existing
technical-configuration migrations in P1A.

## Schema Contract

The migration must implement this logical shape:

```sql
CREATE TABLE public.technical_configuration_baseline_subgroups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_version_id UUID NOT NULL,
  group_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  CONSTRAINT tc_baseline_subgroups_id_scope_key
    UNIQUE (id, group_id, baseline_version_id),
  CONSTRAINT tc_baseline_subgroups_group_sort_key
    UNIQUE (group_id, sort_order) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT tc_baseline_subgroups_group_scope_fkey
    FOREIGN KEY (group_id, baseline_version_id)
    REFERENCES public.technical_configuration_baseline_groups (id, baseline_version_id)
    ON DELETE CASCADE
);

ALTER TABLE public.technical_configuration_baseline_criteria
  ADD COLUMN subgroup_id UUID;

ALTER TABLE public.technical_configuration_baseline_criteria
  ADD CONSTRAINT tc_baseline_criteria_subgroup_scope_fkey
  FOREIGN KEY (subgroup_id, group_id, baseline_version_id)
  REFERENCES public.technical_configuration_baseline_subgroups
    (id, group_id, baseline_version_id)
  ON DELETE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;
```

The final migration must also add:

- `tc_baseline_subgroups_version_order_idx` on
  `(baseline_version_id, group_id, sort_order, id)`;
- `tc_baseline_criteria_subgroup_order_idx` on
  `(subgroup_id, sort_order, id) WHERE subgroup_id IS NOT NULL`;
- RLS and a false `ALL` policy for `anon`/`authenticated`;
- explicit table revokes from `PUBLIC`, `anon`, and `authenticated`;
- `GRANT ALL` only to `service_role`.

## Task 1: Lock The Migration Contract RED

**Files:**

- Create:
  `src/app/api/rpc/__tests__/technical-configuration-baseline-subgroups-migration.test.ts`

- [ ] Write a test that locates exactly one migration ending in
      `_technical_configuration_baseline_subgroups.sql`.
- [ ] Assert that its timestamp sorts after
      `20260806031201_technical_configuration_dossier_delete_audit.sql`.
- [ ] Assert the subgroup table has the exact ownership, name, order, and audit columns.
- [ ] Assert the group/version composite FK and both unique constraints.
- [ ] Assert `subgroup_id` is nullable, has no default, and the migration contains no
      criterion backfill `UPDATE`.
- [ ] Assert the criterion-to-subgroup composite FK is deferrable and preserves the
      existing non-null group/version ownership.
- [ ] Assert both read indexes.
- [ ] Assert RLS, deny policy, revokes, and service-role-only grant.
- [ ] Assert the migration does not `CREATE OR REPLACE FUNCTION`, alter RPC grants, or
      change existing criterion IDs/codes/order.

Run:

```bash
node scripts/npm-run.js exec vitest run \
  src/app/api/rpc/__tests__/technical-configuration-baseline-subgroups-migration.test.ts
```

Expected: FAIL because the migration file does not exist.

## Task 2: Implement The Minimal Additive Migration

**Files:**

- Create:
  `supabase/migrations/20260807091720_technical_configuration_baseline_subgroups.sql`

- [ ] Create the subgroup table and scope constraints.
- [ ] Add subgroup and criterion indexes.
- [ ] Enable RLS and apply deny-by-default access.
- [ ] Add nullable `criteria.subgroup_id`.
- [ ] Add the deferred composite subgroup ownership FK.
- [ ] Do not update existing rows.
- [ ] Add concise SQL comments documenting: - P1A is schema-only; - all existing criteria remain direct children; - populated hierarchy must never be dropped during rollback.

Run the focused test again.

Expected: PASS.

## Task 3: Prove Existing Migration Contracts Stay Green

Run:

```bash
node scripts/npm-run.js exec vitest run \
  src/app/api/rpc/__tests__/technical-configuration-baseline-subgroups-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-baseline-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-baseline-locking-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-baseline-import-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-comparison-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-manual-assessments-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-result-export-manifest-migration.test.ts
```

Expected:

- all tests pass;
- no existing test requires subgroup response fields;
- no migration ordering or grant regression.

## Task 4: Run Repository Gates

Because the new contract test is TypeScript, run the repository order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js exec vitest run \
  src/app/api/rpc/__tests__/technical-configuration-baseline-subgroups-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-baseline-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-baseline-locking-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-baseline-import-migration.test.ts
node scripts/npm-run.js run react-doctor
```

`react-doctor` is required by the repository gate even though P1A does not change React
runtime code. Record unrelated baseline findings instead of widening scope.

## Task 5: Review Deploy Safety Before Live Apply

No live write is authorized by this plan.

Before requesting authorization:

- [ ] capture read-only counts and an ordered digest of criterion
      `(id, baseline_version_id, group_id, criterion_code, sort_order)`;
- [ ] confirm the subgroup table/column are still absent;
- [ ] confirm migration source order and fresh replay tests;
- [ ] review the migration for lock duration, grants, RLS, and composite FK behavior;
- [ ] confirm deployed clients still receive the unchanged two-level RPC shape.

Then ask exactly:

> Việc này cần ghi migration P1A vào live DB qua Supabase MCP. Anh có cho phép tôi thực
> hiện migration `technical_configuration_baseline_subgroups` không?

Do not apply without an affirmative answer to that specific request.

## Task 6: Authorized Apply And Read-Only Verification

Only after explicit permission:

- [ ] apply with Supabase MCP `apply_migration`;
- [ ] inspect the subgroup table, column, constraints, indexes, policy, and grants;
- [ ] prove subgroup row count is zero;
- [ ] prove every criterion counted in the preflight still has `subgroup_id IS NULL`;
- [ ] compare the pre/post criterion identity digest;
- [ ] confirm existing RPC signatures and ACLs are unchanged;
- [ ] run security advisors;
- [ ] run performance advisors;
- [ ] run read-only representative queries for draft, group, and criterion counts.

Expected live state:

- existing application behavior is unchanged;
- no response contains subgroup data yet;
- no authenticated direct table access is added;
- all existing criteria remain direct main-section children.

## Rollback

Preferred rollback:

1. roll back any application deployment while retaining the additive schema;
2. keep P1A columns/table unused until the issue is corrected;
3. ship a forward superseding migration for schema defects.

Dropping the table/column is allowed only before any subgroup producer is enabled and
only after:

- explicit live-write authorization;
- subgroup table count is zero;
- all criterion `subgroup_id` values are null;
- no later migration depends on the objects.

After subgroup data exists, destructive rollback is forbidden.

## Completion Criteria

- focused RED/GREEN evidence is recorded;
- repository gates pass;
- migration contains no runtime/RPC behavior change;
- PR review confirms the additive deploy boundary;
- live apply is either explicitly authorized and verified or clearly left pending;
- the P1A issue remains open if live apply is pending.
