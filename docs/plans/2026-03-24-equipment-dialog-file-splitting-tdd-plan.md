# Equipment Dialog File Splitting TDD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the oversized equipment dialog files into smaller modules while preserving current behavior and proving each extraction step with TDD.

**Architecture:** Keep the existing dialog entrypoints and behavior stable, then split each large file into shell, helper, and section-level modules behind the current public APIs. Use behavior-focused tests to lock each seam before extraction so the refactor remains low-risk even where GitNexus inbound impact is incomplete.

**Tech Stack:** Next.js App Router, React, TypeScript, React Hook Form, Zod, TanStack Query, Vitest, Testing Library, GitNexus CLI, ripgrep

---

## Context

- Target files with React Doctor file-size warnings:
  - `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailEditForm.tsx`
  - `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx`
  - `src/components/add-equipment-dialog.tsx`
- Current dependency findings:
  - `EquipmentDetailDialog` is mounted from `src/app/(app)/equipment/equipment-dialogs.tsx`.
  - `AddEquipmentDialog` is mounted from `src/app/(app)/equipment/equipment-dialogs.tsx`.
  - Existing protection tests already cover tabs, RBAC, decommission-date behavior, and CRUD flows.
  - GitNexus `context` was useful for local symbol/process discovery, but inbound `impact` was incomplete for these components; use `rg` plus targeted tests as the source of truth before and after edits.
- Refactor direction chosen: hybrid.
  - Split shells, helpers, and sections aggressively enough to remove file-size warnings.
  - Share only low-risk helpers/types/defaults when the shapes are already aligned.
  - Do not force a unified shared UI abstraction for create and detail-edit forms in this pass.
- Verified review follow-ups:
  - GitNexus risk remains LOW for all three targets, with inbound caller data still incomplete as expected.
  - `rg -n "EquipmentDetailStatus" src` currently returns no matches, so `EquipmentDetailStatusSection.tsx` does not collide today.
  - `node scripts/npm-run.js run typecheck` is a valid repo-standard command, confirmed by `package.json` and `scripts/npm-run.js`.

## Commit Checkpoint Rule

- After every successful green step, create a checkpoint commit before the next refactor.
- After every successful post-refactor verification step, create another checkpoint commit before moving to the next task.
- Use commit messages that preserve rollback clarity, for example:
  - `test: lock EquipmentDetailDialog shell behavior`
  - `refactor: split EquipmentDetailDialog shell`
  - `test: lock AddEquipmentDialog shell behavior`
  - `refactor: split AddEquipmentDialog sections`

## Task 1: Lock `EquipmentDetailDialog` shell behavior before extraction

**Files:**
- Modify: `src/app/(app)/equipment/__tests__/equipment-detail-dialog-tabs.test.tsx`
- Modify: `src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx`
- Modify if needed: `src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx`
- Modify later: `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx`

**Step 1: Write the failing tests**

- Add or extend tests that prove the shell responsibilities still work:
  - footer actions render correctly by permission and edit state
  - edit mode can be entered and cancelled
  - save button remains wired to the existing inline form id
  - close action still routes through the guarded `handleDialogOpenChange` path
- Prefer behavior-level assertions over implementation details.

**Step 2: Run the target tests to verify they fail**

Run:

```bash
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-tabs.test.tsx"
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx"
```

Expected:
- at least one new assertion fails for the intended missing or not-yet-extracted seam
- failure is due to missing behavior coverage, not a broken mock or typo

**Step 3: Write the minimal code to make the tests pass**

- Make only the smallest test-supporting changes needed before extraction.
- Do not extract new modules yet unless that exact change is required to satisfy the failing behavior.

**Step 4: Run the same tests to verify they pass**

Run the same two commands above.

Expected:
- both test files pass cleanly

**Step 5: Commit the green state**

Run:

```bash
git add src/app/(app)/equipment/__tests__/equipment-detail-dialog-tabs.test.tsx src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx
git commit -m "test: lock EquipmentDetailDialog shell behavior"
```

**Step 6: Refactor the shell**

- Extract from `index.tsx`:
  - footer JSX into `EquipmentDetailFooter.tsx`
  - tab body composition into `EquipmentDetailTabs.tsx`
- Keep in `index.tsx`:
  - state
  - form initialization
  - hook wiring
  - displayEquipment derivation
  - RBAC gating decisions
- Preserve existing exports:
  - `EquipmentDetailDialog`
  - `EquipmentDetailDialogProps`

**Step 7: Re-run focused tests**

Run:

```bash
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-tabs.test.tsx"
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx"
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx"
```

Expected:
- all pass without behavior drift

**Step 8: Commit the refactor state**

Run:

```bash
git add src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailFooter.tsx src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailTabs.tsx src/app/(app)/equipment/__tests__/equipment-detail-dialog-tabs.test.tsx src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx
git commit -m "refactor: split EquipmentDetailDialog shell"
```

## Task 2: Extract `EquipmentDetailDialog` form defaults and mapping helpers

**Files:**
- Create: `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailFormDefaults.ts`
- Modify: `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx`
- Modify or create focused tests near existing detail-dialog tests

**Step 1: Write the failing test**

- Add a test that proves the equipment-to-form mapping still preserves:
  - normalized ND98 classification
  - partial/full date formatting
  - numeric `0` values
- If practical, write a small focused unit-style test for the extracted helper instead of bloating integration tests.

**Step 2: Run the test to verify it fails**

Run only the new test file or filtered test case.

Expected:
- it fails because the helper behavior is not yet isolated or not yet asserted

**Step 3: Write the minimal implementation**

- Move:
  - `DEFAULT_FORM_VALUES`
  - `equipmentToFormValues`
- Keep signatures and output shape identical.

**Step 4: Run the test to verify it passes**

Run the same targeted test command.

Expected:
- pass with no changes to dialog behavior

**Step 5: Commit the green state**

- Commit the test plus the minimal extraction-safe implementation before broader suite verification.

**Step 6: Re-run detail dialog suite**

Run:

```bash
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-tabs.test.tsx"
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx"
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx"
```

**Step 7: Commit the refactor state**

- Commit the helper extraction after the dialog suite is green.

## Task 3: Lock `EquipmentDetailEditForm` behavior before section extraction

**Files:**
- Create or modify: `src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx`
- Modify later: `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailEditForm.tsx`

**Step 1: Write the failing tests**

- Render the form inside a real `FormProvider`.
- Add tests for:
  - key fields render with existing labels/placeholders
  - submit wiring still calls the provided handler
  - decommission date autofill still reacts to status transition
  - classification select still exposes the existing options

**Step 2: Run the test to verify it fails**

Run:

```bash
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx"
```

Expected:
- failure comes from the unimplemented or not-yet-covered seam, not test setup

**Step 3: Write the minimal implementation**

- Make only the smallest changes necessary to get the direct form test green before splitting sections.

**Step 4: Run the test to verify it passes**

Run the same command above.

**Step 5: Commit the green state**

- Commit the direct form behavior lock before splitting sections.

**Step 6: Refactor into sections**

- First run a naming guard before creating the status section file:

```bash
rg -n "EquipmentDetailStatus" src
```

- If a collision appears by the time implementation starts, use `EquipmentDetailStatusFieldsSection.tsx` instead of `EquipmentDetailStatusSection.tsx`.

- Extract section components:
  - `EquipmentDetailBasicInfoSection.tsx`
  - `EquipmentDetailDatesSection.tsx`
  - `EquipmentDetailAssignmentSection.tsx`
  - `EquipmentDetailStatusSection.tsx`
- Add `EquipmentDetailFormConstants.ts` only if it removes duplication cleanly.
- Keep `EquipmentDetailEditForm.tsx` as the wrapper that owns:
  - `useFormContext`
- `useDecommissionDateAutofill`
- scroll layout
- `<form>` submit shell

**Step 7: Re-run form and dialog tests**

Run:

```bash
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx"
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-tabs.test.tsx"
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx"
```

**Step 8: Commit the refactor state**

- Commit the section extraction only after the direct form test and related dialog tests are green.

## Task 4: Lock `AddEquipmentDialog` shell behavior before extraction

**Files:**
- Modify: `src/components/__tests__/equipment-dialogs.crud.test.tsx`
- Modify later: `src/components/add-equipment-dialog.tsx`

**Step 1: Write the failing tests**

- Extend coverage for shell responsibilities that will remain in the main dialog file:
  - readonly tenant field renders the current tenant text
  - department badge click sets `khoa_phong_quan_ly`
  - close/reset behavior remains stable when dialog closes
- Keep the existing CRUD and validation tests intact.

**Step 2: Run the test to verify it fails**

Run:

```bash
node scripts/npm-run.js vitest run "src/components/__tests__/equipment-dialogs.crud.test.tsx"
```

Expected:
- the new assertion fails for the intended seam

**Step 3: Write the minimal implementation**

- Make the smallest behavior-preserving change necessary to satisfy the new test.

**Step 4: Run the test to verify it passes**

Run the same command above.

**Step 5: Commit the green state**

- Commit the shell behavior lock before moving into extraction work.

## Task 5: Extract `AddEquipmentDialog` schema, query helpers, and form sections

**Files:**
- Create: `src/components/add-equipment-dialog.schema.ts`
- Create: `src/components/add-equipment-dialog.queries.ts`
- Create: `src/components/add-equipment-dialog.sections.tsx`
- Modify: `src/components/add-equipment-dialog.tsx`

**Step 1: Write the failing test**

- Add one focused failing test for the first extracted seam:
  - schema/defaults still produce the same required validation behavior
  - or query mapping still returns the same department/tenant shapes
- Keep tests behavior-driven, not import-shape driven.

**Step 2: Run the test to verify it fails**

Run the smallest relevant test command or filter within `equipment-dialogs.crud.test.tsx`.

Expected:
- fail for the missing seam, not for unrelated mocks

**Step 3: Write the minimal implementation**

- Move schema, types, defaults, and query mapping helpers out of the shell.
- Extract section JSX into `add-equipment-dialog.sections.tsx`.
- Keep `add-equipment-dialog.tsx` responsible for:
  - `useSession`
  - TanStack Query hooks
  - mutation wiring
  - dialog open/close/reset shell
  - final form submission
- Preserve:
  - `AddEquipmentDialog`
  - `AddEquipmentDialogProps`
  - RPC names
  - query keys
  - RBAC behavior

**Step 4: Run the tests to verify they pass**

Run:

```bash
node scripts/npm-run.js vitest run "src/components/__tests__/equipment-dialogs.crud.test.tsx"
```

**Step 5: Optional low-risk sharing only if already aligned**

- If schema/default helper shapes are obviously compatible, share low-risk helpers with the detail-dialog form modules.
- Do not unify the full create/edit UI tree in this task.
- If sharing would force test churn or prop reshaping, skip it.

**Step 6: Commit the refactor state**

- Commit the schema/query/section extraction after CRUD and validation tests are green.

## Task 6: Final verification and file-size review

**Files:**
- Review:
  - `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx`
  - `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailEditForm.tsx`
  - `src/components/add-equipment-dialog.tsx`

**Step 1: Run all focused tests**

Run:

```bash
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-tabs.test.tsx"
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx"
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx"
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/EquipmentDetailDetailsTab.test.tsx"
node scripts/npm-run.js vitest run "src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx"
node scripts/npm-run.js vitest run "src/components/__tests__/equipment-dialogs.crud.test.tsx"
```

Expected:
- all pass

**Step 2: Run typecheck**

Run:

```bash
node scripts/npm-run.js run typecheck
```

Expected:
- pass with no new type regressions
- this exact wrapper command is verified against `package.json` and `scripts/npm-run.js`

**Step 3: Confirm file-size outcome**

- Verify the original warning files are now below the warning threshold or otherwise materially reduced enough to remove the warning.
- If any file still remains above the threshold, do one more TDD-protected extraction pass instead of accepting partial cleanup.

**Step 4: Commit the final verified state**

- Commit only after the full focused test sweep, typecheck, and file-size review are all green.

## Acceptance Criteria

- `EquipmentDetailDialog/index.tsx` is reduced to a shell/orchestration role.
- `EquipmentDetailEditForm.tsx` is reduced to a wrapper/composition role.
- `add-equipment-dialog.tsx` is reduced to a shell role.
- Existing public exports and props remain unchanged.
- Tabs, save/cancel, close guard, RBAC, decommission autofill, create flow, and validation behavior remain unchanged.
- All targeted tests pass, then typecheck passes.

## Assumptions

- This is a maintainability refactor only, not a UX or product behavior change.
- GitNexus inbound impact for these dialog symbols is incomplete in this environment; use `rg` and the targeted test suite to confirm true blast radius.
- Sharing between create and detail-edit paths is limited to helpers/types/defaults when that can be done without broad test churn.
