# P8A TDD Plan

## Scope Boundary

P8A is split into four deploy-safe leaves:

1. P8A1 adds dossier-scoped supplier persistence and RPC contracts.
2. P8A2 adds option identity and multiple-option persistence.
3. P8A3 adds exact-baseline response datasets and supplementary information.
4. P8A4 adds a nullable, side-effect-free comparison-set read RPC required by
   the explicit-save P8B2 workspace.

Supplier and option identity data remain outside the baseline aggregate. Baseline
copy does not clone them, and baseline lock state does not block their direct
editing. P8B1 owns supplier/option CRUD UI and P8B2 owns exact-baseline response
UI. The detailed P8A4/P8B1/P8B2 execution plan lives in
`p8b-tdd-plan.md`. P9A, P9B, P10, P11 and P12 remain out of scope.

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
- List by dossier with an optional supplier filter so P8B1 can load option
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
- After the live performance advisor identifies the supplier-first composite FK
  as uncovered, keep the applied migration immutable and create
  `supabase/migrations/20260722060629_technical_configuration_options_supplier_fk_index.sql`
  with an index on `(supplier_id, dossier_id)`. Retain the original
  `(dossier_id, supplier_id)` index for dossier-first list reads.
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
test "$(wc -l < supabase/migrations/20260722060629_technical_configuration_options_supplier_fk_index.sql)" -le 450
test "$(wc -l < supabase/tests/technical_configuration_options_phase_gate.sql)" -le 450
```

Run a final Code Review Graph change-detection pass before commit. Commit and
push P8A2 as one branch and one PR.

## P8A3 Red-Green-Refactor

### Pre-Edit Workflow

- Sync clean `main` and recall AgentMemory for P8A2 completion and the approved
  exact-baseline response boundary.
- Re-read `tasks.md`, `implementation-plan.md`, this plan, `contracts.md` and
  the TC-07/TC-17 rows in `test-matrix.md`.
- Use Code Review Graph first, then GitNexus for the narrowed supplier-option
  RPC/type symbols. Backstop SQL relationships with `rg` and read-only Supabase
  MCP inspection.
- Invoke `supabase-postgres-best-practices`, `code-deduplication` and
  `react-best-practices` before SQL/TypeScript edits.
- Compare the new migration timestamp against every local migration touching
  options, baseline versions or baseline criteria. The filename must sort after
  `20260722060629_technical_configuration_options_supplier_fk_index.sql`.
- Keep P8A3 as one deploy-safe leaf, one branch and one PR. The comparison-set
  and response tables plus their two RPCs are one ownership contract and do not
  provide useful independent deploy states.

### Contract Decisions

- Create `public.technical_configuration_comparison_sets` with one row per
  `option_id + baseline_version_id`.
- Add `UNIQUE (id, baseline_version_id)` to comparison sets so response rows
  can enforce exact-version ownership with a composite foreign key.
- Add `UNIQUE (id, dossier_id)` to
  `public.technical_configuration_options` in the new P8A3 migration. Do not
  edit either applied P8A2 migration.
- Store `dossier_id` on each comparison set and enforce both
  `(option_id, dossier_id)` and `(baseline_version_id, dossier_id)` composite
  foreign keys.
- Create `public.technical_configuration_option_responses` with one row per
  `comparison_set_id + criterion_id`.
- Store `baseline_version_id` on each response and enforce both
  `(comparison_set_id, baseline_version_id)` and
  `(criterion_id, baseline_version_id)` composite foreign keys.
- Store `response_text` and `supplementary_information` as separate multiline
  text fields. Preserve supplied text exactly and canonicalize SQL `NULL` to an
  empty string.
- Do not add compliance, evaluation, assessment, ranking or overall-status
  fields or parameters. P11 owns manual assessment and derived compliance;
  P12C owns ranking.
- A comparison set already present for the requested pair is a read: return it
  without changing audit fields or dossier revision, including after dossier
  archive. Authenticate and resolve ownership first, but do not call the
  editable-dossier helper and do not reject a stale `p_expected_revision` on
  this existing path.
- Creating a missing comparison set requires the current dossier revision,
  rejects archived dossiers and increments the dossier revision exactly once.
  After locking the dossier, recheck the unique option/version pair before
  insertion so concurrent callers cannot create duplicates.
- Response upsert requires the current dossier revision, rejects archived
  dossiers and increments the dossier revision exactly once. It is a full
  replacement of both text fields; callers preserving one field must resend
  its current value.
- Both comparison-set creation and response upsert work against draft or locked
  baseline versions. Never call
  `_technical_configuration_require_editable_baseline_version()`.
- Baseline copy never clones suppliers, options, comparison sets or option
  responses. A new baseline version gets a separate comparison set and separate
  criterion response rows.
- There is no P8A3 delete RPC. Empty response/supplementary values are stored by
  upsert; option, baseline-version and dossier deletion provide the approved
  cascade paths.

### RPC And Wire Contract

Add exactly these RPCs:

```text
technical_configuration_comparison_set_get_or_create(
  p_option_id UUID,
  p_baseline_version_id UUID,
  p_expected_revision BIGINT
)

technical_configuration_option_response_upsert(
  p_comparison_set_id UUID,
  p_criterion_id UUID,
  p_response_text TEXT,
  p_supplementary_information TEXT,
  p_expected_revision BIGINT
)
```

`technical_configuration_comparison_set_get_or_create` returns:

```text
{
  data: {
    id,
    dossier_id,
    option_id,
    baseline_version_id,
    created_at,
    created_by,
    updated_at,
    updated_by,
    revision,
    responses: [{
      id,
      comparison_set_id,
      baseline_version_id,
      criterion_id,
      response_text,
      supplementary_information,
      created_at,
      created_by,
      updated_at,
      updated_by,
      revision
    }]
  }
}
```

Response rows are ordered by baseline group `sort_order`, criterion
`sort_order`, then criterion ID.

`technical_configuration_option_response_upsert` returns one full-replacement
response row in the same `{ data: ... }` wrapper and does not return the whole
comparison set.

### RED

- Create
  `src/app/api/rpc/__tests__/technical-configuration-option-responses-migration.test.ts`
  to freeze migration order, the two tables, option ownership alteration,
  composite ownership keys and foreign keys, FK indexes, exact RPC signatures,
  audit fields, authorization, concurrency helpers, no-lock behavior, cascade,
  RLS, grants, compliance-field exclusion, file-size limits and the dedicated
  phase-gate suite.
- Extend
  `src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts`
  with exactly two P8A3 RPC names, complete wire shapes and module-local adapter
  delegation.
- Extend
  `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
  with exactly the two P8A3 RPCs.
- Run:

```bash
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/technical-configuration-option-responses-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  'src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts'
```

The tests must fail because the P8A3 migration, response RPC manifest, wire
types and adapter functions do not exist yet.

### GREEN

- Create
  `supabase/migrations/20260722072748_technical_configuration_option_responses.sql`.
- Create
  `supabase/tests/technical_configuration_option_responses_phase_gate.sql` for
  RPC/business behavior and
  `supabase/tests/technical_configuration_option_responses_constraints_phase_gate.sql`
  for direct composite-ownership failures; do not extend the P8A1 supplier or
  P8A2 option phase gates.
- Add all FK-supporting indexes in the primary migration, including child-side
  indexes whose leftmost columns match the composite FK order.
- Add `technical_configuration_comparison_set_get_or_create` and
  `technical_configuration_option_response_upsert`.
- Reuse `_technical_configuration_require_global_user()` and
  `_technical_configuration_require_editable_dossier()` instead of creating a
  new authorization/revision helper.
- Hold a shared dossier-row lock, then re-read and shared-lock the existing
  comparison set before assembling its response. This keeps dossier revision and
  response rows in one committed writer state and returns `PT404 not_found`
  rather than `{ data: null }` if a concurrent cascade removed either row.
- Extend the existing supplier-option RPC manifest, wire types and module-local
  adapter. Do not change `callTechnicalConfigurationRpc`.
- Add only the two P8A3 RPC names to the existing route allowlist.
- Re-run the focused RED command until it passes.

### SQL Phase Gate

The dedicated transaction-wrapped phase-gate suite must prove:

- missing claims and non-global roles fail closed while raw `admin` and
  `global` are accepted;
- option and baseline version must belong to the same dossier, with direct
  negative inserts proving both comparison-set composite foreign keys;
- a response criterion must belong to the comparison set's exact baseline
  version, with direct negative inserts proving both response composite foreign
  keys;
- get-or-create returns the same set for the same option/version pair and does
  not bump revision or audit metadata on the existing path;
- stale expected revisions are ignored on the existing path for both active
  and archived dossiers;
- creating a missing set and upserting a response each increment dossier
  revision exactly once;
- stale revisions reject create/upsert with no partial row or revision change;
- existing sets remain readable after dossier archive, while missing-set
  creation and response upsert are rejected;
- get-or-create and upsert continue to work against draft and locked baselines;
- response and supplementary text remain separate and preserve exact multiline
  values; full replacement can change one field while resending the unchanged
  value of the other;
- the schema/RPC payload contains no compliance, evaluation, assessment,
  ranking or overall-status field;
- copying a locked baseline does not copy comparison sets/responses; a new set
  on the copied version links only to copied criteria while the old dataset
  remains unchanged;
- option, baseline-version and dossier deletion cascade through comparison sets
  and responses without cross-dossier leakage;
- create sets all audit fields, response update preserves
  `created_at`/`created_by`, and set/response `updated_at`/`updated_by` advance
  for the current actor;
- authenticated and anon cannot access either table directly, authenticated
  and service-role can execute only the two public P8A3 RPCs, and anon cannot;
- the transaction ends with `ROLLBACK`.

Each phase-gate `ROLLBACK` only reverts test fixtures and assertions. If the
P8A3 migration has been applied and must be reversed, create a new superseding
migration rather than editing the applied migration. Provided no later
migration depends on P8A3, reverse it in this order:

1. Revoke and drop
   `technical_configuration_option_response_upsert(UUID, UUID, TEXT, TEXT, BIGINT)`
   and
   `technical_configuration_comparison_set_get_or_create(UUID, UUID, BIGINT)`.
2. Drop `public.technical_configuration_option_responses`, then
   `public.technical_configuration_comparison_sets`.
3. Drop only the P8A3-owned
   `technical_configuration_options_id_dossier_id_key` constraint.
4. Preserve all P8A1/P8A2 tables, RPCs, helpers and applied migration files.

Any live reversal requires separate explicit write authorization and the same
post-migration read-only schema, grant, RLS and advisor verification.

### LIVE APPLY RECORD - 2026-07-22

- Applied local migration
  `20260722072748_technical_configuration_option_responses.sql` through
  Supabase MCP as live version `20260722085301`
  (`technical_configuration_option_responses`).
- Executed
  `supabase/tests/technical_configuration_option_responses_phase_gate.sql` and
  `supabase/tests/technical_configuration_option_responses_constraints_phase_gate.sql`
  through Supabase MCP. Both transaction-wrapped gates completed without errors
  and ended in `ROLLBACK`.
- Post-gate read-only verification confirmed both P8A3 tables have RLS enabled,
  no `anon`/`authenticated` table CRUD, the intended `service_role` table
  privileges, fixed RPC `search_path`, intended RPC execute grants, and the
  required constraints and supporting indexes. Both P8A3 tables were empty
  after rollback.
- Security and performance advisors were run. The performance advisor reported
  no missing-index finding for either P8A3 table; remaining advisor notices are
  the repo-wide baseline or intentional guarded-RPC/RPC-only-table patterns.

### REFACTOR AND VERIFY

The pre-edit skills and graph-analysis gates above are workflow steps, not shell
commands. Then run:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/technical-configuration-option-responses-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-options-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-suppliers-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  'src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts'
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison \
  --type change --strict --no-interactive
P8A3_MIGRATION="$(
  find supabase/migrations -maxdepth 1 \
    -name '*_technical_configuration_option_responses.sql' -print
)"
test "$(printf '%s\n' "$P8A3_MIGRATION" | sed '/^$/d' | wc -l)" -eq 1
test "$(wc -l < "$P8A3_MIGRATION")" -le 450
test "$(wc -l < supabase/tests/technical_configuration_option_responses_phase_gate.sql)" -le 450
test "$(wc -l < supabase/tests/technical_configuration_option_responses_constraints_phase_gate.sql)" -le 450
```

Run a final Code Review Graph change-detection pass before commit. Commit and
push P8A3 as one branch and one PR.

## Live Database Boundary

No migration apply, phase-gate execution, DDL, DML or other live write is
authorized by approval of this plan. Applying the migration and running the
transaction-wrapped SQL phase gate each require a separate explicit live-write
approval. Supabase CLI is not used.
