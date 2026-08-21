# Portable Technical Configuration Blank Template Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a V2 blank-template workbook downloaded from one technical-configuration dossier to initialize a newly created dossier without weakening foreign-identity protection.

**Architecture:** Keep the server contract unchanged. The existing pure hierarchy-import adapter will classify only V2 workbooks whose imported rows contain no group, subgroup, criterion, or criterion-code identity as portable content-only workbooks, then replace their dossier/version/revision metadata with the selected target draft. Workbooks containing any identity remain source-bound and continue through the existing server rejection path.

**Tech Stack:** TypeScript, React Testing Library, Vitest, ExcelJS workbook codec

---

## Chunk 1: Lock The Portable V2 Contract

### Task 1: Add byte-level and adapter regressions

**Files:**

- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import.test.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-blank-template-portability.test.ts`

- [x] Add the UI regression that expects a content-only V2 workbook to use target metadata.
- [x] Add a real XLSX round-trip test that serializes a blank template from dossier A, enters new rows with no hidden identity, parses it against an empty target hierarchy, and verifies the resulting RPC payload uses target metadata.
- [x] Add table-driven negative adapter assertions for mixed content-only rows plus each supported identity form: group ID, subgroup ID, and criterion ID/code.
- [x] Assert every identity-bearing case preserves the source dossier/version/revision metadata.
- [x] Run the focused tests and verify the portable case fails because source metadata is still forwarded.

Run:

```bash
node scripts/npm-run.js run test:run -- \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-blank-template-portability.test.ts'
```

Expected: the new portable-import assertion fails with source dossier/version/revision metadata; all unrelated cases pass.

## Chunk 2: Rebind Only Content-Only V2 Workbooks

### Task 2: Implement the minimal pure adapter change

**Files:**

- Modify: `src/app/(app)/technical-configurations/technical-configuration-baseline-hierarchy-import.ts`

- [x] Add a private predicate that returns true only for V2 rows with all identity fields null.
- [x] For that case only, build template metadata from the selected target draft while preserving template kind, version, and generated timestamp.
- [x] Leave legacy V1 and any V2 workbook containing identity unchanged.
- [x] Run the focused tests and verify they pass.

## Chunk 3: Restore V2 Criterion-Title Round Trips

### Task 3: Accept exported STT titles without trusting hidden title data

**Files:**

- Modify: `src/lib/technical-configuration-baseline-excel-v2-parse-rows.ts`

- [x] Reproduce the two V2 round-trip failures caused by exported criterion titles in the STT column.
- [x] Use hidden `criterion_title` only as a row-classification hint.
- [x] Continue returning criterion titles from `existingHierarchy`; a new criterion with cleared identity must return a null title.
- [x] Preserve unsupported-marker, wrong-identity-kind, and foreign-identity behavior.
- [x] Run every `technical-configuration-baseline-excel-v2-*` test file and verify all pass.

## Chunk 4: Verify And Land

### Task 4: Run repository gates and publish the branch

**Files:**

- Verify all changed files.

- [x] Run `format:check`.
- [x] Run `verify:no-explicit-any`.
- [x] Run `verify:dedupe`.
- [x] Run `typecheck`.
- [x] Run both focused Vitest files.
- [x] Run `src/app/api/rpc/__tests__/technical-configuration-baseline-import-migration.test.ts` to preserve the server-side metadata mismatch contract.
- [x] Run `react-doctor`.
- [x] Review the final diff and affected flows.
- [x] Commit without bypassing Lefthook.
- [x] Pull with rebase, push, and verify the branch is up to date with origin.
