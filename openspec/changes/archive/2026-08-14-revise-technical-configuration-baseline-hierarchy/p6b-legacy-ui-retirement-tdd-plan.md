# P6B Legacy Excel UI Retirement TDD Plan

Issue: #911

## Decision

Replace the legacy `Tai template Excel` and `Nhap tu Excel` production actions with
the three P6B XLSX v2 actions in the baseline version bar. Remove client-only legacy
hook, dialog, and composition code that becomes unreachable. Keep shared parser and
server contracts that are still used by XLSX v2 or retained for server compatibility.

No live database write is required. Browser route tests remain skipped because
credentials are unavailable.

## Task 1: Lock The Action Contract

**Modify:**

- `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-production-isolation.test.tsx`
- `src/app/(app)/technical-configurations/__tests__/TechnicalConfigurationVersionBar.test.tsx`

1. Assert draft baselines render exactly the three XLSX v2 spreadsheet actions in the
   version-bar action region.
2. Assert `Tai template Excel` and `Nhap tu Excel` are absent.
3. Assert locked baselines keep spreadsheet actions hidden.
4. Run the focused tests and confirm RED because the legacy actions still render and
   the new actions are outside the version bar.

## Task 2: Replace The Production UI

**Modify:**

- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationVersionBar.tsx`
- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineVersionControls.tsx`
- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx`

**Delete when unreferenced:**

- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineProductionSurfaces.tsx`
- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineImportDialog.tsx`
- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineImportPreview.tsx`
- `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineImportWorkflows.ts`
- `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineImport.ts`

1. Pass the existing `TechnicalConfigurationBaselineProductionActions` component into
   the draft action region of the version bar.
2. Remove legacy props, status flags, handlers, hook composition, and dialog mounting.
3. Use `useTechnicalConfigurationBaselineHierarchyImport` directly and preserve its
   unresolved-state navigation guard, destructive confirmation, conflict recovery,
   and reset behavior.
4. Mount only the hierarchy import dialog.
5. Remove tests that exclusively exercise the retired client UI path; keep shared
   parser and RPC contract tests.
6. Run the focused tests and confirm GREEN.

## Task 3: Align OpenSpec And Regressions

**Modify:**

- `openspec/changes/revise-technical-configuration-baseline-hierarchy/tasks.md`
- `openspec/changes/revise-technical-configuration-baseline-hierarchy/p6b-tdd-plan.md`

1. Record the user-approved retirement of the legacy production UI compatibility
   window.
2. Run focused baseline action/import/locking tests.
3. Run the complete technical-configuration suite.
4. Run formatting, no-explicit-any, dedupe, typecheck, React Doctor, build, and
   OpenSpec strict.
5. Run Code Review Graph and GitNexus diff review to zero findings before commit and
   PR.
