# P8B TDD Plan

## Scope And Delivery Decision

P8B is not delivered as one monolithic UI leaf.

1. P8A4 adds the side-effect-free nullable comparison-set read contract.
2. P8B1 adds supplier and option identity CRUD.
3. P8B2 adds exact-baseline option response editing.

Hard dependencies:

```text
P8A3 -> P8A4
P3A + P8A2 -> P8B1
P4 + P8A3 + P8A4 + P8B1 -> P8B2
```

Recommended delivery order is `P8A4 -> P8B1 -> P8B2`. P8B1 does not have a
hard dependency on P8A4, but landing the read contract first removes ambiguity
from the response workspace and keeps each later review focused.

P9A1 and P9B2 depend directly on P8B2; P9A2, P9A3 and P9B1 inherit the response
workspace dependency through the strict P9 delivery chain. Comparison,
evaluation, evidence, Excel, ranking and AI remain out of scope for P8B.

## Design Read

Reading this as a B2B operational workspace for equipment-procurement users,
with restrained shadcn/Tailwind language, medium-high information density and
low motion.

- Preserve the existing five-tab information architecture and module tokens.
- Use a lightly grouped supplier/option selector plus an unframed editor; do not
  add nested cards or decorative marketing composition.
- Use existing Lucide icons for create, edit, delete and save commands.
- Desktop may use a stable two-column selector/editor layout. Mobile stacks the
  selected context above the editor without horizontal page overflow.
- Implement loading, empty, validation, persistence, conflict, archived,
  pending and success states.
- Keep labels, textareas, timestamps and destructive warnings readable with long
  Vietnamese content and long supplier/model names.

## Shared Reuse Decisions

Reuse the existing module seams instead of introducing another generic
abstraction:

- `technical-configuration-supplier-option-rpc.ts` and
  `TechnicalConfigurationRpcError`
- `technical-configuration-query-keys.ts`
- `useTechnicalConfigurationBaselineVersionSelection`
- `useTechnicalConfigurationBaselineDossierRevision`
- `useTechnicalConfigurationBeforeUnloadGuard`
- `useTechnicalConfigurationDiscardConfirmation`
- shared `DestructiveConfirmDialog`
- the reference-product state/operations/hook split as an architectural pattern

Do not expand `TechnicalConfigurationWorkspaceShell` with business logic. It
owns only active-tab, dirty and navigation-block coordination.

Keep every new source file below the 350-line extraction threshold where
practical and always below the 450-line hard ceiling.

## P8A4 Red-Green-Refactor

### Files

- Create:
  `supabase/migrations/<ordered_timestamp>_technical_configuration_comparison_set_read.sql`
- Create:
  `supabase/tests/technical_configuration_comparison_set_read_phase_gate.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-comparison-set-read-migration.test.ts`
- Modify: `src/lib/technical-configuration-supplier-option-rpcs.ts`
- Modify: `src/app/(app)/technical-configurations/supplier-option-types.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-supplier-option-rpc.ts`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify:
  `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

### RED

Freeze these contracts before writing the migration:

- exactly one new RPC name:
  `technical_configuration_comparison_set_get`
- request contains only `p_option_id` and `p_baseline_version_id`
- response is `{ data: TechnicalConfigurationComparisonSetWire | null }`
- missing pair returns null without insert, row lock, revision increment or audit
  change
- existing pair returns ordered response rows and exact multiline text
- option and baseline must belong to the same dossier
- archived dossier remains readable
- invalid/missing JWT claims and cross-dossier access fail closed
- function is `SECURITY DEFINER` with `search_path = public, pg_temp`
- `anon` is denied; `authenticated` and `service_role` receive execute
- existing P8A3 get-or-create and upsert source contracts remain unchanged

Run RED:

```bash
node scripts/npm-run.js exec vitest run \
  src/app/api/rpc/__tests__/technical-configuration-comparison-set-read-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  'src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts'
```

Expected: failures for the absent migration, RPC constant, typed adapter and
allowlist entry.

### GREEN

- Choose the migration timestamp only after comparing every local migration
  touching P8A3 functions/tables.
- Implement one guarded read-only SQL function. Do not edit the applied P8A3
  migration.
- Return the same comparison-set/response wire shape as get-or-create.
- Extend constants, types, module-local adapter and RPC allowlist only for the
  new read RPC.
- Keep the P8A3 mutation signatures and semantics byte-for-byte unchanged where
  source-contract tests require it.

### SQL Phase Gate

The transaction-wrapped phase gate covers:

1. missing pair returns `data: null`
2. dossier revision and audit metadata remain unchanged
3. no comparison-set/response row is created
4. existing pair returns exact baseline-bound response rows
5. archived existing data remains readable
6. cross-dossier option/baseline pairing is rejected
7. `anon` denial, authenticated/service-role grants and fixed `search_path`
8. rollback leaves zero fixture rows

Applying the migration and executing the transaction phase gate each require
separate explicit live-write approval through Supabase MCP.

## P8B1 Red-Green-Refactor

### Files

- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionEditor.tsx`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptions.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-supplier-option-state.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-supplier-option-operations.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-options-fixtures.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-options-hook-cases.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-options-workspace-cases.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-options-conflict-cases.tsx`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-beforeunload.test.tsx`

### RED

Write tests for:

- empty supplier/option state and first supplier creation
- multiple options under one supplier
- stable `Nhà cung cấp · Model hoặc tên phương án` labels
- explicit create/update without autosave
- option delete cancel and confirmed cascade warning
- supplier delete cancel, filtered option `total` and confirmed cascade warning
- delete mutation uses the current dossier revision
- successful delete selects the next valid item and invalidates related queries
- stale revision preserves local input and requires explicit reload
- switching option/tab/dossier while dirty requires confirmation
- pending mutation blocks navigation
- archived dossier renders read-only controls
- no supplier/option lock or version control renders

Run RED:

```bash
node scripts/npm-run.js exec vitest run \
  'src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-beforeunload.test.tsx'
```

Expected: failures because the options tab is disabled and the P8B1
components/hook/state do not exist.

### GREEN

- Add dossier-scoped supplier and option query keys.
- Keep canonical server snapshots separate from local drafts.
- Sequence mutations through module-local operations using the current dossier
  revision and update the dossier detail cache after success.
- Read the affected option count for supplier deletion from the filtered option
  list response `total`; do not infer it from a partially loaded page.
- Reuse the shared destructive confirmation dialog.
- Keep the workspace shell change limited to enabling/rendering the options tab
  and wiring `onDirtyChange`/`onNavigationBlockedChange`.

## P8B2 Red-Green-Refactor

### Files

- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponses.tsx`
- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionResponses.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-option-response-state.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-option-response-operations.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-option-response-cases.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/supplier-option-response-conflict-cases.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers.tsx`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-beforeunload.test.tsx`

### RED

Write tests for:

- selecting an option/baseline calls only the P8A4 read RPC
- null read state renders local empty drafts without creating a comparison set
- existing state preserves exact response and supplementary multiline text
- first explicit save calls get-or-create, adopts its returned revision and then
  upserts the selected criterion
- no mutation occurs before explicit save
- validation failure sends no mutation
- get-or-create or upsert conflict preserves option, baseline, criterion and text
- a get-or-create success followed by upsert failure can reload the now-existing
  empty set and retry without losing the draft
- supplementary information never enters compliance/evaluation state
- draft and locked baseline versions remain editable
- archived dossier is readable but not editable
- dirty option/baseline/tab/dossier navigation uses the shared confirmation
- latest update time is
  `max(option.updated_at, selected_response.updated_at)`

Run RED:

```bash
node scripts/npm-run.js exec vitest run \
  'src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-beforeunload.test.tsx'
```

### GREEN

- Reuse `useTechnicalConfigurationBaselineVersionSelection`.
- Add a nullable comparison-set query keyed by option ID and baseline version ID.
- Keep criterion drafts local until explicit save.
- Treat first save as a recoverable two-step operation: get-or-create followed by
  response upsert with the returned current revision.
- Preserve local drafts across every error and require explicit reload after
  revision conflict.
- Render no evidence, comparison, evaluation, compliance or ranking controls.

## Verification Order

For each leaf, gather the common gates and that leaf's focused tests in one
context-mode batch.

Common gates:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
```

P8A4 focused tests:

```bash
node scripts/npm-run.js exec vitest run \
  src/app/api/rpc/__tests__/technical-configuration-comparison-set-read-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  'src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts'
```

P8B1 focused tests:

```bash
node scripts/npm-run.js exec vitest run \
  'src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-beforeunload.test.tsx'
```

P8B2 focused tests:

```bash
node scripts/npm-run.js exec vitest run \
  'src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-beforeunload.test.tsx'
```

After the focused tests for the current leaf:

```bash
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison \
  --type change --strict --no-interactive
```

Before P8B1/P8B2 React edits, invoke `frontend-design`,
`design-taste-frontend`, then the available React best-practices skill
(`build-web-apps:react-best-practices` preferred;
`vercel-react-best-practices` fallback).

Invoke the code-deduplication check before commit because P8B1/P8B2 introduce
new hooks, state helpers and operations. Use Code Review Graph first, then
GitNexus for the narrowed symbols.

## Browser Verification

After P8B1 and P8B2 implementation:

- start the repo dev server
- verify the real technical-configuration route
- check desktop and mobile viewports
- verify page identity, nonblank content, no framework overlay and console health
- exercise create/edit/delete, dirty navigation, conflict/reload, exact-baseline
  switching and explicit save
- capture screenshot evidence for normal, destructive confirmation, empty,
  error/conflict and mobile states

The live database currently has no supplier, option or option-response rows.
Creating representative live browser fixtures and cleaning them up requires a
separate explicit live-write approval. Without that permission, browser checks
remain read-only/empty-state and interaction coverage uses mocked Vitest data.

## Live Database Boundary

Approval of this plan or any frontend leaf does not authorize live writes.

- P8A4 migration apply requires explicit permission.
- P8A4 transaction-wrapped SQL phase gate requires explicit permission.
- Browser fixture create/update/delete requires explicit permission.
- No Supabase CLI command is used for database operations.
- If P8A4 reveals another schema gap, stop and propose a separate ordered
  migration leaf instead of silently widening P8B2.
