# P3D TDD Plan - Hierarchical Import UX

## Goal

Implement Issue #886 as a dormant client workflow that accepts canonical legacy
and XLSX v2 baseline workbooks, renders the authoritative hierarchy replacement
preview, and preserves import state across revision conflicts. The workflow must
remain unreachable from the production baseline screen until P6B.

## Preflight

- clean `main` baseline: `b959e1b84975c84c28abf6750348aa435c938b28`;
- implementation branch: `feat/p3d-hierarchical-import-ux`;
- dependency RPCs and workbook modules from P2B, P3B, and P3C are present on
  `main`;
- GitNexus matched `b959e1b8` at preflight and was reindexed against the final
  staged P3D diff before review;
- no migration, generated database type, Supabase CLI command, or live database
  read/write is needed for this client-only leaf.

## Scope Decisions

### Keep the production v1 workflow unchanged

`TechnicalConfigurationBaselineTab` currently mounts the legacy import hook and
dialog. Changing that hook to accept XLSX v2 would make the new path reachable
before activation. P3D therefore adds a separate hierarchy import hook and
dialog, following the dormant-component boundary established by P3C.

### Use one compatible parser boundary

The dormant hook calls
`parseTechnicalConfigurationBaselineWorkbookFile()` with the selected decoded
hierarchy:

- `format: "v2"` rows map directly to the v2 preview/apply request shape;
- `format: "legacy"` groups map to main sections and criteria map to direct
  children, with no subgroup invented;
- compatible legacy identities are enriched from the selected hierarchy by
  group order and criterion code before the authoritative v2 preview.

The client only adapts the parser result to the existing server contract. The
server remains authoritative for metadata, identity, hierarchy, effects, and
revision validation.

### Preserve conflict evidence

A revision conflict marks the current preview stale and refreshes the selected
version, but does not clear:

- the selected file;
- the compatible parser result;
- the normalized preview rows;
- the authoritative counts and effects.

Reset or a successful preview of a newly selected replacement workbook clears
the stale guard. While that replacement workbook is parsing or previewing, the
conflicted file, parsed result, and authoritative preview remain visible; they
are replaced atomically only after the new server preview succeeds. The client
must never rewrite hidden workbook revision metadata to force a re-preview.

Successful apply adopts the returned decoded snapshot, then closes and resets
the workflow. That success path is tested only as the client contract expected
after P6A activates the already-defined RPC. The current public RPC must remain
fail-closed with `hierarchical_import_apply_not_activated`, and P3D also tests
that this response preserves the selected file and preview without mutating
client caches.

### Render bounded complete previews

The preview renders:

- main-section, subgroup, and criterion counts;
- create, update, move, and delete counts for each entity kind;
- explicit full-replacement and deletion confirmation wording;
- physical-row parser and server errors;
- the complete normalized hierarchy in a definite-height scroll region.

The existing 5 MiB and 5,000 meaningful-row parser limits remain the safety
boundary. The UI does not truncate accepted previews.

## File Ownership

Create:

- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import.test.tsx`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-fixtures.tsx`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-lifecycle.test.tsx`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-large-preview.test.tsx`
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-production-isolation.test.tsx`
- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineHierarchyImportDialog.tsx`
- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineHierarchyImportPreview.tsx`
- `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineHierarchyImport.ts`
- `src/app/(app)/technical-configurations/technical-configuration-baseline-hierarchy-import.ts`
- `src/app/(app)/technical-configurations/technical-configuration-baseline-hierarchy-import-types.ts`
- `src/lib/technical-configuration-baseline-excel-rows.ts`

Modify:

- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab-fixtures.tsx`
- `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline.ts`
- `src/lib/__tests__/technical-configuration-baseline-excel-v2-parse-limits.test.ts`
- `src/lib/technical-configuration-baseline-excel-parse.ts`
- `src/lib/technical-configuration-baseline-excel-v2-parse-contract.ts`
- `src/lib/technical-configuration-baseline-excel-v2-parse-file.ts`
- `src/lib/technical-configuration-baseline-excel-validation.ts`
- `openspec/changes/revise-technical-configuration-baseline-hierarchy/tasks.md`

Do not modify:

- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx`
- the existing production v1 import hook/dialog;
- SQL migrations, Supabase tests, generated database types, or live database
  state;
- P4+ components, editor state, hierarchy authoring, activation, comparison,
  evaluation, or export surfaces.

## TDD Slices

### Slice 1 - Compatible file and authoritative preview

For each behavior below: add one RED assertion, run it and verify the expected
failure, add only the minimum GREEN implementation, then rerun before moving to
the next behavior.

1. Render the dormant dialog, assert `.xlsx`-only input, upload a v2 workbook
   result, and expect the compatible parser plus v2 preview RPC arguments.
2. Upload a legacy result and expect it to map to main sections plus direct
   criteria without a subgroup.
3. Make the compatible parser reject `.xls`, `.csv`, and files over 5 MiB;
   assert the dialog shows the parser's `.xlsx`/limit guidance and never calls
   preview or apply. Do not duplicate parser file validation in the hook.

### Slice 2 - Hierarchy, effects, errors, and confirmation

For each behavior: RED, verify the expected failure, implement the minimum
GREEN, and rerun.

1. Make parser output differ from server-normalized output, then assert that the
   UI renders only the server hierarchy, counts, create/update/move/delete
   effects, and physical-row errors.
2. Assert explicit full-replacement wording and exact deletion totals before
   confirmation.
3. Assert server preview errors disable confirmation and prevent apply.

### Slice 3 - Apply, cache adoption, locks, and conflicts

For each behavior: RED, verify the expected failure, implement the minimum
GREEN, and rerun.

1. Prove preview never persists and apply is called only after explicit
   confirmation.
2. Mock the post-P6A success response and prove the client adopts the decoded
   snapshot and resets the workflow without changing server activation.
3. Reject the current stable `hierarchical_import_apply_not_activated` response
   while preserving file and preview state and leaving cache adoption untouched.
4. Prove locked targets do not render an actionable import workflow.
5. Prove apply/preview revision conflicts preserve file, parsed result,
   normalized preview, and effects while disabling re-apply.
6. After the parent supplies a refreshed selected version, select a replacement
   workbook whose own metadata carries the new revision. Keep the conflicted
   file and preview visible while the new parser/server preview is pending,
   replace them only on success, and require confirmation again. Never rewrite
   the old workbook metadata in the client.
7. Prove reset clears the preserved conflict state.

### Slice 4 - Large preview and production isolation

For each behavior: RED, verify the expected failure, implement the minimum
GREEN, and rerun.

1. Render a safety-bound preview and assert the first and last normalized rows
   remain reachable through pagination without truncation.
2. Render the production baseline tab and assert the dormant hierarchy import
   control/dialog is absent and v2 preview/apply RPCs are not called.

Keep every new production source file below 350 lines. Keep the main focused
test and its fixture module below 350 lines each. Split behavior groups again if
either file approaches the extraction threshold.

## Verification

Run the focused RED and GREEN command after each slice:

```bash
node scripts/npm-run.js exec vitest run \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-lifecycle.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-large-preview.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-production-isolation.test.tsx"
```

Then run the required chain in this order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js exec vitest run \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-lifecycle.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-large-preview.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-production-isolation.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/baseline-import-dialog.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-baseline-import.test.tsx" \
  "src/lib/__tests__/technical-configuration-baseline-excel-v2-parse.test.ts" \
  "src/lib/__tests__/technical-configuration-baseline-excel-v2-parse-identity.test.ts" \
  "src/lib/__tests__/technical-configuration-baseline-excel-v2-parse-limits.test.ts"
node scripts/npm-run.js exec vitest run \
  "src/app/(app)/technical-configurations/__tests__"
node scripts/npm-run.js run react-doctor
openspec validate revise-technical-configuration-baseline-hierarchy --strict
```

## TDD Evidence

Observed RED before the corresponding minimum implementation:

- missing dormant hook, dialog, adapter, and preview modules;
- v2 compatible-parser routing and RPC arguments;
- legacy main-section/direct-criterion mapping;
- parser-owned `.xls`, `.csv`, and 5 MiB rejection guidance;
- authoritative server hierarchy, effects, and physical-row errors;
- invalid authoritative previews with null effects render actionable errors
  without exposing destructive confirmation;
- compatible legacy physical-row preservation when worksheet rows contain blank
  or whitespace-only gaps;
- explicit full-replacement/deletion confirmation, including confirmation lockout
  while preview errors remain;
- no persistence before confirmation and mocked post-activation cache adoption;
- fail-closed apply, locked target, stale evidence preservation, and atomic
  replacement preview;
- failed replacement parsing keeps prior evidence visible but stale and
  non-applicable;
- duplicate-apply prevention after a successful server mutation followed by
  cache-adoption failure;
- 100-row pagination with the final row reachable and immediate navigation after
  a replacement preview shrinks the page count.

The reset and production-isolation assertions characterized already-correct
dormant behavior and passed on first execution. Focused P3D tests finish at 21
passing tests across four files. The focused plus legacy import/parser set
finishes at 59 passing tests across nine files, and the complete technical
configuration suite finishes at 746 passing tests across 88 files.

Before commit:

- run Code Review Graph change detection and GitNexus impact;
- run independent subagent review until zero findings;
- mark only P3D tasks complete;
- commit and push the feature branch through enabled Lefthook hooks;
- do not open or merge a pull request, and do not close Issue #886 before the
  user reviews the result.

## Completion Boundary

P3D is complete when the hierarchy import workflow is testable by direct module
rendering, supports both compatible workbook formats, displays the full
authoritative destructive preview, preserves conflict evidence, and implements
the mocked client success contract for later activation, while:

- the production baseline screen still exposes only the existing v1 import;
- no XLSX v2 apply call is reachable from production;
- the current server-side not-activated response remains an expected,
  state-preserving failure;
- P4+ and activation work remains untouched;
- no migration or live database write occurs.
