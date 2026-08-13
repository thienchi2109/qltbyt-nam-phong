# P6B Production UI Activation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development
> (if subagents are available) or superpowers:executing-plans to implement this
> plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Issue:** #909

**Branch:** `feat/909-p6b-production-ui-activation`

**Base:** clean `main` at `32e2937ceaba9822c8c5f55ee9733aeb7c619910`

**Goal:** Mount the already-tested XLSX v2 download/import and hierarchy-authoring
capabilities on the production baseline screen while preserving legacy import,
destructive replacement safeguards, accessibility, responsive layout, and every
existing evaluation/comparison/result-export contract.

**Architecture:** Keep P6B UI-only. Reuse the P3C download component, P3D hierarchy
import hook/dialog, and the P4C `inlineEditor.hierarchyAuthoring` capability without
changing their server contracts. Extract only the dual-import workflow composition
from the 328-line `TechnicalConfigurationBaselineTab` so the owner remains below the
350-line extraction threshold and both import workflows contribute independently to
dirty, reload, navigation, copy, lock, and version-change blocking.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Query, shadcn/Radix
UI, Vitest, Testing Library, OpenSpec.

---

## Scope And Constraints

- P6A is deployed through PR #908. Do not add or change SQL, RPC signatures,
  allowlists, grants, policies, or migrations.
- Do not perform any live database write. A newly discovered live-write need is a
  blocker that requires explicit user permission and Supabase MCP.
- Keep the legacy baseline workbook import workflow mounted for the compatibility
  window.
- New XLSX v2 downloads and hierarchy import are draft-only. Locked baselines stay
  read-only.
- Reuse the existing authoritative preview, replacement checkbox, deletion counts,
  stale-revision evidence, and atomic apply lifecycle. Do not duplicate those rules
  in the production owner.
- Browser testing is intentionally skipped because credentials are unavailable per
  user instruction. Replace it with production-component integration coverage and
  record the skip in the PR.
- Do not alter evaluation, comparison, or result-export production components.
- Keep every source file below 450 lines and extract around 350 lines.

## Planned File Ownership

- Create
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineProductionActions.tsx`
  to render the two XLSX v2 downloads plus the hierarchy import command in a
  wrapping, keyboard-accessible action group. The existing legacy download/import
  commands remain owned by `TechnicalConfigurationVersionBar`.
- Create
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineImportWorkflows.ts`
  to compose only the legacy and hierarchy import workflows while retaining
  independent unresolved-state flags.
- Modify
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx`
  only to consume the extracted workflow/action composition, pass hierarchy
  authoring to the editor, aggregate navigation/reload/lock guards, and mount both
  dialogs.
- Replace the stale absence contract in
  `technical-configuration-baseline-hierarchy-import-production-isolation.test.tsx`
  with focused production activation coverage. This is the only existing
  hierarchy production-isolation file; it already owns download, import, and
  subgroup-control absence assertions.
- Update the stale production-absence assertion at the end of
  `technical-configuration-baseline-download-actions.test.tsx` to assert that the
  existing download component is mounted by the production baseline screen.
- Add a separate focused production workflow test only if activation visibility,
  dual-import blocking, and destructive-state assertions cannot remain clear in
  that file without approaching the extraction threshold.
- Modify
  `openspec/changes/revise-technical-configuration-baseline-hierarchy/tasks.md`
  only after verification, marking P6B.1 and P6B.3 complete. Leave P6B.2 unchecked
  with a note that browser testing was skipped by explicit user instruction.

## Chunk 1: RED Production Activation Contract

### Task 1: Draft And Locked Visibility

- [x] Update the production-isolation regression first.
- [x] Render the production baseline tab with a clean draft and assert:
  - `Tải cấu hình hiện tại` is visible and enabled;
  - `Tải mẫu trống` is visible and enabled;
  - the legacy import command remains visible;
  - `Nhập cấu hình phân cấp` is visible;
  - subgroup authoring controls are reachable through the existing editor.
- [x] Render a locked version and assert all draft-only download/import/authoring
      controls are absent while the locked read surface remains.
- [x] Run the focused test and confirm RED because P6B controls are not mounted.

Run:

```bash
node scripts/npm-run.js exec vitest run \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-production-isolation.test.tsx"
```

Expected: FAIL only on new production-activation assertions.

### Task 2: Coexistence, Blocking, Accessibility, And Responsive Layout

- [x] Add RED assertions that the legacy and XLSX v2 import commands open different
      labelled dialogs and remain independently discoverable by role/name.
- [x] Assert an unresolved workflow from either dialog blocks version adoption,
      reload, copy, lock, and navigation until reset or successful completion.
- [x] Assert the XLSX v2 dialog keeps the existing explicit replacement checkbox;
      apply remains disabled before confirmation, for invalid previews, and for stale
      previews.
- [x] Assert accessible action grouping, non-duplicated control names, visible busy
      status/error announcements, and keyboard-focusable commands.
- [x] Assert the production action container wraps on narrow widths and does not
      rely on fixed-width buttons or clipped overflow.
- [x] Run the focused tests and confirm RED for missing production composition.

## Chunk 2: GREEN Minimal Production Wiring

### Task 3: Compose Existing Import Workflows

- [x] Implement
      `useTechnicalConfigurationBaselineImportWorkflows.ts`.
- [x] Instantiate `useTechnicalConfigurationBaselineImport` unchanged for legacy
      compatibility.
- [x] Instantiate `useTechnicalConfigurationBaselineHierarchyImport` unchanged for
      XLSX v2 preview/apply.
- [x] Track legacy and hierarchy unresolved states independently; derive one
      `hasUnresolvedImportState` boolean so one workflow closing cannot clear the
      other's blocking state.
- [x] Return only both workflows and the aggregate guard needed by the tab.
- [x] Run the focused RED tests and make only this composition slice GREEN.

### Task 4: Mount Production Actions And Dialogs

- [x] Implement
      `TechnicalConfigurationBaselineProductionActions.tsx`.
- [x] Reuse `TechnicalConfigurationBaselineDownloadActions` for both download
      intents; do not duplicate workbook generation or download state.
- [x] Add one hierarchy import button with a Lucide icon, descriptive accessible
      name, and a responsive wrapping layout. Do not duplicate or relocate the legacy
      `Tải template Excel` / import commands already rendered by
      `TechnicalConfigurationVersionBar`.
- [x] In `TechnicalConfigurationBaselineTab.tsx`:
  - replace the single legacy import hook with the dual-import workflow hook;
  - include aggregate unresolved state in external-draft replacement,
    `isUnsafeToLeave`, reload, copy, lock, and navigation guards;
  - mount both import dialogs;
  - pass the existing `inlineEditor.hierarchyAuthoring` to
    `TechnicalConfigurationBaselineEditor`;
  - keep focus mode, summary, Save, scroll ownership, and version behavior intact.
- [x] Keep the tab below the 350-line extraction threshold.
- [x] Run the focused production activation tests and confirm GREEN.

### Task 5: Preserve Dormant Contract Regressions

- [x] Run the existing P3C download tests and prove current-data/blank-template
      identity, dirty/conflict guards, duplicate-download prevention, and locked
      visibility remain unchanged.
- [x] Run the existing P3D hierarchy import tests and prove legacy parsing,
      authoritative preview, destructive confirmation, stale evidence, recovery,
      pagination, and apply lifecycle remain unchanged.
- [x] Run the existing P4C authoring tests and prove subgroup CRUD/reorder,
      criterion movement, owner-scoped entry, focus, responsive controls, save/resume,
      conflict, and lock guards remain unchanged.
- [x] Run baseline legacy import tests to prove the compatibility path remains
      callable from production.

Focused command:

```bash
node scripts/npm-run.js exec vitest run \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-download-actions.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-lifecycle.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-large-preview.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-production-isolation.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-authoring-controls.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-authoring-entry.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-authoring-workflow.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/baseline-import-dialog.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-baseline-import.test.tsx"
```

## Chunk 3: Broad Regression And Closeout

### Task 6: Cross-Surface Regression

- [x] Run the complete technical-configuration test directory.
- [x] Explicitly inspect failures for evaluation hierarchy/progress, comparison
      hierarchy, result export, version navigation, focus mode, inline editing, copy,
      lock, and reload behavior.
- [x] Do not change those surfaces merely to make unrelated assertions pass; prove
      any baseline failure against `32e2937c` and file a follow-up issue if needed.

Run:

```bash
node scripts/npm-run.js exec vitest run \
  "src/app/(app)/technical-configurations/__tests__"
```

### Task 7: Required Gates

- [x] Invoke `react-best-practices` before running the TypeScript/React verification
      chain.
- [x] Run the repository verification chain in the mandated order through one
      `ctx_batch_execute` call:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js exec vitest run \
  "src/app/(app)/technical-configurations/__tests__"
node scripts/npm-run.js run react-doctor
node scripts/npm-run.js run build
openspec validate revise-technical-configuration-baseline-hierarchy --strict
git diff --check
```

- [x] Run the `code-deduplication` semantic check before commit because P6B creates
      a composition hook/component.
- [x] Before symbol edits, use Code Review Graph for broad discovery, then GitNexus
      impact analysis; inspect and report every HIGH or CRITICAL risk result. Repeat
      change detection after implementation.
- [x] Use Code Review Graph change detection and GitNexus `detect_changes`; inspect
      every high-risk symbol/process.
- [x] Record browser testing as skipped, not passed.

### Task 8: Review, OpenSpec Status, Commit, Push, And PR

- [x] Request independent specification review, then code-quality review.
- [x] Fix and re-review until both report zero actionable findings.
- [x] Mark P6B.1 and P6B.3 complete in `tasks.md`; leave P6B.2 unchecked with the
      explicit credential/user-instruction note.
- [ ] Commit through enabled Lefthook hooks.
- [ ] Run `git pull --rebase`, push the branch, and verify it is up to date with
      origin.
- [x] Open a PR into `main` that links and closes #909, lists verification counts,
      states that browser tests were skipped, and confirms no live DB write occurred.
- [ ] Stop before merge and report the PR for user review.

## Completion Boundary

P6B is ready for review only when production component tests prove both workbook
paths coexist, XLSX v2 replacement remains explicitly destructive, hierarchy
authoring is mounted for drafts, locked versions remain read-only, broad
evaluation/comparison/export regressions pass, all required gates pass, independent
review reaches zero findings, and the pushed PR is open against `main`. Merge,
live acceptance, issue closure, and OpenSpec archival remain P6C/user-owned.
