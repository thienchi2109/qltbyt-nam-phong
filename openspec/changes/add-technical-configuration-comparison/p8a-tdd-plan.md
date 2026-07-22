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

## P8A2 Red-Green-Refactor

### Pre-Edit Workflow

- Invoke `/react-best-practices` before editing the TypeScript contracts,
  adapters or route allowlist.
- Run Code Review Graph first to narrow the affected files and symbols, then
  run GitNexus context/impact analysis for those symbols before implementation.
  If GitNexus reports HIGH or CRITICAL impact, stop and warn the user before
  editing.

### Contract Decisions

- Create `public.technical_configuration_options` as dossier-scoped option
  identity owned by one supplier through a composite
  `(supplier_id, dossier_id)` foreign key.
- Store nullable canonical `model`, `manufacturer`, `option_name` and `notes`
  plus mandatory `created_at`, `created_by`, `updated_at` and `updated_by`
  audit metadata. Collapse boundary/internal whitespace for the three identity
  fields, preserve internal note formatting, and require at least one of
  `model` or `option_name`.
- Return a derived `display_label` as
  `supplier name · model`, falling back to `supplier name · option_name`.
  Do not persist or accept `display_label` as input.
- Do not add option identity uniqueness or user-managed ordering because the
  OpenSpec does not require either contract. List results are deterministic by
  supplier normalized name, option display key and option ID.
- List by dossier with an optional supplier filter so P8B can load option
  identity without one RPC call per supplier.
- Add an index on `(dossier_id, supplier_id)` for dossier reads, optional
  supplier filtering and composite-FK cascade checks.
- Use the dossier revision for every option mutation. Option identity remains
  directly editable, has no lock/version column and is not copied with a
  baseline version.
- Keep the shared `callTechnicalConfigurationRpc` contract unchanged.

### RPC And Wire Contract

- `technical_configuration_options_list(UUID, UUID, INTEGER, INTEGER)` accepts
  `p_dossier_id`, optional `p_supplier_id DEFAULT NULL`, `p_page DEFAULT 1` and
  `p_page_size DEFAULT 50`.
- `technical_configuration_option_create(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT)`
  accepts `p_supplier_id`, nullable `p_model`, `p_manufacturer`,
  `p_option_name`, `p_notes` and `p_expected_revision`.
- `technical_configuration_option_update(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT)`
  accepts `p_option_id`, the same nullable identity fields and
  `p_expected_revision`.
- `technical_configuration_option_delete(UUID, BIGINT)` accepts `p_option_id`
  and `p_expected_revision`.
- List returns `{ data, revision, total, page, page_size }`. Each option item
  returns `id`, `dossier_id`, `supplier_id`, `supplier_name`, `model`,
  `manufacturer`, `option_name`, `notes`, `display_label`, all audit fields and
  the owning dossier `revision`.
- Create/update return `{ data: optionItem }` with the incremented dossier
  revision. Delete returns `{ data: { id, revision } }`.

### RED

- Create
  `src/app/api/rpc/__tests__/technical-configuration-options-migration.test.ts`
  to freeze migration order, schema, composite ownership, CRUD/list signatures,
  audit metadata, supporting index, authorization, concurrency, cascade, RLS,
  grants, file-size limits and the dedicated phase gate.
- Extend
  `src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts`
  with exactly four option RPC names, wire types and module-local adapter calls.
- Extend
  `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
  with exactly the four option RPCs.
- Run:

```bash
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/technical-configuration-options-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  'src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts'
```

The tests must fail because the P8A2 migration, option RPC manifest, wire types
and adapter functions do not exist yet.

### GREEN

- Create
  `supabase/migrations/20260722034323_technical_configuration_options.sql`.
- Create
  `supabase/tests/technical_configuration_options_phase_gate.sql`; do not grow
  the P8A1 supplier phase gate past the repository file-size ceiling.
- Add `technical_configuration_options_list`,
  `technical_configuration_option_create`,
  `technical_configuration_option_update` and
  `technical_configuration_option_delete`.
- Reuse `_technical_configuration_require_global_user()` and
  `_technical_configuration_require_editable_dossier()` instead of introducing
  another authorization or revision helper.
- Extend the supplier-option RPC manifest, wire types and module-local adapter.
- Add only the four option RPC names to the existing route allowlist.
- Re-run the focused RED command until it passes.

### SQL Phase Gate

The dedicated transaction-wrapped phase gate must prove:

- missing claims and non-global roles fail closed while raw `admin` and
  `global` are accepted;
- multiple options can belong to one supplier and the same identity values are
  not rejected by an unapproved uniqueness rule;
- list pagination, optional supplier filtering and deterministic display labels;
- archived dossiers remain readable through list while all option mutations are
  rejected;
- cross-dossier supplier ownership rejection;
- create/update/delete with the current revision increment exactly once and
  return the new revision;
- create sets all audit fields, while update preserves `created_at`/`created_by`
  and advances `updated_at`/`updated_by` for the current actor;
- stale dossier revisions are rejected without changing option data or dossier
  revision;
- option create/update/delete still work when the dossier has a locked
  baseline, proving no baseline lock/version dependency;
- deleting a supplier or dossier cascades to options;
- authenticated and anon cannot access the table directly, authenticated and
  service-role can execute only the public option RPCs, and anon cannot;
- the transaction ends with `ROLLBACK`.

The phase-gate `ROLLBACK` only reverts its test fixtures and assertions. If the
P8A2 migration has been applied and must be reversed, create a new superseding
migration rather than editing the applied migration. Provided no later migration
depends on P8A2, reverse it in this order:

1. Revoke and drop
   `technical_configuration_option_delete(UUID, BIGINT)`,
   `technical_configuration_option_update(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT)`,
   `technical_configuration_option_create(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT)`
   and
   `technical_configuration_options_list(UUID, UUID, INTEGER, INTEGER)`.
2. Drop `public.technical_configuration_options`; its policy and index are
   removed with the table.
3. Preserve `public.technical_configuration_suppliers`,
   `_technical_configuration_require_global_user()` and
   `_technical_configuration_require_editable_dossier(UUID, BIGINT)` because
   they belong to P8A1.

Any live reversal requires separate explicit write authorization and the same
post-migration read-only schema, grant, RLS and advisor verification.

### REFACTOR AND VERIFY

The pre-edit `/react-best-practices` and graph-analysis gates above are workflow
steps, not shell commands. Then run:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/technical-configuration-options-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-suppliers-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  'src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts'
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison \
  --type change --strict --no-interactive
test "$(wc -l < supabase/migrations/20260722034323_technical_configuration_options.sql)" -le 450
test "$(wc -l < supabase/tests/technical_configuration_options_phase_gate.sql)" -le 450
```

Run a final Code Review Graph change-detection pass before commit. Commit and
push P8A2 as one branch and one PR.

## Live Database Boundary

No migration apply, phase-gate execution, DDL, DML or other live write is
authorized by approval of this plan. Applying the migration and running the
transaction-wrapped SQL phase gate each require a separate explicit live-write
approval. Supabase CLI is not used.
