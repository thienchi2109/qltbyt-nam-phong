# P9 TDD Plan - Supplier Option Import And Evidence

## Scope And Delivery Decision

P9 is delivered as five deploy-safe leaves in this strict order:

```text
P5A + P8B2         -> P9A1
P8A4 + P9A1        -> P9A2
P9A2               -> P9A3
P7B1 + P8A4 + P9A3 -> P9B1
P6B + P7B2 + P8B2 + P9B1 -> P9B2
P7B2 + P9B2        -> P10A
```

Each leaf starts from `main` after the preceding leaf has merged. Do not stack
unmerged P9 implementation branches. The five branches are:

1. `feat/technical-config-p9a1-option-workbook`
2. `feat/technical-config-p9a2-option-import-contracts`
3. `feat/technical-config-p9a3-option-import-workspace`
4. `feat/technical-config-p9b1-option-evidence-contracts`
5. `feat/technical-config-p9b2-option-evidence-workspace`

No P9 leaf adds comparison, assessment, ranking or AI behavior. No database
write is allowed until the user explicitly authorizes the exact Supabase MCP
operation.

## Fixed Cross-Leaf Contracts

- The workbook is an authoritative full snapshot for one option and one exact
  baseline version.
- Every current baseline criterion appears exactly once. Missing, unknown or
  duplicate criteria reject import.
- Blank response or supplementary cells canonicalize to empty strings and clear
  old values after confirmed apply.
- Preview is read-only. Confirmed apply may create the comparison set inside the
  same transaction.
- Import concurrency uses the dossier `revision`; there is no separate
  option-response revision.
- Stale apply performs zero writes and preserves file, canonical rows and
  preview for refresh and re-preview.
- Option documents belong to `option_id` and are reusable across baseline
  versions.
- Option citations belong to the exact option, baseline version and criterion
  through the matching comparison set.
- Confirmed option-document deletion reports the total affected citation count
  and deletes the document plus all linked citations transactionally.
- Option responses and evidence remain editable against draft or locked
  baselines. Archived dossiers are read-only.

## Required Workflow Before Each Leaf

- Recall AgentMemory with the leaf ID and target symbols.
- Run Code Review Graph minimal context, then GitNexus impact for the narrowed
  symbols before editing.
- Invoke `karpathy-coding-heuristics`.
- For SQL leaves, invoke `supabase-postgres-best-practices`.
- For Next.js/React leaves, invoke `next-best-practices` then
  `react-best-practices`.
- Use `code-deduplication` before adding shared workbook, hook, state or evidence
  logic.
- Keep every source file below the 450-line hard ceiling and extract near 350
  lines.

## P9A1 - Supplier Option Workbook Codec

**Deploy boundary:** dormant workbook contract and codec only; no RPC,
migration or user-visible action.

### Files

- Create:
  `src/lib/technical-configuration-option-excel-contract.ts`
- Create:
  `src/lib/technical-configuration-option-excel-export.ts`
- Create:
  `src/lib/technical-configuration-option-excel-parse.ts`
- Create:
  `src/lib/__tests__/technical-configuration-option-excel.test.ts`

### RED

- Freeze one visible `OptionResponses` sheet, one hidden `_meta` sheet and no
  other sheet.
- Freeze the exact nine visible columns and seven metadata keys.
- Prove Vietnamese and multiline text round-trip without normalization.
- Prove all criteria are required exactly once.
- Prove blank response/supplementary cells become empty strings.
- Reject missing/unknown/duplicate criteria, altered read-only fields, wrong
  option/baseline/dossier metadata, extra sheet/column and unsupported values.
- Prove the codec exports no document, citation, assessment or option-identity
  fields.

Run:

```bash
node scripts/npm-run.js run test:run -- \
  src/lib/__tests__/technical-configuration-option-excel.test.ts
```

Expected RED: Vitest exits non-zero because the option workbook modules do not
exist.

### GREEN

- Reuse the P5A workbook load/create, worksheet conversion and Blob-compatible
  data structures.
- Keep option-specific schema and validation in the three new modules.
- Return canonical rows only; do not call RPCs or expose UI actions.

Run:

```bash
node scripts/npm-run.js run test:run -- \
  src/lib/__tests__/technical-configuration-option-excel.test.ts \
  src/lib/__tests__/technical-configuration-baseline-excel.test.ts \
  src/lib/__tests__/excel-workbook.test.ts \
  src/lib/__tests__/excel-template-generation.test.ts
```

Expected GREEN: all selected tests pass and Equipment/baseline Excel behavior is
unchanged.

### Exit Gate

Run:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
openspec validate add-technical-configuration-comparison \
  --type change --strict --no-interactive
```

Commit:

```bash
git add src/lib/technical-configuration-option-excel-contract.ts \
  src/lib/technical-configuration-option-excel-export.ts \
  src/lib/technical-configuration-option-excel-parse.ts \
  src/lib/__tests__/technical-configuration-option-excel.test.ts
git commit -m "feat: add supplier option workbook codec"
```

## P9A2 - Atomic Supplier Option Import Contracts

**Deploy boundary:** dormant authoritative preview/apply RPCs; no UI caller.

### Files

- Create:
  `supabase/migrations/<ordered_timestamp>_technical_configuration_option_import.sql`
- Create:
  `supabase/tests/technical_configuration_option_import_phase_gate.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-option-import-migration.test.ts`
- Create:
  `src/app/(app)/technical-configurations/technical-configuration-option-import-rpc.ts`
- Modify: `src/lib/technical-configuration-supplier-option-rpcs.ts`
- Modify:
  `src/app/(app)/technical-configurations/supplier-option-types.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify:
  `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

Before choosing the migration timestamp, compare every local migration touching
comparison sets, option responses, dossier revision guards or grants. The new
file must sort after the latest such migration.

### RED

- Freeze preview/apply signatures, `SECURITY DEFINER`, `search_path`, grants,
  RPC allowlist and typed wrappers.
- Prove raw `admin` and `global` succeed while missing/invalid claims fail
  closed.
- Prove preview creates no comparison set, response, revision or audit change.
- Reject archived, stale, wrong-option, wrong-baseline, malformed, tampered,
  missing, unknown and duplicate criterion requests with zero writes.
- Prove apply may create the comparison set, reconcile the complete snapshot,
  delete rows whose two canonical fields are empty and increment revision once.
- Inject a late failure and prove comparison-set creation plus all response
  changes roll back.
- Prove draft and locked baseline targets are accepted.

Run:

```bash
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/technical-configuration-option-import-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-option-responses-migration.test.ts \
  'src/app/(app)/technical-configurations/__tests__/supplier-option-contract.test.ts'
```

Expected RED: missing migration signatures, RPC names, wire types and allowlist
entries fail.

### GREEN

- Implement one internal server-side validator/normalizer used by both RPCs.
- Preview validates ownership and metadata without mutation.
- Apply takes the established dossier lock, revalidates under lock and performs
  one aggregate transaction.
- Use dossier revision as the only optimistic concurrency token.
- Keep option identity, baseline/reference data, evidence and assessments
  unchanged.

Run the same focused Vitest command. Expected GREEN: all selected tests pass.

Before either live write, ask one explicit question that names both operations:

> Việc này cần ghi vào live DB qua Supabase MCP. Anh có cho phép tôi apply chính
> xác migration P9A2 và sau đó execute
> `technical_configuration_option_import_phase_gate.sql` không?

After explicit approval only:

1. Apply the migration through Supabase MCP `apply_migration`.
2. Execute
   `supabase/tests/technical_configuration_option_import_phase_gate.sql`
   through Supabase MCP.
3. Run Supabase MCP security and performance advisors.
4. Reinspect function definitions, grants and table policies read-only.

### Exit Gate

Run:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
openspec validate add-technical-configuration-comparison \
  --type change --strict --no-interactive
```

The leaf is complete only when preview is side-effect-free, apply is atomic and
the application still has no import UI.

## P9A3 - Supplier Option Import Workspace

**Deploy boundary:** template download and import UI using the deployed P9A1/A2
contracts.

### Files

- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionImport.ts`
- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionImportDialog.tsx`
- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionImportPreview.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/option-import.test.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/use-technical-configuration-option-import.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponseEditor.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers.tsx`

### RED

- Prove download delegates to the P9A1 codec with exact option/baseline/revision.
- Prove local parse calls authoritative preview and performs no mutation.
- Prove apply is called exactly once and only after confirmation.
- Prove blank cells are presented as clears and a missing criterion blocks
  confirmation.
- Prove stale apply preserves file, canonical rows and preview, refreshes
  revision and re-previews before retry.
- Prove success adopts the complete returned snapshot and synchronizes
  response/dossier caches.
- Prove import pending/dirty state blocks identity, response and navigation
  mutations.
- Prove locked baseline remains editable and archived dossier is read-only.

Run:

```bash
node scripts/npm-run.js run test:run -- \
  'src/app/(app)/technical-configurations/__tests__/option-import.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/use-technical-configuration-option-import.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx'
```

Expected RED: option import hook/dialog/actions do not exist.

### GREEN

- Reuse `useBulkImportState`, `BulkImportDialogParts` and P5A Blob download
  primitives.
- Keep import actions in the exact-baseline response workspace, not the option
  identity editor.
- Keep file, rows, preview and errors transient.
- Route preview/apply only through the P9A2 wrapper.
- Propagate pending/dirty state through the existing external mutation-blocking
  contract.

Run:

```bash
node scripts/npm-run.js run test:run -- \
  'src/app/(app)/technical-configurations/__tests__/option-import.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/use-technical-configuration-option-import.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/baseline-import-dialog.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/use-technical-configuration-baseline-import.test.tsx' \
  'src/components/bulk-import/__tests__/useBulkImportState.test.tsx' \
  'src/components/bulk-import/__tests__/BulkImportDialogParts.test.tsx'
```

Expected GREEN: all option import and shared import regression tests pass.

### Exit Gate

Run the required TypeScript/React verification order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison \
  --type change --strict --no-interactive
```

TC-10 may be marked complete only after P9A1, P9A2 and P9A3 focused gates all
pass together.

## P9B1 - Supplier Option Evidence Contracts

**Deploy boundary:** dormant option document/citation schema and RPCs; no UI
consumer.

### Files

- Create:
  `supabase/migrations/<ordered_timestamp>_technical_configuration_option_evidence.sql`
- Create:
  `supabase/tests/technical_configuration_option_documents_phase_gate.sql`
- Create:
  `src/app/api/rpc/__tests__/technical-configuration-option-documents-migration.test.ts`
- Modify: `src/lib/technical-configuration-document-rpcs.ts`
- Modify:
  `src/app/(app)/technical-configurations/document-types.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-document-rpc.ts`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify:
  `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

Before naming the migration, compare it with every local migration that defines
the shared URL validator, baseline/reference evidence, comparison sets, option
responses, grants or dossier revision guards.

### RED

- Freeze option document and citation tables, composite ownership/version FKs,
  indexes, RLS, grants and six RPC signatures.
- Prove option documents belong to `option_id` and are reused across baseline
  versions.
- Prove citations require the matching option/baseline comparison set and exact
  criterion.
- Prove one option document can own independent citations for multiple criteria
  without duplicating the document record.
- Prove list is side-effect-free and returns shared documents, exact-set
  citations and total affected citation counts across all baselines.
- Prove create/update are the only new callers of the P7B1 URL validator,
  increasing the exact caller set from four to six.
- Prove confirmed document delete cascades all linked citations atomically and
  failure injection rolls back.
- Prove locked baseline mutation succeeds, archived dossier mutation fails and
  stale dossier revision performs zero writes.

Run:

```bash
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/technical-configuration-option-documents-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-baseline-documents-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-document-rpc.test.ts'
```

Expected RED: option evidence schema, RPCs and exact-six-caller contract are
absent.

### GREEN

- Reuse the P7B1 authorization, dossier revision and URL validation contracts.
- Store document metadata once per option.
- Scope citation rows through the exact comparison set and criterion.
- Keep list/open paths read-only and return `data: null` citations when no
  comparison set exists.
- Delete one option document and all linked citations in one transaction after
  the caller supplies confirmed intent.

Run the same focused Vitest command. Expected GREEN: all selected source and
contract tests pass.

Before live writes, request explicit permission that names the exact P9B1
migration plus both phase-gate executions.
After approval only:

1. Apply through Supabase MCP.
2. Execute
   `supabase/tests/technical_configuration_option_documents_phase_gate.sql`.
3. Rerun
   `supabase/tests/technical_configuration_baseline_documents_phase_gate.sql`.
4. Run security and performance advisors.
5. Inspect `pg_get_functiondef` and prove exactly six create/update callers and
   zero list/delete/citation callers.

### Exit Gate

Run:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
openspec validate add-technical-configuration-comparison \
  --type change --strict --no-interactive
```

P9B1 does not complete TC-11 or TC-12 because no option evidence UI exists.

## P9B2 - Supplier Option Evidence Workspace

**Deploy boundary:** option URL document and citation UI; normative TC-11/TC-12
completion.

### Files

- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionDocuments.ts`
- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionDocuments.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/option-evidence.test.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/option-evidence-delegation.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponseEditor.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers.tsx`
- Modify:
  `src/components/url-documents/__tests__/url-document-source-contract.test.ts`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/baseline-evidence.test.tsx`

### RED

- Prove opening/listing evidence creates no comparison set or revision change.
- Prove one option document renders across multiple baseline selections while
  citations remain exact-set scoped.
- Prove one option document renders independent citations for multiple criteria
  without duplicating the document.
- Prove first citation save follows comparison-set get-or-create, adopts the new
  revision, then performs citation upsert.
- Prove URL create/update/list/render preserves exact accepted raw values.
- Prove deletion displays the total affected citation count and does not mutate
  before confirmation.
- Prove confirmed delete removes the document/citations and rejected delete can
  retry without losing local state.
- Prove stale conflicts preserve unsaved document/citation input.
- Prove evidence pending/dirty state blocks identity/response mutations and
  navigation.
- Prove locked baseline remains editable and archived dossier is read-only.
- Prove the cumulative shared consumer manifest is exactly Equipment + baseline
  - option and runtime callbacks use the shared primitives.

Run:

```bash
node scripts/npm-run.js run test:run -- \
  'src/app/(app)/technical-configurations/__tests__/option-evidence.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/option-evidence-delegation.test.tsx' \
  'src/components/url-documents/__tests__/url-document-source-contract.test.ts'
```

Expected RED: option evidence hook/component and cumulative consumer entry are
absent.

### GREEN

- Add an option-specific evidence hook; do not add option branches to the
  baseline/reference hook.
- Compose the existing `UrlDocumentForm`, `UrlDocumentList`, URL utility and
  owner-neutral citation editor.
- Keep list/open read-only and create a comparison set only in the explicit
  first-citation save chain.
- Preserve dirty input through conflicts and route all mutations through the
  P9B1 wrappers.
- Use the returned total affected count in the confirmation dialog.

Run:

```bash
node scripts/npm-run.js run test:run -- \
  'src/app/(app)/technical-configurations/__tests__/option-evidence.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/option-evidence-delegation.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/baseline-evidence.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/supplier-options.test.tsx' \
  'src/components/url-documents/__tests__/url-document-utils.test.ts' \
  'src/components/url-documents/__tests__/UrlDocumentForm.test.tsx' \
  'src/components/url-documents/__tests__/UrlDocumentList.test.tsx' \
  'src/components/url-documents/__tests__/url-document-source-contract.test.ts' \
  'src/app/(app)/equipment/__tests__/equipment-detail-files-tab.test.tsx' \
  'src/app/(app)/equipment/__tests__/equipment-detail-files-tab-delegation.test.tsx'
```

Expected GREEN: option, baseline/reference and Equipment URL-document suites pass
together.

### Exit Gate

Run the full required TypeScript/React order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison \
  --type change --strict --no-interactive
```

After fresh explicit permission naming both exact SQL phase-gate executions,
rerun the P9B1 and baseline document gates against the deployed schema. Without
that permission, do not execute them and report live verification as pending.
TC-11-S01..S05 and TC-12-S01/S02 complete only when DB/source, shared
primitives, Equipment, baseline/reference and option evidence tests all pass in
the same leaf.

## Per-Leaf Completion

Before each commit and push:

1. Run the leaf's focused RED/GREEN and regression gates through context-mode.
2. Run Code Review Graph change detection and GitNexus impact on risky changed
   symbols.
3. Invoke `requesting-code-review` and resolve findings with actual behavioral
   value.
4. Run `git pull --rebase`, push the branch and verify `git status` reports the
   branch is up to date with origin.
5. Merge only after the leaf's deploy boundary is independently safe; start the
   next leaf from the updated `main`.
