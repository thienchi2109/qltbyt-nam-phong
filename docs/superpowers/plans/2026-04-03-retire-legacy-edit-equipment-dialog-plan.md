# Retire Legacy EditEquipmentDialog Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the transitional `EditEquipmentDialog` flow now that PR `#208` has already migrated dashboard and QR scanner onto the canonical `/equipment?highlight={id}` route flow, leaving one canonical equipment edit contract and no legacy dialog residue.

**Architecture:** Treat this as a cleanup capstone, not a business-logic rewrite. PR `#208` already removed route-level callers from `src/app/(app)/dashboard/page.tsx` and `src/app/(app)/qr-scanner/page.tsx`; `#184` should use those tests as a baseline gate, then delete the legacy shell and thin compatibility wrappers while preserving the shared mutation/defaults behavior in `src/components/equipment-edit/*`. GitNexus still shows `useEquipmentEditUpdate`, `useEquipmentUpdate`, and `equipmentToFormValues` with `CRITICAL` impact, so avoid changing their semantics unless a failing test proves a regression.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Query, Vitest, GitHub CLI, GitNexus CLI

---

## Chunk 1: PR 208 Baseline Gate

### Task 1: Verify the migrated routes stay green before starting cleanup

**Files:**
- External: GitHub issues `#182`, `#183`, `#184`
- External: GitHub PR `#208`
- Read only: `src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx`
- Read only: `src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx`

- [ ] **Step 1: Confirm the branch already contains the route migrations**

Run:
```bash
gh pr view 208 --json number,title,state,baseRefName,headRefName,url
gh issue view 182 --json number,title,state,url
gh issue view 183 --json number,title,state,url
git diff --name-only origin/main...HEAD
```

Expected:
- `#208` points at `refactor/182-qr-scanner-migrate-off-edit-dialog`
- the branch diff includes only the dashboard and QR scanner route migration work plus their tests
- `#184` can now treat `#182/#183` as addressed in-branch

- [ ] **Step 2: Run the existing migration tests as a preflight gate**

Run:
```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx' 'src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx'
```

Expected:
- PASS

- [ ] **Step 3: Stop if the baseline is red**

If either test fails, fix that regression first in the current branch before touching any legacy-shell cleanup. Do not begin `#184` deletion work on top of a broken `#208` baseline.

## Chunk 2: Delete The Legacy Shell

### Task 2: Remove the standalone component through failing cleanup tests

**Files:**
- Modify: `src/components/__tests__/equipment-dialogs.crud.test.tsx`
- Modify: `src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx`
- Modify: `src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx`
- Delete later: `src/components/edit-equipment-dialog.tsx`
- Delete later: `src/components/__tests__/edit-equipment-dialog.rpc.test.ts`
- Delete later: `src/components/edit-equipment-dialog.rpc.ts`

- [ ] **Step 1: Write failing cleanup tests around the deleted shell**

Change `src/components/__tests__/equipment-dialogs.crud.test.tsx` so it no longer treats `EditEquipmentDialog` as a supported surface.

Replace the legacy section with focused assertions that the canonical shared contract remains covered elsewhere and that no component-level legacy edit shell is expected to exist.

- [ ] **Step 2: Run the affected legacy-shell tests to verify RED**

Run:
```bash
node scripts/npm-run.js run test:run -- 'src/components/__tests__/equipment-dialogs.crud.test.tsx' 'src/components/__tests__/edit-equipment-dialog.rpc.test.ts' 'src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx' 'src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx'
```

Expected:
- FAIL because the old tests still import deleted-soon modules or still describe legacy behavior as supported.

- [ ] **Step 3: Write the minimal implementation**

Delete:
- `src/components/edit-equipment-dialog.tsx`
- `src/components/edit-equipment-dialog.rpc.ts`
- `src/components/__tests__/edit-equipment-dialog.rpc.test.ts`

Update:
- `src/components/__tests__/equipment-dialogs.crud.test.tsx` to remove the obsolete legacy-shell block and keep only still-valid CRUD coverage
- `src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx` and `src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx` so they no longer mock a deleted module just to prove absence

- [ ] **Step 4: Run the affected tests to verify GREEN**

Run:
```bash
node scripts/npm-run.js run test:run -- 'src/components/__tests__/equipment-dialogs.crud.test.tsx' 'src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx' 'src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx'
```

Expected:
- PASS

- [ ] **Step 5: Refactor only if needed and keep green**

Allowed refactors:
- tighten shared test setup if legacy imports left dead mocks behind
- remove obsolete helper factories only if coverage stays intact

Re-run:
```bash
node scripts/npm-run.js run test:run -- 'src/components/__tests__/equipment-dialogs.crud.test.tsx' 'src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx' 'src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx'
```

## Chunk 3: Collapse Thin Compatibility Wrappers

### Task 3: Move EquipmentDetailDialog directly onto the shared contract

**Files:**
- Modify: `src/app/(app)/equipment/__tests__/equipment-detail-form-defaults.test.ts`
- Modify: `src/components/__tests__/equipment-edit-shared-contract.test.ts`
- Modify later: `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx`
- Delete later: `src/app/(app)/equipment/_components/EquipmentDetailDialog/hooks/useEquipmentUpdate.ts`
- Delete later: `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailFormDefaults.ts`

- [ ] **Step 1: Write failing tests that assert direct shared-contract usage**

Update tests so they expect the canonical source of truth to be:
- `src/components/equipment-edit/useEquipmentEditUpdate.ts`
- `src/components/equipment-edit/EquipmentEditFormDefaults.ts`

Do not keep tests whose only purpose is to preserve wrapper modules.

- [ ] **Step 2: Run the shared-contract tests to verify RED**

Run:
```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/equipment/__tests__/equipment-detail-form-defaults.test.ts' 'src/components/__tests__/equipment-edit-shared-contract.test.ts' 'src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx'
```

Expected:
- FAIL because `EquipmentDetailDialog` and related tests still rely on wrapper paths.

- [ ] **Step 3: Write the minimal implementation**

Modify `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx` to import:
- `useEquipmentEditUpdate` directly from `src/components/equipment-edit/useEquipmentEditUpdate.ts`
- `DEFAULT_EQUIPMENT_FORM_VALUES` and `equipmentToFormValues` directly from `src/components/equipment-edit/EquipmentEditFormDefaults.ts`

Then delete:
- `src/app/(app)/equipment/_components/EquipmentDetailDialog/hooks/useEquipmentUpdate.ts`
- `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailFormDefaults.ts`

- [ ] **Step 4: Run the shared-contract tests to verify GREEN**

Run:
```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/equipment/__tests__/equipment-detail-form-defaults.test.ts' 'src/components/__tests__/equipment-edit-shared-contract.test.ts' 'src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx'
```

Expected:
- PASS

- [ ] **Step 5: Refactor only if needed and keep green**

Allowed refactors:
- collapse stale import indirection in detail-dialog tests
- remove re-export-only comments or module docs that now mislead

Re-run:
```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/equipment/__tests__/equipment-detail-form-defaults.test.ts' 'src/components/__tests__/equipment-edit-shared-contract.test.ts' 'src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx'
```

## Chunk 4: Final Residue Sweep And Verification

### Task 4: Finish with a failing residue test/search and only then clean up

**Files:**
- Modify: `src/app/(app)/equipment/__tests__/equipment-dialogs.page-consolidation.test.tsx`
- Search only: `src/**`
- Search only: `docs/**`
- Search only: `openspec/**`

- [ ] **Step 1: Write the final failing consolidation test adjustment**

Update `src/app/(app)/equipment/__tests__/equipment-dialogs.page-consolidation.test.tsx` so it no longer mocks `@/components/edit-equipment-dialog` and instead asserts only the still-real canonical dialog host tree.

- [ ] **Step 2: Run the consolidation test to verify RED**

Run:
```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/equipment/__tests__/equipment-dialogs.page-consolidation.test.tsx'
```

Expected:
- FAIL because the test still carries legacy mocks/assumptions.

- [ ] **Step 3: Write the minimal implementation**

Clean up the consolidation test and remove current-source comments that still describe a live legacy standalone edit path.

Then run residue searches:
```bash
rg -n "EditEquipmentDialog|updateEquipmentRecord" src --glob '!**/*test.ts' --glob '!**/*test.tsx'
rg -n "EditEquipmentDialog|updateEquipmentRecord" docs openspec
```

Expected:
- `src` production code should return no live matches.
- `docs` and `openspec` may still contain historical references; update only active/current guidance, do not rewrite archival history.

- [ ] **Step 4: Run the focused suite to verify GREEN**

Run:
```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/equipment/__tests__/equipment-dialogs.page-consolidation.test.tsx' 'src/app/(app)/equipment/__tests__/equipment-detail-form-defaults.test.ts' 'src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx' 'src/components/__tests__/equipment-edit-shared-contract.test.ts' 'src/components/__tests__/equipment-dialogs.crud.test.tsx' 'src/components/__tests__/qr-action-sheet.test.tsx' 'src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx' 'src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx'
```

Expected:
- PASS

- [ ] **Step 5: Run repo verification gates in the required order**

Run:
```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- 'src/app/(app)/equipment/__tests__/equipment-dialogs.page-consolidation.test.tsx' 'src/app/(app)/equipment/__tests__/equipment-detail-form-defaults.test.ts' 'src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx' 'src/components/__tests__/equipment-edit-shared-contract.test.ts' 'src/components/__tests__/equipment-dialogs.crud.test.tsx' 'src/components/__tests__/qr-action-sheet.test.tsx' 'src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx' 'src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx'
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected:
- all commands pass in order

- [ ] **Step 6: Manual/browser verification and commit**

Manual verification:
- dashboard `update-status` reaches canonical edit flow
- QR scanner `update-status` reaches canonical edit flow
- `/equipment` still opens `EquipmentDetailDialog` only

Then commit:
```bash
git add src/app/(app)/dashboard/page.tsx src/app/(app)/dashboard/__tests__/dashboard-no-legacy-dialog.test.tsx src/app/(app)/qr-scanner/page.tsx src/app/(app)/qr-scanner/__tests__/qr-scanner-no-legacy-dialog.test.tsx src/components/qr-action-sheet.tsx src/components/__tests__/qr-action-sheet.test.tsx src/components/__tests__/equipment-dialogs.crud.test.tsx src/components/__tests__/equipment-edit-shared-contract.test.ts src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx src/app/(app)/equipment/__tests__/equipment-detail-form-defaults.test.ts src/app/(app)/equipment/__tests__/equipment-detail-edit-form.test.tsx src/app/(app)/equipment/__tests__/equipment-dialogs.page-consolidation.test.tsx docs/superpowers/plans/2026-04-03-retire-legacy-edit-equipment-dialog-plan.md
git add -u src/components/edit-equipment-dialog.tsx src/components/edit-equipment-dialog.rpc.ts src/components/__tests__/edit-equipment-dialog.rpc.test.ts src/app/(app)/equipment/_components/EquipmentDetailDialog/hooks/useEquipmentUpdate.ts src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailFormDefaults.ts
git commit -m "refactor: retire legacy edit equipment dialog"
```
