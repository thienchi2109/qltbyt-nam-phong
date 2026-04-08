# React Doctor Batch 1 Unused Exports Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development before every source edit. No production code changes before a failing test or failing audit assertion is observed.

**Goal:** Reduce the current `knip/exports` warning bucket by removing only low-risk unused exports that have no real callers in app code or tests.

**Architecture:** This batch stays strictly at symbol-export surface level. We will use React Doctor diagnostics to identify candidate files, GitNexus to estimate blast radius, and `rg` as the source of truth when graph results disagree with current code. We will not delete files, refactor behavior, or touch symbols that participate in active request/UI flows.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Vitest, React Doctor, GitNexus, ripgrep

---

## TDD Rule For This Plan

Because this batch removes unused exports rather than changing user-facing behavior, the TDD loop must be adapted but still stay strict:
- `RED`: add or tighten a focused test/audit assertion that proves the candidate export is part of the public surface today and should no longer be reachable after cleanup
- `VERIFY RED`: run that focused test and watch it fail for the expected reason
- `GREEN`: remove the minimal `export` modifier or barrel re-export needed to satisfy the new assertion
- `VERIFY GREEN`: rerun the focused test plus required repo gates
- `REFACTOR`: only after green, clean comments or local names if necessary; no extra surface changes

Acceptable red tests for this batch:
- `expect(module).not.toHaveProperty(...)` style assertions in existing Vitest suites
- type-level import assertions that fail when an export still exists
- focused barrel-surface tests created specifically for this cleanup batch

Unacceptable shortcuts:
- removing the export first and calling later verification “good enough”
- relying only on React Doctor after implementation
- treating grep output as a substitute for a failing test

## Scope Lock

Batch 1 only touches exports that satisfy all of the following:
- React Doctor flags the file under `knip/exports`
- `rg` confirms there are no imports of the candidate symbol outside its own file
- GitNexus `impact` is `LOW` or the symbol has no meaningful upstream callers
- The file is not acting as a route handler, RPC surface, auth/RBAC helper, or test-support API

If GitNexus and code search disagree, trust current code and defer the symbol.

## Current Evidence

True full scan on 2026-04-08:
- Score: `81/100`
- Warnings: `385`
- `knip/exports`: `120`

GitNexus / code-search findings already established:
- Safe candidate: `src/components/transfers/TransferTypeTabs.tsx#getTransferTypeConfig`
  - `rg` only finds the declaration
  - GitNexus `impact` reports `LOW`, `0` callers
- Safe candidate group in `src/components/page-transition-wrapper.tsx`
  - `PageTransitionWrapper`, `ModalTransition`, `LoadingTransition` have no external references by `rg`
  - `MainContentTransition` is used by `src/app/(app)/layout.tsx`, so keep it exported
- Defer:
  - `src/lib/rbac.ts#normalizeRole` because GitNexus reports `CRITICAL`
  - `src/app/(app)/reports/hooks/use-report-filters.ts#storageKey` because GitNexus reports live report-flow usage
  - `src/components/transfers/TransferTypeTabs.tsx#useTransferTypeTab` because GitNexus reports `HIGH`
  - `src/lib/ai/tools/registry.ts` test-support exports because `rg` shows multiple test imports even when GitNexus under-reports them
  - Any symbol in API adapter / route utility files unless both app and tests show zero imports

## Expected Outcome

This batch should remove a small but real slice of `knip/exports` with minimal runtime risk:
- `page-transition-wrapper.tsx`: 3 likely exports to de-export
- `TransferTypeTabs.tsx`: 1 likely export to de-export
- `src/components/kpi/index.ts`: several likely unused barrel re-exports after repo-wide import audit

The exact count is less important than proving a repeatable safe pattern for later batches.

### Task 1: Freeze Candidate Inventory

**Files:**
- Modify: `docs/plans/2026-04-08-react-doctor-batch1-unused-exports-plan.md`
- Inspect: `C:/Users/PC/AppData/Local/Temp/react-doctor-3a22b70b-1b34-4cdc-9e8c-13a1f437327d/knip--exports.txt`
- Inspect: `src/components/page-transition-wrapper.tsx`
- Inspect: `src/components/transfers/TransferTypeTabs.tsx`
- Inspect: `src/components/kpi/index.ts`

**Step 1: Reconfirm current candidate symbols with repo-wide search**

Run:
```powershell
rg -n "PageTransitionWrapper|ModalTransition|LoadingTransition|getTransferTypeConfig|StatusConfig|StatusTone|KpiStatusBarProps|TransferStatus|MaintenanceStatus|DeviceQuotaComplianceStatus" src
```

Expected:
- `PageTransitionWrapper`, `ModalTransition`, `LoadingTransition`, and `getTransferTypeConfig` appear only at their declarations
- Some KPI barrel exports appear only in `src/components/kpi/index.ts`

**Step 2: Reconfirm blast radius for every symbol before edit**

Run representative checks:
```text
gitnexus impact("PageTransitionWrapper")
gitnexus impact("getTransferTypeConfig")
gitnexus impact("normalizeRole")
gitnexus impact("storageKey")
```

Expected:
- Low/no callers for keep-scope symbols
- High or critical for deferred symbols

**Step 3: Update this plan if any candidate is no longer safe**

Do not edit source code yet if a symbol gains a real caller.

### Task 2: De-export Unused Page Transition Symbols

**Files:**
- Modify: `src/components/page-transition-wrapper.tsx`
- Test: `src/app/(app)/__tests__/layout.assistant-integration.test.tsx`
- Inspect: `src/app/(app)/layout.tsx`

**Step 1: Write the failing test**

Add or update a focused test near:
- `src/app/(app)/__tests__/layout.assistant-integration.test.tsx`
- or a new dedicated barrel/surface test if the existing layout test is a poor fit

Test intent:
- `MainContentTransition` remains importable
- `PageTransitionWrapper`, `ModalTransition`, and `LoadingTransition` are no longer part of the module's public export surface

Suggested assertion shape:
```ts
const pageTransitions = await import("@/components/page-transition-wrapper")
expect(pageTransitions).toHaveProperty("MainContentTransition")
expect(pageTransitions).not.toHaveProperty("PageTransitionWrapper")
expect(pageTransitions).not.toHaveProperty("ModalTransition")
expect(pageTransitions).not.toHaveProperty("LoadingTransition")
```

**Step 2: Run the focused test to verify RED**

Run:
```powershell
node scripts/npm-run.js run test:run -- "src/app/(app)/__tests__/layout.assistant-integration.test.tsx"
```

Expected:
- FAIL because the module still exports one or more symbols that the new assertion says should be absent

**Step 3: Write down the exact symbols to keep exported**

Keep exported:
- `MainContentTransition`

Convert to internal-only declarations:
- `PageTransitionWrapper`
- `ModalTransition`
- `LoadingTransition`

**Step 4: Write minimal implementation**

Remove only the `export` modifiers from the unused symbols.

Implementation rule:
- Keep component bodies unchanged
- Do not rename symbols
- Do not move files

**Step 5: Run the focused test to verify GREEN**

Run:
```powershell
node scripts/npm-run.js run test:run -- "src/app/(app)/__tests__/layout.assistant-integration.test.tsx"
```

Expected:
- PASS

**Step 6: Run focused verification**

Run:
```powershell
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- "src/app/(app)/__tests__/layout.assistant-integration.test.tsx"
```

Expected:
- `verify:no-explicit-any` passes
- `typecheck` passes
- layout integration test passes

### Task 3: De-export Transfer Tabs Helper Not Used Outside Its Module

**Files:**
- Modify: `src/components/transfers/TransferTypeTabs.tsx`
- Test: `src/app/(app)/transfers/__tests__/TransfersKpi.test.tsx`
- Inspect: `src/app/(app)/transfers/_components/useTransfersPageController.ts`
- Inspect: `src/app/(app)/transfers/_components/TransfersPagePanel.tsx`

**Step 1: Write the failing test**

Add or extend a focused test in:
- `src/app/(app)/transfers/__tests__/TransfersKpi.test.tsx`
- or a new dedicated module-surface test alongside transfers tests if that is cleaner

Test intent:
- `TransferTypeTabs` and `useTransferTypeTab` remain exported
- `getTransferTypeConfig` is not exported from the module surface

Suggested assertion shape:
```ts
const tabsModule = await import("@/components/transfers/TransferTypeTabs")
expect(tabsModule).toHaveProperty("TransferTypeTabs")
expect(tabsModule).toHaveProperty("useTransferTypeTab")
expect(tabsModule).not.toHaveProperty("getTransferTypeConfig")
```

**Step 2: Run the focused test to verify RED**

Run:
```powershell
node scripts/npm-run.js run test:run -- "src/app/(app)/transfers/__tests__/TransfersKpi.test.tsx"
```

Expected:
- FAIL because `getTransferTypeConfig` is still exported

**Step 3: Lock keep/defer symbols for this module**

Keep exported:
- `TransferTypeTabs`
- `useTransferTypeTab`
- `TransferTypeTabsProps`

Convert to internal-only declaration:
- `getTransferTypeConfig`

**Step 4: Write minimal implementation**

Remove only the `export` modifier from `getTransferTypeConfig`.

Implementation rule:
- Do not touch `useTransferTypeTab`
- Do not change hook behavior or URL sync logic

**Step 5: Run the focused test to verify GREEN**

Run:
```powershell
node scripts/npm-run.js run test:run -- "src/app/(app)/transfers/__tests__/TransfersKpi.test.tsx"
```

Expected:
- PASS

**Step 6: Run focused verification**

Run:
```powershell
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- "src/app/(app)/transfers/__tests__/TransfersKpi.test.tsx"
```

Expected:
- no explicit `any` regression
- typecheck passes
- transfers KPI test still passes

### Task 4: Prune Truly Unused KPI Barrel Re-exports

**Files:**
- Modify: `src/components/kpi/index.ts`
- Test: `src/app/(app)/transfers/__tests__/TransfersKpi.test.tsx`
- Test: `src/app/(app)/device-quota/dashboard/__tests__/DeviceQuotaKpi.test.tsx`
- Test: `src/app/(app)/repair-requests/__tests__/RepairRequestsPageLayout.test.tsx`

**Step 1: Write the failing test**

Add or extend a focused barrel-surface test. Preferred location:
- `src/components/kpi/__tests__/KpiStatusBar.test.tsx` if adding one small surface assertion is enough
- otherwise create `src/components/kpi/__tests__/index.test.ts`

Test intent:
- keep required barrel exports accessible
- assert candidate unused type re-exports are not present on the barrel module object

Suggested assertion shape:
```ts
const kpiModule = await import("@/components/kpi")
expect(kpiModule).toHaveProperty("KpiStatusBar")
expect(kpiModule).toHaveProperty("REPAIR_STATUS_CONFIGS")
expect(kpiModule).not.toHaveProperty("StatusConfig")
expect(kpiModule).not.toHaveProperty("StatusTone")
expect(kpiModule).not.toHaveProperty("KpiStatusBarProps")
```

If type-only exports do not appear on the runtime module object, write the red test as an import-surface typecheck assertion instead of a runtime assertion.

**Step 2: Run the focused test to verify RED**

Run:
```powershell
node scripts/npm-run.js run test:run -- "src/components/kpi/__tests__/KpiStatusBar.test.tsx"
```

Expected:
- FAIL because one or more barrel exports still expose symbols marked for removal

**Step 3: Audit every re-export in the barrel**

Keep if repo-wide imports exist:
- `KpiStatusBar`
- `REPAIR_STATUS_CONFIGS`
- `TRANSFER_STATUS_CONFIGS`
- `MAINTENANCE_STATUS_CONFIGS`
- `DEVICE_QUOTA_CONFIGS`
- `RepairStatus`

Likely removal candidates if search still shows zero imports from `@/components/kpi`:
- `StatusConfig`
- `StatusTone`
- `KpiStatusBarProps`
- `TransferStatus`
- `MaintenanceStatus`
- `DeviceQuotaComplianceStatus`

**Step 4: Write minimal implementation**

Remove only the unused re-export fragments from the barrel.

Implementation rule:
- Do not touch underlying source modules like `types.ts` or config files in this batch
- Only shrink the barrel surface

**Step 5: Run the focused test to verify GREEN**

Run:
```powershell
node scripts/npm-run.js run test:run -- "src/components/kpi/__tests__/KpiStatusBar.test.tsx"
```

Expected:
- PASS

**Step 6: Run focused verification**

Run:
```powershell
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- "src/app/(app)/transfers/__tests__/TransfersKpi.test.tsx" "src/app/(app)/device-quota/dashboard/__tests__/DeviceQuotaKpi.test.tsx" "src/app/(app)/repair-requests/__tests__/RepairRequestsPageLayout.test.tsx"
```

Expected:
- typecheck stays green
- KPI-facing tests remain green

### Task 5: Re-run React Doctor and Record Before/After

**Files:**
- Modify: `docs/plans/2026-04-08-react-doctor-batch1-unused-exports-plan.md`
- Inspect: `react-doctor.config.json` (temporary only)

**Step 1: Run required diff verification**

Run:
```powershell
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- "src/app/(app)/__tests__/layout.assistant-integration.test.tsx" "src/app/(app)/transfers/__tests__/TransfersKpi.test.tsx" "src/app/(app)/device-quota/dashboard/__tests__/DeviceQuotaKpi.test.tsx" "src/app/(app)/repair-requests/__tests__/RepairRequestsPageLayout.test.tsx"
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected:
- verification gates pass
- diff scan shows no new unrelated regressions

**Step 2: Run a true full-scan checkpoint**

Run:
```powershell
$cfg = "react-doctor.config.json"
Set-Content -Path $cfg -Value '{"diff": false}' -Encoding utf8
try {
  node scripts/npm-run.js npx react-doctor@latest . --verbose --yes --project nextn
} finally {
  Remove-Item $cfg -Force -ErrorAction SilentlyContinue
}
```

Expected:
- overall score does not regress
- `knip/exports` warning count decreases from the 2026-04-08 baseline

**Step 3: Record results**

Append to session notes / progress log:
- symbols removed from export surface
- verification command outputs
- new `knip/exports` count
- any false positives or GitNexus mismatches found during execution

## Defer List For Later Batches

Do not include these in Batch 1:
- `src/lib/rbac.ts`
- `src/app/(app)/reports/hooks/use-report-filters.ts`
- `src/lib/ai/tools/registry.ts`
- `src/app/api/transfers/legacy-adapter.ts`
- Any symbol whose only usage appears in tests until the team explicitly decides whether test-only exports are acceptable
- Any symbol where GitNexus says low risk but `rg` shows a real import

## Rollback Rule

If any focused test or typecheck fails after a cleanup step:
- revert only the latest symbol-level removal
- keep the rest of the batch intact
- document the symbol as deferred with the reason

## Success Criteria

- `verify:no-explicit-any` passes
- `typecheck` passes
- focused tests pass
- React Doctor full scan shows fewer `knip/exports` warnings than the 2026-04-08 baseline
- no behavior changes, file deletions, or RBAC / routing / API surface changes
