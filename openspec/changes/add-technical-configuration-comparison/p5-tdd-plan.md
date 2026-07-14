# P5 TDD Plan - Shared Excel Reuse And Atomic Baseline Import

> **For agentic workers:** REQUIRED: Use `superpowers:test-driven-development` for every behavior slice and `superpowers:verification-before-completion` before any completion claim. Execute P5A, P5B, P5C and P5D as separate sequential PRs.

## Goal

Deliver the baseline Excel workflow without duplicating the Equipment Excel pipeline, while adding an authoritative preview and one atomic backend apply boundary for the complete baseline draft.

## Scope Boundary

- Implement only OpenSpec phases P5A through P5D.
- P5A is a shared refactor with no new technical-configuration behavior.
- P5B owns only the baseline workbook contract, generator, parser and canonical row model.
- P5C owns authoritative preview and atomic persistence.
- P5D owns the draft-only user workflow and cache synchronization.
- Do not add P6 URL documents, P7 reference products, P8 supplier data, P9 option Excel or later evaluation behavior.
- Do not apply any migration to live Supabase without explicit permission for that specific write.

## Approved Reuse Decisions

- Reuse the Equipment Excel pipeline as the source of shared workbook, download and import-state behavior.
- Extract workbook creation/loading, worksheet conversion and Blob download from `excel-utils.ts`; keep compatibility exports.
- Keep `exportToExcel` as the flat visible-sheet export API. Do not add baseline-specific flags.
- Extend `useBulkImportState` with an optional custom workbook parser. Existing first-sheet/header-map behavior remains the default.
- Reuse `BulkImportDialogParts` for file input, parse errors, row errors and submit state.
- Add only baseline-specific workbook schema, parser and validation under the technical-configuration codec.
- Do not copy the Equipment validation, column mapping, filters or persistence RPCs into P5B-P5D.

## Approved Import Contract

- `technical_configuration_baseline_import_preview` and `technical_configuration_baseline_import_apply` accept the same metadata, canonical rows and expected revision.
- Both RPCs call one internal server-side validator/normalizer.
- Preview is read-only and returns canonical rows, provisional codes and row-level errors.
- Apply revalidates under the established dossier-row then baseline-row lock order.
- Existing criterion codes retain criterion IDs and `source_criterion_id`.
- New criterion rows have blank codes and receive codes from `next_criterion_number` during apply.
- Apply reconciles the complete group/criterion tree, increments revision once and rolls back every change on failure.
- P5D never persists through sequential group/criterion CRUD RPCs.
- Import file, parsed rows, preview and errors remain transient client state.

## P5A Planned Files

- Create: `src/lib/excel-workbook.ts`
- Create: `src/lib/__tests__/excel-workbook.test.ts`
- Create: `src/components/bulk-import/__tests__/useBulkImportState.test.tsx`
- Modify: `src/lib/excel-utils.ts`
- Modify: `src/components/bulk-import/useBulkImportState.ts`
- Modify: `src/components/bulk-import/bulk-import-types.ts`
- Modify: `src/app/(app)/equipment/_hooks/useEquipmentExport.ts`
- Verify: `src/lib/__tests__/excel-template-generation.test.ts`
- Verify: `src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts`
- Verify: `src/components/__tests__/import-equipment-dialog.test.tsx`
- Verify: `src/components/__tests__/import-equipment-dialog.integration.test.tsx`

## Task 1 - Freeze Equipment Excel Behavior

- [ ] Write or strengthen tests for Equipment template filename, workbook shape and Blob download cleanup.
- [ ] Lock filtered Equipment export mapping, filename and `exportToExcel` invocation.
- [ ] Lock import file selection, first-sheet parsing, validation errors and submit behavior.
- [ ] Add failing tests for the new custom workbook parser option while proving the default path is unchanged.
- [ ] Run the focused Equipment and bulk-import tests and confirm RED only for the missing shared seams.

## Task 2 - Extract Shared Excel Primitives

- [ ] Move generic ExcelJS workbook creation/loading and worksheet conversion into `excel-workbook.ts`.
- [ ] Export one shared Blob download helper with object-URL cleanup.
- [ ] Re-export moved APIs from `excel-utils.ts` so existing imports remain valid.
- [ ] Change Equipment template download to the shared Blob helper without changing behavior.
- [ ] Add the custom workbook parser option to `useBulkImportState`.
- [ ] Keep the existing header-map parser as the backward-compatible default.
- [ ] Run focused P5A tests and confirm GREEN.
- [ ] Run `@code-deduplication` and document why no parallel helper remains.

## P5B Planned Files

- Create: `src/lib/technical-configuration-baseline-excel-contract.ts`
- Create: `src/lib/technical-configuration-baseline-excel-export.ts`
- Create: `src/lib/technical-configuration-baseline-excel-parse.ts`
- Create: `src/lib/__tests__/technical-configuration-baseline-excel.test.ts`
- Reuse: `src/lib/excel-workbook.ts`

## Task 3 - Freeze The Baseline Workbook Contract

- [ ] Write failing tests for exactly one visible `Baseline` sheet and one hidden `_meta` sheet.
- [ ] Freeze exact metadata keys, template version and visible column order.
- [ ] Write failing tests for four suggested groups plus add/rename/remove/reorder behavior through rows.
- [ ] Write failing tests for existing read-only codes and blank new codes.
- [ ] Write malformed, extra-sheet, extra-column, wrong-version, duplicate-code, Unicode and multiline tests.
- [ ] Run the focused codec test and confirm RED for the missing P5B implementation.

## Task 4 - Implement The Baseline Workbook Codec

- [ ] Add small contract/types, export and parse modules rather than one file above the repository size ceiling.
- [ ] Generate the workbook through P5A workbook primitives.
- [ ] Parse through the `useBulkImportState` custom-parser-compatible contract.
- [ ] Validate workbook structure and produce canonical rows independent of React.
- [ ] Keep authoritative code allocation and persistence outside P5B.
- [ ] Run focused codec tests and confirm GREEN.

## P5C Planned Files

- Create: a migration under `supabase/migrations/` with suffix `_technical_configuration_baseline_import.sql`; choose its numeric timestamp at P5C execution time after checking every local migration that touches the same functions, tables, grants or policies
- Create: `src/app/api/rpc/__tests__/technical-configuration-baseline-import-migration.test.ts`
- Create: `supabase/tests/technical_configuration_baseline_import_phase_gate.sql`
- Modify: `src/lib/technical-configuration-baseline-rpcs.ts`
- Modify: `src/app/(app)/technical-configurations/baseline-types.ts`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline.ts`
- Modify: `src/app/(app)/technical-configurations/__tests__/baseline-contract.test.ts`
- Modify: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`

## Task 5 - Freeze Authoritative Preview And Apply

- [ ] Write failing migration tests for both RPC signatures, grants, `SECURITY DEFINER` and `search_path`.
- [ ] Write failing tests proving preview and apply use the same canonical validator output.
- [ ] Write trust-boundary tests proving both RPCs reject wrong template kind/version, mismatched dossier/version/revision metadata, malformed payloads and tampered canonical rows.
- [ ] Write role/claim, archived, locked and stale-revision negative tests.
- [ ] Write success tests for complete-tree create/update/delete/reorder reconciliation, immutable existing codes, preserved criterion identity, exactly one revision increment and exact `next_criterion_number` advancement for new rows only.
- [ ] Write partial-failure tests proving groups, criteria, numbering and revision all roll back.
- [ ] Run focused migration contract tests and confirm RED.

## Task 6 - Implement Atomic Import Persistence

- [ ] Add one internal validator/normalizer used by preview and apply.
- [ ] Reuse current auth/editable-version helpers and lock order.
- [ ] Keep preview read-only.
- [ ] Revalidate apply under row locks before mutation.
- [ ] Reconcile the complete baseline tree and increment revision once.
- [ ] Return the complete updated baseline snapshot.
- [ ] Keep grants fail-closed and allowlist only the two P5C RPCs.
- [ ] Run migration contract tests and confirm GREEN.
- [ ] Request explicit approval before any live migration apply.
- [ ] After approved apply, run the P5C phase gate and Supabase security/performance advisors.

## P5D Planned Files

- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineImport.ts`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineImportDialog.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineImportPreview.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/baseline-import-dialog.test.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/use-technical-configuration-baseline-import.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationVersionBar.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineAlerts.tsx`

## Task 7 - Freeze The Draft-Only Import Workflow

- [ ] Write failing tests proving import actions render only for the selected draft.
- [ ] Prove template download delegates to the P5B generator and P5A Blob helper without parallel object-URL logic.
- [ ] Write failing tests for shared file input, parser lifecycle and authoritative preview rendering.
- [ ] Prove no persistence occurs before explicit confirmation.
- [ ] Prove success invokes one apply RPC and no sequential CRUD RPC.
- [ ] Prove returned snapshot/revision/history caches synchronize after success.
- [ ] Prove stale apply preserves file, canonical rows and preview while refreshing current revision.
- [ ] Prove unresolved transient import state blocks lock UI without adding persisted import-error data.
- [ ] Run focused P5D tests and confirm RED.

## Task 8 - Implement The Import Workflow

- [ ] Add a dedicated import hook rather than growing the baseline lifecycle hook.
- [ ] Compose the dialog from P5A shared bulk-import parts.
- [ ] Wire template download through the P5B generator and P5A shared Blob helper.
- [ ] Call P5C preview after P5B parse succeeds.
- [ ] Require confirmation before atomic apply.
- [ ] Adopt the returned snapshot and synchronize caches.
- [ ] Preserve local import state on stale conflict.
- [ ] Clear transient state only after success, explicit reset or dialog dismissal.
- [ ] Run focused P5D tests and confirm GREEN.

## Task 9 - Verification And Delivery

### P5A PR gate

- [ ] Run `node scripts/npm-run.js run format:check`, `node scripts/npm-run.js run verify:no-explicit-any`, `node scripts/npm-run.js run verify:dedupe` and `node scripts/npm-run.js run typecheck`.
- [ ] Run `node scripts/npm-run.js run test:run -- src/lib/__tests__/excel-workbook.test.ts src/components/bulk-import/__tests__/useBulkImportState.test.tsx src/components/bulk-import/__tests__/BulkImportDialogParts.test.tsx src/lib/__tests__/excel-template-generation.test.ts src/components/__tests__/import-equipment-validation.test.ts src/components/__tests__/import-equipment-dialog.test.tsx src/components/__tests__/import-equipment-dialog.integration.test.tsx "src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts"`.
- [ ] Run `node scripts/npm-run.js run react-doctor`, Code Review Graph change detection, GitNexus impact and `@code-deduplication` for the extracted shared symbols.
- [ ] Confirm Equipment behavior is unchanged before starting P5B.
- [ ] Update only P5A tasks, then commit, pull with rebase, push and open the P5A PR before starting P5B.

### P5B PR gate

- [ ] Run `node scripts/npm-run.js run format:check`, `node scripts/npm-run.js run verify:no-explicit-any`, `node scripts/npm-run.js run verify:dedupe` and `node scripts/npm-run.js run typecheck`.
- [ ] Run `node scripts/npm-run.js run test:run -- src/lib/__tests__/technical-configuration-baseline-excel.test.ts`.
- [ ] Run Code Review Graph change detection, GitNexus impact and `@code-deduplication` for the baseline codec.
- [ ] Confirm P5B has no DB mutation or user-facing activation before starting P5C.
- [ ] Update only P5B tasks, then commit, pull with rebase, push and open the P5B PR before starting P5C.

### P5C PR gate

- [ ] Run `node scripts/npm-run.js run format:check`, `node scripts/npm-run.js run verify:no-explicit-any`, `node scripts/npm-run.js run verify:dedupe` and `node scripts/npm-run.js run typecheck`.
- [ ] Run `node scripts/npm-run.js run test:run -- src/app/api/rpc/__tests__/technical-configuration-baseline-import-migration.test.ts src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts "src/app/(app)/technical-configurations/__tests__/baseline-contract.test.ts"`.
- [ ] Run `node scripts/npm-run.js run react-doctor`, Code Review Graph change detection and GitNexus impact for the RPC wrapper and baseline hook changes.
- [ ] After explicit live-DB approval and migration apply, run `supabase/tests/technical_configuration_baseline_import_phase_gate.sql` through Supabase MCP plus security/performance advisors.
- [ ] Confirm P5C is additive and unused by UI before starting P5D.
- [ ] Update only P5C tasks, then commit, pull with rebase, push and open the P5C PR before starting P5D.

### P5D PR gate

- [ ] Run `node scripts/npm-run.js run format:check`, `node scripts/npm-run.js run verify:no-explicit-any`, `node scripts/npm-run.js run verify:dedupe` and `node scripts/npm-run.js run typecheck`.
- [ ] Run `node scripts/npm-run.js run test:run -- "src/app/(app)/technical-configurations/__tests__/baseline-import-dialog.test.tsx" "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-baseline-import.test.tsx" "src/app/(app)/technical-configurations/__tests__/baseline-locking.test.tsx"`.
- [ ] Run `node scripts/npm-run.js run react-doctor`, Code Review Graph change detection and GitNexus impact for the import workflow.
- [ ] Confirm one preview RPC and one apply RPC are used, with no sequential CRUD persistence.
- [ ] Update only P5D tasks, then commit, pull with rebase, push and open the P5D PR.
