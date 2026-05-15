# Issue 474 React Doctor P4 knip/types TDD Plan

> For agentic workers: REQUIRED: use a TDD loop. Add or tighten the source-level guard first, verify RED, then remove or justify only the targeted `knip/types` symbols.

**Goal:** Resolve or explicitly justify the current `knip/types` findings from Issue #474 without touching `knip/files` or `knip/exports` scope.

**Architecture:** Treat this as a TypeScript public-surface cleanup, not a behavior refactor. Use `knip --reporter symbols` for the current inventory, Code Review Graph/GitNexus plus source search for dependency checks, and focused Vitest/source assertions to prevent false positives and missed module-boundary contracts.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, React Doctor, knip via `npx`, Code Review Graph, GitNexus.

---

## Summary

Issue #474 is the Phase 3 child issue split from #457. The current focused command showed `89` `knip/types` findings across `45` files. Do not rerun the React Doctor full scan for this task; use the existing full-scan result as context and only run the final React Doctor diff against `main`.

Primary rule: clean real unused types, but keep intentional public contracts or ambient/module-boundary types only when there is explicit rationale and the narrowest practical guard.

## Scope Lock

In scope:

- Run `node scripts/npm-run.js npx -y knip --reporter symbols` to capture the current `knip/types` inventory.
- Group findings by file/module and clean in small batches.
- Delete truly unused local types/interfaces.
- Convert exported local-only types to non-exported local declarations.
- Preserve intentional public contracts with explicit rationale in the new source test.

Out of scope:

- `knip/files` Phase 1 cleanup from #457.
- `knip/exports` Phase 2 cleanup.
- Any React Doctor full scan.
- Runtime behavior refactors unrelated to type-surface cleanup.

## Current Evidence

- Issue #474 acceptance criteria require resolving or justifying current `knip/types`, plus `verify:no-explicit-any`, `typecheck`, focused tests, and React Doctor diff.
- Parent #457 warns that this repo has `.types.assert.ts` and `.typecheck.ts` files referenced by TypeScript project inclusion rather than direct imports.
- `react-doctor.config.json` already ignores intentional Phase 1 file-level false positives.
- Existing source guards:
  - `src/__tests__/react-doctor-p4-knip-files-config.source.test.ts`
  - `src/__tests__/react-doctor-p4-knip-exports.source.test.ts`
- `tsconfig.json` includes `**/*.ts` and `**/*.tsx`, so type assertion files may be real even if knip cannot see imports.
- Git status at planning time was clean on `main...origin/main`.

## Candidate Groups

Start from the latest `knip --reporter symbols` output. The planning pass grouped the current `89` findings into these high-signal areas:

- Barrel/public-surface types: `src/components/bulk-import/index.ts`, `src/components/equipment-linked-request/index.ts`.
- Shared AI/tool contracts: `src/lib/ai/tools/tool-response-envelope.ts`, `src/lib/ai/tools/query-catalog.ts`, `src/lib/ai/tools/registry.ts`, `src/lib/ai/config.ts`.
- Report type contracts: `src/app/(app)/reports/hooks/use-maintenance-data.types.ts`, `src/app/(app)/reports/hooks/use-unused-equipment-report.ts`.
- Transfer/api contracts: `src/app/api/transfers/legacy-adapter.ts`, transfer filter/panel/data-grid type files.
- Shared app/domain types: `src/types/database.ts`, `src/types/tenant.ts`, `src/hooks/use-dashboard-stats.ts`.
- Component-local props/types: UI primitives, category/quota components, equipment detail, repair request columns, change history, KPI, chart utilities.

Important guard: any source search/counting must exclude `.worktrees`, `.next`, `node_modules`, `coverage`, and `dist`.

## TDD Rule For This Plan

Because this cleanup removes unused type exports rather than changing user-visible behavior, use a source-level TDD loop:

- RED: add or tighten `src/__tests__/react-doctor-p4-knip-types.source.test.ts` so it fails while current unwanted type exports remain.
- VERIFY RED: run only that focused test and confirm the failure is about a still-exported or still-declared target type.
- GREEN: make the smallest source edit for that batch.
- VERIFY GREEN: rerun the focused source test and `typecheck`.
- REFACTOR: only after green, clean redundant local type code if it is still dead.

Accepted implementation outcomes per symbol:

- No usage: delete the type/interface.
- Only local usage in the same file: remove the export, keep the local type.
- Public/module contract: keep exported and list under `intentionalPublicTypes` with a concrete reason.
- Ambient/typecheck assertion dependency: preserve and document why knip is a false positive.

Rejected shortcuts:

- Removing first and calling later checks "TDD".
- Adding broad ignores to `react-doctor.config.json` for normal source symbols.
- Trusting graph output alone when source search or TypeScript project inclusion disagrees.
- Counting usages from `.worktrees`.

## Implementation Tasks

### Task 1: Freeze Current Inventory

- Run:
  - `node scripts/npm-run.js npx -y knip --reporter symbols`
- Parse only `type` and `interface` findings.
- Group by file and compare with the candidate groups above.
- If the count is no longer `89`, update the source test inventory to the current command output and note the new count in the PR description.

### Task 2: Add Source Guard

- Add `src/__tests__/react-doctor-p4-knip-types.source.test.ts`.
- Mirror the style of `react-doctor-p4-knip-exports.source.test.ts`.
- Include:
  - `unusedTypeSurface`: grouped file/type candidates that must no longer be public or present after cleanup.
  - `intentionalPublicTypes`: kept public types with reason strings.
  - Regex support for:
    - `export interface Name`
    - `export type Name`
    - `export type { Name }`
    - multi-line `export type { ... } from "..."`
- Verify RED:
  - `node scripts/npm-run.js run test:run -- src/__tests__/react-doctor-p4-knip-types.source.test.ts`

### Task 3: Clean Low-Risk Local Types First

- Start with component-local props/types and same-file-only types.
- Prefer removing `export` over deleting when the type is still used locally.
- Keep function/component bodies unchanged.
- Run after each small batch:
  - `node scripts/npm-run.js run test:run -- src/__tests__/react-doctor-p4-knip-types.source.test.ts`
  - `node scripts/npm-run.js run typecheck`

### Task 4: Clean Shared Contracts Carefully

- For each shared file, inspect direct importers and real source usage before editing.
- Preserve public contracts when importers, type assertion files, or module-boundary semantics prove intentional use.
- Known higher-care areas:
  - `src/components/bulk-import/index.ts`: imported by device quota import, equipment import, and related tests.
  - `src/lib/ai/tools/tool-response-envelope.ts`: imported by AI compaction, RPC tool executor, and AI tool tests.
  - `src/app/(app)/reports/hooks/use-maintenance-data.types.ts`: has a paired `.types.assert.ts` file.
  - `src/app/api/transfers/legacy-adapter.ts`: imported by transfer list/count API routes.
  - `src/types/database.ts`: imported widely; type-level graph may under-report.

### Task 5: Re-run Inventory and Justify Residuals

- Re-run:
  - `node scripts/npm-run.js npx -y knip --reporter symbols`
- Confirm `knip/types` findings are either gone or each residual is represented in `intentionalPublicTypes`.
- Do not solve residual `knip/files` or `knip/exports` findings in this issue.

## Verification

Run the required repo gates in this order:

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/__tests__/react-doctor-p4-knip-types.source.test.ts
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Run focused tests for touched modules:

- Bulk import: `bulk-import-index.test.ts`, `import-equipment-dialog.test.tsx`, `DeviceQuotaImportDialog.test.tsx`.
- AI envelope/tools: `tool-response-envelope.test.ts`, `category-suggestion-envelope.test.ts`, `department-list-envelope.test.ts`, `repair-request-draft-evidence.test.ts`.
- Reports: the paired maintenance data type assertion plus the new P4 source test.
- Transfers: closest transfers page/controller/panel/API tests if `legacy-adapter.ts` or transfer type surfaces change.

Optional final confirmation:

```bash
git diff --check
```

## Assumptions

- The session should not run another React Doctor full scan.
- The implementation should use a branch for code cleanup unless the user explicitly requests a hotfix/main path.
- `knip/types` is the only Issue #474 cleanup target.
- GitNexus impact may return low/no callers for type-only symbols, so TypeScript `typecheck`, current source search, and focused tests are the decisive checks.
