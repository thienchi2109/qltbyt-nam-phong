# Cached Maintenance Hooks Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Trim unused exports from `use-cached-maintenance.ts` while guarding the intended public API via tests.

**Architecture:** Inventory current exports, keep only referenced helpers, and use vitest guard tests to enforce visibility. Implementation bodies remain untouched to avoid behavioral risk.

**Tech Stack:** Next.js 15 • React 18 • TypeScript • TanStack Query • Vitest • React Doctor diagnostics

---

### Task 1: Inventory maintenance hook exports

**Files:**
- Modify: `docs/plans/2026-03-02-cached-maintenance-hooks-design.md`

**Step 1: List exports via warpgrep**
Run: `warpgrep "export function" src/hooks/use-cached-maintenance.ts`
Expected: list of all exported hooks/functions.

**Step 2: Search usages per export**
For each export, run: `warpgrep "useMaintenancePlans" -r src`
Expected: identify consuming files or confirm zero matches.

**Step 3: Record categories**
Update the design doc "Inventory" section with Category A/B table so future work knows which exports stay or go.

**Step 4: git status checkpoint**
Run: `git status -sb`
Expected: design doc modified only.

---

### Task 2: Add guard tests (RED)

**Files:**
- Create: `src/hooks/__tests__/use-cached-maintenance-barrel.test.ts`

**Step 1: Write failing tests**
```ts
import * as CachedMaintenance from '@/hooks/use-cached-maintenance'

describe('cached maintenance public API', () => {
  it('exposes maintenanceKeys helper', () => {
    expect('maintenanceKeys' in CachedMaintenance).toBe(true)
  })

  it.each([
    'useMaintenanceHistory',
    'useMaintenanceDetail',
    // add every Category B export slated for removal
  ])('does not expose %s', (name) => {
    expect(name in CachedMaintenance).toBe(false)
  })
})
```

**Step 2: Run tests to confirm failure**
Run: `node scripts/npm-run.js run test:run -- src/hooks/__tests__/use-cached-maintenance-barrel.test.ts`
Expected: FAIL because the soon-to-be-removed exports still exist.

**Step 3: Stage test file**
Run: `git add src/hooks/__tests__/use-cached-maintenance-barrel.test.ts`
Expected: file staged for commit later (keeps RED state recorded).

---

### Task 3: Remove unused exports (GREEN)

**Files:**
- Modify: `src/hooks/use-cached-maintenance.ts`

**Step 1: Delete Category B exports from barrel**
```ts
// remove lines like
export function useMaintenanceHistory(...) { ... }

// replace with non-exported declarations if needed
function useMaintenanceHistory(...) { ... }
```
Ensure only Category A helpers remain exported (e.g., `maintenanceKeys`, still `export const maintenanceKeys = ...`).

**Step 2: Re-run guard test**
Run: `node scripts/npm-run.js run test:run -- src/hooks/__tests__/use-cached-maintenance-barrel.test.ts`
Expected: PASS now that exports are trimmed.

**Step 3: Update watchers/imports if TypeScript reports unused functions**
If compiler flags unused locals, add `export` placeholders for future use or convert to `const` to avoid lint issues (but keep code reachable for future phases).

**Step 4: Stage source changes**
Run: `git add src/hooks/use-cached-maintenance.ts`
Expected: staged along with guard test.

---

### Task 4: Verification suite

**Files:**
- Existing

**Step 1: Run targeted vitest suite**
Run: `node scripts/npm-run.js run test:run`
Expected: PASS (document any known baseline failures unrelated to this change).

**Step 2: Type check**
Run: `node scripts/npm-run.js run typecheck`
Expected: PASS.

**Step 3: Lint**
Run: `node scripts/npm-run.js run lint`
Expected: PASS or known baseline failures; note any unrelated issues in summary.

---

### Task 5: React Doctor regression check

**Files:**
- Existing

**Step 1: Score-only scan**
Run: `node scripts/npm-run.js npx react-doctor@latest . --score --yes --project nextn --no-ami`
Expected: `knip/exports` count decreases or stays flat; record result.

**Step 2: Verbose scan (optional if required)**
Run: `node scripts/npm-run.js run react-doctor:verbose`
Expected: confirm no new warnings in other categories.

---

### Task 6: Commit and summary

**Files:**
- All touched files

**Step 1: Review staged changes**
Run: `git status -sb`
Expected: guard test, `use-cached-maintenance.ts`, design doc (if updated) staged.

**Step 2: Commit**
```bash
git commit -m "chore: prune cached maintenance exports"
```
Include co-author trailer as needed.

**Step 3: Summarize verification**
Document test/typecheck/lint/react-doctor outputs in PR description or session summary.

**Step 4: Ready for execution**
Hand off to `superpowers:executing-plans` per instructions.
