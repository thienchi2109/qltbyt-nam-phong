# TM-11 Equipment Temperature Tab Implementation Plan

> **For agentic workers:** Execute with `superpowers:executing-plans`; the sole implementation worker pauses for the parent plan review and final implementation review. No additional agents, push, integration, dependencies, SQL, or live writes.

**Goal:** Move the existing temperature summary and configuration into an always-visible **Sổ theo dõi nhiệt độ** tab immediately after **Cấu hình & Phụ kiện**, preserving existing permissions, persistence and recording navigation.

**Architecture:** Keep the existing Radix Tabs lazy mount and equipment edit FormProvider. Extract the existing temperature block into `EquipmentDetailTemperatureTab.tsx`; keep configuration/accessories in their original tab. Reuse the configuration hook, shadcn Select/Label and DropdownMenu checkbox pattern without introducing a generic selector or a loading abstraction.

**Tech Stack:** Next.js/React, existing shadcn/Radix primitives, TanStack Query, Vitest/Testing Library; existing repository dependencies only.

## Chunk 1: Regression, extraction and controls

### Task 1: Capture valuable regressions (RED)

Files:

- Modify `src/hooks/__tests__/temperature-configuration-persistence.test.tsx`.
- Modify `src/hooks/__tests__/temperature-configuration-selection.test.tsx`.
- Modify `backlog/tasks/TM-11-equipment-temperature-tab-and-form-polish.md` (In Progress and replace historical implementation prohibition with current authorization/review checkpoint).

- [x] Reuse root node_modules with an ignored worktree symlink; inspect existing hooks and run the two focused test files as baseline.
- [x] Update real-dialog tests to open **Sổ theo dõi nhiệt độ**; assert trigger position, no temperature RPC on initial/details/config panels, and real tab leave/return server persistence. Preserve future-only/null/zero-bound tests.
- [x] Adapt form tests to interact with real shadcn single selectors and checkbox menu; assert `profile`, `method`, `primary`, all `substitutes` through the actual upsert arguments, including selected people outside the current search page.
- [x] Add focused role/editing/validation coverage: admin/global/to_qltb can configure unconfigured equipment, read-only has no save, equipment editing issues no temperature queries, missing reason visibly blocks saving and remains required/maxLength 2000. Keep existing pending and error checks.
- [x] Run `node scripts/npm-run.js run test:run -- src/hooks/__tests__/temperature-configuration-persistence.test.tsx src/hooks/__tests__/temperature-configuration-selection.test.tsx`. Record exact behavior failures before implementation; do not add tests that merely assert file existence.

### Task 2: Minimal implementation (GREEN)

Files:

- Modify `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailTabs.tsx`.
- Modify `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailConfigTab.tsx`.
- Create `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailTemperatureTab.tsx`.
- Create `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailTemperatureStaffFields.tsx` only to keep the new tab comfortably below the 350-line extraction threshold (staff search, primary Select and substitute DropdownMenu).
- Modify `src/components/ui/select.tsx` and `src/components/ui/dropdown-menu.tsx` only to forward the native optional Portal container, preserving defaults.
- Reuse `src/hooks/use-temperature-configuration.ts` unchanged; retain all display/null handling, scoped queries, staff preservation and mutation invalidation.

- [x] Obtain current GitNexus impact for `EquipmentDetailTabs`, `EquipmentDetailConfigTab`, `useTemperatureConfiguration`; report blast radius and preserve existing accessories edit controls.
- [x] Add trigger `temperature` immediately after `config` and a lazy `TabsContent` with no forceMount. Leave horizontal scroll and Radix keyboard handling intact.
- [x] Move the complete temperature hook/summary/form/link into the dedicated tab. Preserve edit behavior by disabling queries while editing and hiding temperature controls then.
- [x] Use existing `Label` with associated IDs; `grid gap-2` label/control groups (measured 8px; inline Label makes space-y-2 insufficient) and `space-y-4` field/form groups; `text-base` inputs and Select triggers on mobile; `text-base font-semibold` section heading, muted small summary labels/hints, medium summary values and tabular temperature numbers. Keep responsive min-width/overflow guards.
- [x] Replace profile/method/primary native selects with existing named shadcn Select controls using preserved defaults. Reuse DropdownMenuCheckboxItem with `onSelect.preventDefault()` for substitutes, keeping selected IDs in repeated hidden `name="substitutes"` inputs so FormData includes every value; preserve staff search/pagination and off-page selections.
- [x] Keep reason required/maxLength 2000 and onInvalid feedback, disabled pending button/Loader2/status and error feedback. Preserve route `/temperature-monitoring?equipment=<id>` and all existing mutation payload names/invalidation; only change pending guards if a valuable regression proves that necessary.
- [x] Keep selectors inside the current dialog portal and control their open state with an Escape listener active only while a temperature selector is open. Actual-dialog RED exposed separate installed Radix focus/layer stacks; retain native autofocus, no dependency/default changes.
- [x] Re-run focused tests until GREEN. No recording/trends/export embedding or unsaved-draft persistence.

## Chunk 2: Verification and review handoff

### Task 3: Required checks and review evidence

Files:

- Update this plan and the TM-11 backlog with results and honest limitations; leave backlog In Progress until parent review completes.

- [x] Apply `simplify` to the task diff and confirm each changed source file stays below 450 lines; avoid semantic duplication using current Code Review Graph/GitNexus plus the existing toolbar checkbox pattern.
- [x] Run targeted Prettier check for changed files, formatting only those files if needed.
- [x] In one context-mode batch at concurrency 1 run, in order: `node scripts/npm-run.js run verify:no-explicit-any`, `node scripts/npm-run.js run verify:dedupe` (diff only), `node scripts/npm-run.js run typecheck`, focused Vitest command above, `node scripts/npm-run.js run react-doctor`. Report each exit/outcome.
- [x] Parent ran existing Chrome tooling on a disposable UI fixture: mobile sizing, label gaps, selector keyboard/focus/Escape, multi-selection, validation and FormData passed; no production writes or dependency installation. Full Next.js authenticated UAT remains outside this evidence.
- [x] Hand parent the exact RED/GREEN results, gate evidence, changed files, reuse decision and remaining risks. Parent and independent final reviewer approved the implementation before commit; parent owns push and integration.

## Evidence and risks

- Current `EquipmentDetailTabs.tsx:70-73` places config before files; its config TabsContent mounts the temperature hook indirectly. Existing `details` forceMount is editing-only and must remain unchanged.
- Current `EquipmentDetailConfigTab.tsx:54-337` contains hook, summary, raw controls and the equipment ConfigEditForm; extraction removes the temperature dependency from config rather than adding query flags there.
- Current `use-temperature-configuration.ts:48-150` already normalizes admin/global through `isGlobalRole`, scopes by equipment RPC, preserves off-page selected people and null/zero thresholds. Keep this behavior.
- Existing `src/components/add-tasks-dialog-toolbar.tsx:106-113` demonstrates checkbox-menu multi-selection with onSelect.preventDefault. Reuse the primitive/pattern, not the toolbar or a new generic API.
- Risk: Radix hidden single-select form inputs, uncontrolled defaults and menu portals need actual FormData and jsdom interaction tests. Browser portal/focus/mobile verification may remain limited by available tooling.
- Risk: source extraction exceeds the file threshold unless staff fields are split; only that direct task-specific component is planned. No domain/API changes are required.
- Graph freshness: root GitNexus index initially pointed at older commit `8859e3c`; worktree analyze refreshed the fixed-base source before impact. Any analyzer-generated AGENTS/CLAUDE modifications will be restored and excluded.

## Execution evidence (2026-10-27)

- Baseline: two focused files, 11/11 PASS. Initial real-tab regression: 6 FAIL / 5 PASS, missing the required temperature tab; same future/null/zero cases now PASS.
- Actual-dialog selector regression: opening a body-portaled Select caused jsdom focus recursion between installed Radix focus-scope 1.1.7 and 1.1.11; task container forwarding resolves it. This recursion was not confirmed in Chrome.
- Escape RED: real-dialog Select/listbox and checkbox menu remained open while the outer dialog close callback fired. Controlled task selectors now close first, preserve the reason draft/dialog and restore trigger focus; ordinary dialog Escape remains enabled after selectors close.
- GREEN: 18/18 tests, including actual QueryClient save/pending/refetch/tab remount/dialog reopen, roles, payload names, all substitutes, native validation, errors and null/zero bounds.
- Final ordered gates on the complete staged source, including new components, all exit 0: format:check, verify:ts-docstrings, verify:no-explicit-any, verify:dedupe (diff only), typecheck, focused Vitest 18/18 (08:49 UTC), React Doctor 92/100 (8 files, one intentional `react-doctor/no-prevent-default` advisory, no errors). The earlier 100/100 scan omitted the then-untracked components and is not the final result. A per-render Set removes the checkbox lookup warning; the required FormData submit handler remains intact.
- Semantic reuse: unchanged configuration hook and existing toolbar checkbox-menu pattern; no generic selector/loading abstraction. GitNexus shared-file import blast radius: Select 31 (CRITICAL), DropdownMenu 18 (HIGH); only this tab opts into optional containers, existing caller defaults unchanged. Text import counts 52/22 include additional consumers.
- Parent browser fixture smoke PASS: mobile 390px viewport/body width, 8px reason label/control gap, 16px input font, single/multi Escape preserves dialog/draft and restores trigger focus, named FormData includes all selections; no page errors. This uses real components/Dialog/CSS with a fixture hook and NextLink stub, not full Next.js/production UAT. Parent owns the report.
- Independent final review: SPEC PASS and QUALITY/STANDARDS PASS, reconfirmed after the four responsive typography class edits. Parent browser review is recorded in `docs/reports/temperature-monitoring-tm11-ui-2026-10-27.md`; backlog is Done for the reviewed implementation, with main integration and deployment outside this branch delivery.
