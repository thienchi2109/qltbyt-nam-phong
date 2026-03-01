# Unified Inventory Chart Hooks Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Eliminate React Doctor error-level hook-order findings #5, #6, #7, #8, and #9 in `src/components/unified-inventory-chart.tsx` while preserving behavior.

**Architecture:** Refactor `UnifiedInventoryChart` into a visibility gate wrapper plus an authenticated/visible content component. Keep all stateful/data hooks unconditionally inside the content component render path. Preserve all existing mode behavior and child component contracts.

**Tech Stack:** Next.js App Router, React 18, NextAuth, TanStack Query v5, TypeScript, React Doctor, ESLint, Vitest.

---

## Context

React Doctor full scan (`docs/react-doctor-full-scan-2026-02-25.md`) reports:
- `src/components/unified-inventory-chart.tsx:49` — `useQuery` called conditionally
- `src/components/unified-inventory-chart.tsx:60` — `useState` called conditionally
- `src/components/unified-inventory-chart.tsx:61` — `useMemo` called conditionally
- `src/components/unified-inventory-chart.tsx:75` — `useMemo` called conditionally
- `src/components/unified-inventory-chart.tsx:81` — `useEffect` called conditionally

Root cause: early return at `src/components/unified-inventory-chart.tsx:44` occurs before these hooks.

Call-site to preserve:
- `src/app/(app)/reports/components/inventory-report-tab.tsx:333-338`

---

## TDD Rule for This Plan

Follow strict Red → Green → Refactor for each behavior change.
- Do **not** modify production code in `src/components/unified-inventory-chart.tsx` before adding a failing test.
- For each new test, run it and confirm it fails for the expected reason.
- Implement minimal production change to make test pass.
- Re-run tests and keep output clean.

---

### Task 1: Create TDD Baseline for Hook-Order Regression Surface

**Files:**
- Create/Modify test: `src/components/__tests__/unified-inventory-chart.hooks-and-modes.test.tsx`
- Read: `docs/react-doctor-full-scan-2026-02-25.md`
- Production target (later): `src/components/unified-inventory-chart.tsx`

**Step 1 (RED): Write failing test for hidden → visible rerender**
- Mock `useSession` + role gates so first render returns `null` path and rerender enters visible path.
- Assert no runtime hook-order error is thrown during rerender.

**Step 2 (VERIFY RED): Run only this test and confirm fail**
```bash
node scripts/npm-run.js run test:run -- "src/components/__tests__/unified-inventory-chart.hooks-and-modes.test.tsx"
```
Expected: fail with hook-order/rerender mismatch under current implementation.

**Step 3 (RED): Add failing test for visible → hidden rerender**
- First render visible mode, rerender hidden mode.
- Assert transition does not throw runtime hook-order errors.

**Step 4 (VERIFY RED): Re-run same test file and confirm fail**
```bash
node scripts/npm-run.js run test:run -- "src/components/__tests__/unified-inventory-chart.hooks-and-modes.test.tsx"
```

---

### Task 2: Green Cycle #1 — Gate + Content Split

**Files:**
- Modify: `src/components/unified-inventory-chart.tsx:31-163`
- Reference: `src/app/(app)/reports/page.tsx` auth-gate/content split pattern

**Step 1 (GREEN): Minimal implementation**
- Keep `UnifiedInventoryChart` wrapper for role/visibility gate only.
- Introduce internal `UnifiedInventoryChartContent` receiving existing props.
- Move these hooks into content component and keep unconditional order:
  - `useQuery`
  - `React.useState`
  - `React.useMemo` (sortedData)
  - `React.useMemo` (visibleData)
  - `React.useEffect` (telemetry)

**Step 2 (VERIFY GREEN): Run target test file**
```bash
node scripts/npm-run.js run test:run -- "src/components/__tests__/unified-inventory-chart.hooks-and-modes.test.tsx"
```
Expected: rerender transition tests now pass.

**Step 3 (REFACTOR, optional/minimal):**
- Keep naming and extraction clean only if needed for readability.
- No behavior changes.

**Step 4 (VERIFY GREEN again):**
```bash
node scripts/npm-run.js run test:run -- "src/components/__tests__/unified-inventory-chart.hooks-and-modes.test.tsx"
```

---

### Task 3: Green Cycle #2 — Behavior Preservation Tests

**Files:**
- Modify test: `src/components/__tests__/unified-inventory-chart.hooks-and-modes.test.tsx`
- Validate prod: `src/components/unified-inventory-chart.tsx`

**Step 1 (RED): Add failing test for all-mode path**
- Visible role + `tenantFilter='all'` should render facilities-distribution path (card/message/chart path).

**Step 2 (VERIFY RED): Run target test file and confirm fail**
```bash
node scripts/npm-run.js run test:run -- "src/components/__tests__/unified-inventory-chart.hooks-and-modes.test.tsx"
```

**Step 3 (GREEN): Minimal adjustments (if needed) to preserve exact behavior**
- Ensure all-mode branch remains unchanged in output semantics.

**Step 4 (VERIFY GREEN): Re-run target tests**
```bash
node scripts/npm-run.js run test:run -- "src/components/__tests__/unified-inventory-chart.hooks-and-modes.test.tsx"
```
Expected: all tests in this file pass.

**Step 5 (RED/GREEN): Add and satisfy single-mode + non-visible-role behavior tests**
- Single mode renders `InteractiveEquipmentChart`.
- Non-visible role returns `null`.
- Re-run test file after each step.

---

### Task 4: System Verification for Findings #5/#6/#7/#8/#9

**Files:**
- Validate: `src/components/unified-inventory-chart.tsx`
- Validate against source report: `docs/react-doctor-full-scan-2026-02-25.md`

**Step 1: Run targeted lint**
```bash
node scripts/npm-run.js run lint -- --file "src/components/unified-inventory-chart.tsx"
```
Expected: no `react-hooks/rules-of-hooks` errors in target component.

**Step 2: Run React Doctor full scan**
```bash
node scripts/npm-run.js run react-doctor:verbose
```
Expected: findings #5/#6/#7/#8/#9 no longer present.

**Step 3: Run typecheck safety pass**
```bash
node scripts/npm-run.js run typecheck
```
Expected: no new TypeScript errors caused by refactor.

---

## Safety and Rollback

- Keep this pass scoped to `unified-inventory-chart.tsx` + focused test file.
- Preserve props/contracts passed from inventory report tab.
- Preserve mode semantics and UI text.
- If regression appears, revert both production file and focused test file together, then re-apply via TDD cycle.

---

## Notes on Approach Selection

- **Recommended (selected):** gate + content split (best maintainability; structurally enforces hook order).
- **Alternative (not selected):** hoist hooks in a single component.
- **Not in scope now:** extracting a reusable custom hook for chart data logic.
