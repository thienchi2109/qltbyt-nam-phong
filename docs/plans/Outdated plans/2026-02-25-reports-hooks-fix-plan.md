# Reports Hooks Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Eliminate React Doctor error-level hook-order findings #2, #3, and #4 in `src/app/(app)/reports/page.tsx`.

**Architecture:** Refactor the reports page into an auth-gate component plus an authenticated content component. Move redirect side effects into `useEffect`, and keep `useState`/`useMemo` calls unconditionally inside the authenticated content render path to satisfy React Hooks ordering rules.

**Tech Stack:** Next.js App Router, React 18, NextAuth, TypeScript, React Doctor, ESLint, Vitest/Jest test runner in repo.

---

## Context
React Doctor full scan (`docs/react-doctor-full-scan-2026-02-25.md`) reports:
- `src/app/(app)/reports/page.tsx:105` — `useState` called conditionally
- `src/app/(app)/reports/page.tsx:109` — `useMemo` called conditionally
- `src/app/(app)/reports/page.tsx:120` — `useMemo` called conditionally

Root cause: early returns for loading/unauthenticated occur before these hooks. There is also render-path navigation (`router.push("/")`) that should be effect-driven.

Reference patterns to reuse:
- `src/app/(app)/maintenance/page.tsx:11-35`
- `src/app/(app)/transfers/page.tsx:106-136`

---

## TDD Rule for This Plan
Follow strict Red → Green → Refactor for each behavior change.
- Do **not** modify production code in `src/app/(app)/reports/page.tsx` before adding a failing test.
- For each new test, run it and confirm it fails for the expected reason.
- Implement the minimal production change to make the test pass.
- Re-run tests and keep output clean.

---

### Task 1: Create TDD Baseline for Current Bug Surface

**Files:**
- Create/Modify test: `src/app/(app)/reports/__tests__/ReportsPage.auth-and-hooks.test.tsx`
- Read: `docs/react-doctor-full-scan-2026-02-25.md`
- Production target (later): `src/app/(app)/reports/page.tsx`

**Step 1 (RED): Write failing test for unauthenticated redirect behavior**
- Add a test asserting redirect is triggered via side effect path and unauthenticated state renders fallback/null without calling hook-dependent report content.

**Step 2 (VERIFY RED): Run only this test and confirm fail**
```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/reports/__tests__/ReportsPage.auth-and-hooks.test.tsx"
```
Expected: fail due to current render-path redirect/hook flow not matching test expectation.

**Step 3 (RED): Add failing test for authenticated render path**
- Assert authenticated render reaches tab UI and content-container path consistently.

**Step 4 (VERIFY RED): Re-run same test file and confirm fail for expected reason**
```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/reports/__tests__/ReportsPage.auth-and-hooks.test.tsx"
```

---

### Task 2: Green Cycle #1 — Auth Gate Refactor

**Files:**
- Modify: `src/app/(app)/reports/page.tsx:74-103`
- Reference: `src/app/(app)/maintenance/page.tsx:15-34`

**Step 1 (GREEN): Minimal implementation**
- Keep top-level `ReportsPage` focused on `useSession`/`useRouter`.
- Replace render-time `router.push("/")` with `React.useEffect` redirect.
- Return loading/fallback for `loading` and `unauthenticated` states.
- Render content component only when authenticated.

**Step 2 (VERIFY GREEN): Run target test file**
```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/reports/__tests__/ReportsPage.auth-and-hooks.test.tsx"
```
Expected: previously failing auth redirect test now passes.

**Step 3 (REFACTOR, optional/minimal):**
- Clean only naming/extraction needed for readability, no behavior changes.

**Step 4 (VERIFY GREEN again):**
```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/reports/__tests__/ReportsPage.auth-and-hooks.test.tsx"
```

---

### Task 3: Green Cycle #2 — Hook Order Stabilization

**Files:**
- Modify: `src/app/(app)/reports/page.tsx:104-191`
- Test: `src/app/(app)/reports/__tests__/ReportsPage.auth-and-hooks.test.tsx`

**Step 1 (RED): Add failing test that guards stable authenticated hook/render path**
- Assert authenticated path renders tabs and does not branch around hook-dependent section.
- Keep test behavior-focused (no implementation-detail assertions).

**Step 2 (VERIFY RED): Run target test and confirm fail**
```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/reports/__tests__/ReportsPage.auth-and-hooks.test.tsx"
```

**Step 3 (GREEN): Minimal production changes**
- Move and keep these hooks unconditionally inside authenticated content component:
  - `useTenantSelection()`
  - `React.useState("inventory")`
  - `tenantFilter` `React.useMemo(...)`
  - `effectiveTenantKey` `React.useMemo(...)`
- Preserve existing UI and child props exactly.

**Step 4 (VERIFY GREEN): Re-run target tests**
```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/reports/__tests__/ReportsPage.auth-and-hooks.test.tsx"
```
Expected: all tests in this file pass.

---

### Task 4: System Verification for Findings #2/#3/#4

**Files:**
- Validate: `src/app/(app)/reports/page.tsx`
- Validate against source report: `docs/react-doctor-full-scan-2026-02-25.md`

**Step 1: Run lint**
```bash
node scripts/npm-run.js run lint
```
Expected: no `react-hooks/rules-of-hooks` errors for reports page target lines.

**Step 2: Run React Doctor full scan**
```bash
node scripts/npm-run.js run react-doctor:verbose
```
Expected: findings #2/#3/#4 no longer present.

**Step 3: Run typecheck safety pass**
```bash
node scripts/npm-run.js run typecheck
```
Expected: no new TypeScript errors caused by refactor.

---

## Safety and Rollback
- Keep this pass scoped to reports page + its focused test file.
- Preserve props/contracts passed to:
  - `InventoryReportTab`
  - `MaintenanceReportTab`
  - `UsageAnalyticsDashboard`
- If regression appears, revert `src/app/(app)/reports/page.tsx` and the new/modified test file together, then re-apply via TDD cycle.

---

## Notes on Approach Selection
- **Recommended:** auth gate + content split (matches existing project pattern; least long-term risk).
- **Alternative (not preferred):** hoist hooks above early returns in a single component (works but easier to regress).
- **Not in scope now:** introducing shared auth abstraction.
