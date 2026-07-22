# P8A TDD Plan

## Scope Boundary

P8A is split into three deploy-safe leaves:

1. P8A1 adds dossier-scoped supplier persistence and RPC contracts.
2. P8A2 adds option identity and multiple-option persistence.
3. P8A3 adds exact-baseline response datasets and supplementary information.

Supplier and option identity data remain outside the baseline aggregate. Baseline
copy does not clone them, and baseline lock state does not block their direct
editing. P8B owns hooks and UI. P9A, P9B and P10 remain out of scope.

## P8A1 Red-Green-Refactor

### RED

- Create
  `src/app/api/rpc/__tests__/technical-configuration-suppliers-migration.test.ts`
  to freeze migration order, schema, normalization, authorization, concurrency,
  ownership, cascade, RLS and grants.
- Create
  `src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts`
  to freeze supplier RPC names, wire types and module-local adapter behavior.
- Extend
  `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
  with the four supplier RPCs.
- Run:

```bash
node scripts/npm-run.js exec vitest run \
  src/app/api/rpc/__tests__/technical-configuration-suppliers-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  'src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts'
```

The tests must fail because the P8A1 migration and TypeScript contracts do not
exist yet.

### GREEN

- Create
  `supabase/migrations/20260722010000_technical_configuration_suppliers.sql`.
- Create `supabase/tests/technical_configuration_suppliers_phase_gate.sql`.
- Create `src/lib/technical-configuration-supplier-option-rpcs.ts`.
- Create
  `src/app/(app)/technical-configurations/supplier-option-types.ts`.
- Create
  `src/app/(app)/technical-configurations/technical-configuration-supplier-option-rpc.ts`.
- Add only the supplier RPC manifest to the existing RPC allowlist.
- Re-run the focused RED command until it passes.

### REFACTOR AND VERIFY

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js exec vitest run \
  src/app/api/rpc/__tests__/technical-configuration-suppliers-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  'src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts'
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison \
  --type change --strict --no-interactive
```

Run Code Review Graph and GitNexus change detection before commit. Commit and
push P8A1 independently.

## Live Database Boundary

No migration apply, phase-gate execution, DDL, DML or other live write is
authorized by approval of this plan. Applying the migration and running the
transaction-wrapped SQL phase gate each require a separate explicit live-write
approval. Supabase CLI is not used.
