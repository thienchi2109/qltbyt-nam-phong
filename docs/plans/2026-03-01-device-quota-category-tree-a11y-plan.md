# DeviceQuotaCategoryTree A11y Semantics Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve `jsx-a11y/role-has-required-aria-props` in `DeviceQuotaCategoryTree` by using semantic list markup (`ul/li`) instead of `listbox/option`.

**Architecture:** Keep current visual behavior and actions unchanged. Replace ARIA widget roles that imply selection state with native list structure because this UI is informational/actions-oriented, not a selectable listbox.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library, ESLint (jsx-a11y)

---

### Task 1: RED - Add a failing semantic test

**Files:**
- Modify: `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryTree.test.tsx`

1. Add a test that renders categories and asserts:
   - A list named `Danh mục thiết bị` exists.
   - No `listbox` role exists.
   - No `option` role exists.
2. Run the focused test file and confirm failure due to current `listbox/option` markup.

Run:
```bash
npm run test:run -- "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryTree.test.tsx"
```

### Task 2: GREEN - Minimal semantic refactor

**Files:**
- Modify: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx`

1. Change each category item wrapper from `div role="option"` to `li`.
2. Change list container from `div role="listbox"` to `ul aria-label="Danh mục thiết bị"`.
3. Keep existing classes, spacing, and behavior intact.

### Task 3: Verify and regressions check

**Files:**
- None (verification only)

1. Re-run focused test file and confirm pass.
2. Run lint for changed files.
3. Run repo quality gates:
   - `npm run n:lint`
   - `npm run n:typecheck`
   - `npm run n:test`

