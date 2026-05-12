# Issue 450 React Doctor Auth Shell Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the remaining React Doctor cleanup items for `LoginForm` and `AppLayoutShell` without changing login, logout, or session-transition behavior.

**Architecture:** Treat this as a narrow UI/refactor cleanup, not an auth behavior change. Add source-level RED guards for the exact React Doctor categories, then make small class-token substitutions and a focused local-state reducer refactor in `AppLayoutShellContent`.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Vitest, React Testing Library, React Doctor.

---

## Scope

Issue: https://github.com/thienchi2109/qltbyt-nam-phong/issues/450

Remaining diagnostics from the post-PR scan:

- `react-doctor/design-no-redundant-size-axes` x12 in `src/app/_components/LoginForm.tsx` and `src/app/(app)/_components/AppLayoutShell.tsx`.
- `react-doctor/design-no-default-tailwind-palette` x6 in `src/app/(app)/_components/AppLayoutShell.tsx`.
- `react-doctor/prefer-useReducer` in `AppLayoutShellContent`.

Do not change:

- Login credential submission behavior.
- Dashboard redirect behavior.
- Logout/session-expiry behavior.
- Auth transition tests introduced by PR #451.

## File Map

- Modify: `src/app/_components/LoginForm.tsx`
  - Convert matching `w-* h-*` icon/spinner classes to `size-*`.
- Modify: `src/app/(app)/_components/AppLayoutShell.tsx`
  - Convert matching `w-* h-*` classes to `size-*`.
  - Replace `slate-*` defaults with project tokens such as `border-border`, `bg-muted/40`, and `text-muted-foreground`.
  - Group shell UI booleans with a reducer if that is the simplest way to satisfy the React Doctor warning.
- Create: `src/app/(app)/__tests__/auth-shell-react-doctor-cleanup.source.test.ts`
  - Source-level guard for the cleanup categories in issue #450.
- Reuse: `src/app/_components/__tests__/LoginForm.test.tsx`
  - Existing login behavior regression suite.
- Reuse: `src/app/(app)/__tests__/AppLayoutShell.test.tsx`
  - Existing logout/session behavior regression suite.

## Chunk 1: RED Source Guards

### Task 1: Add source guard tests for issue #450

**Files:**
- Create: `src/app/(app)/__tests__/auth-shell-react-doctor-cleanup.source.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()
const loginFormSource = readFileSync(
  join(repoRoot, "src/app/_components/LoginForm.tsx"),
  "utf8",
)
const appLayoutShellSource = readFileSync(
  join(repoRoot, "src/app/(app)/_components/AppLayoutShell.tsx"),
  "utf8",
)

const redundantMatchingSizeAxesPattern =
  /\b(?:w-(\d+(?:\.\d+)?)\s+h-\1|h-(\d+(?:\.\d+)?)\s+w-\2)\b/

describe("auth shell React Doctor cleanup", () => {
  it("uses size-* utilities instead of matching width and height axes", () => {
    expect(loginFormSource).not.toMatch(redundantMatchingSizeAxesPattern)
    expect(appLayoutShellSource).not.toMatch(redundantMatchingSizeAxesPattern)
  })

  it("uses project tokens instead of slate palette defaults in the app shell", () => {
    expect(appLayoutShellSource).not.toContain("slate-")
  })

  it("groups AppLayoutShellContent local UI state outside repeated useState calls", () => {
    expect(appLayoutShellSource).not.toContain("React.useState(")
  })
})
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/__tests__/auth-shell-react-doctor-cleanup.source.test.ts'
```

Expected: FAIL because current source still contains matching `w-* h-*`, `slate-*`, and five `React.useState(` calls in `AppLayoutShellContent`.

## Chunk 2: Class Token Cleanup

### Task 2: Replace matching width/height pairs with size utilities

**Files:**
- Modify: `src/app/_components/LoginForm.tsx`
- Modify: `src/app/(app)/_components/AppLayoutShell.tsx`
- Test: `src/app/(app)/__tests__/auth-shell-react-doctor-cleanup.source.test.ts`

- [ ] **Step 1: Update `LoginForm` classes**

Change:

- `w-8 h-8` -> `size-8`
- `w-10 h-10` -> `size-10`
- `h-3.5 w-3.5` -> `size-3.5`
- `w-5 h-5` -> `size-5`

- [ ] **Step 2: Update `AppLayoutShell` classes**

Change:

- `h-16 w-16` -> `size-16`
- `h-8 w-8` -> `size-8`
- `h-5 w-5` -> `size-5`
- `h-7 w-7` -> `size-7`
- `h-4 w-4` -> `size-4`
- `h-3 w-3` -> `size-3`

Do not change intentionally non-square sizes such as `h-5 w-48`.

- [ ] **Step 3: Run the source guard**

Run:

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/__tests__/auth-shell-react-doctor-cleanup.source.test.ts'
```

Expected: still FAIL only on `slate-*` and `React.useState(`.

## Chunk 3: Palette Token Cleanup

### Task 3: Replace default slate palette usage in the app shell

**Files:**
- Modify: `src/app/(app)/_components/AppLayoutShell.tsx`
- Test: `src/app/(app)/__tests__/auth-shell-react-doctor-cleanup.source.test.ts`

- [ ] **Step 1: Replace `slate-*` usage with project tokens**

Use existing Tailwind token classes:

- `border-slate-200` -> `border-border`
- `bg-slate-50` -> `bg-muted/40`
- `text-slate-600` -> `text-muted-foreground`

- [ ] **Step 2: Run the source guard**

Run:

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/__tests__/auth-shell-react-doctor-cleanup.source.test.ts'
```

Expected: still FAIL only on `React.useState(`.

## Chunk 4: AppLayoutShell Local State Refactor

### Task 4: Group local UI booleans with a reducer

**Files:**
- Modify: `src/app/(app)/_components/AppLayoutShell.tsx`
- Test: `src/app/(app)/__tests__/AppLayoutShell.test.tsx`
- Test: `src/app/(app)/__tests__/auth-shell-react-doctor-cleanup.source.test.ts`

- [ ] **Step 1: Replace repeated `React.useState` calls with `React.useReducer`**

Add a small reducer near the component types:

```ts
type AppLayoutUiState = {
  isSidebarOpen: boolean
  isMobileSheetOpen: boolean
  isChangePasswordOpen: boolean
  isAssistantOpen: boolean
  isSigningOut: boolean
}

type AppLayoutUiAction =
  | { type: "setSidebarOpen"; value: boolean }
  | { type: "setMobileSheetOpen"; value: boolean }
  | { type: "setChangePasswordOpen"; value: boolean }
  | { type: "setAssistantOpen"; value: boolean }
  | { type: "setSigningOut"; value: boolean }

const initialAppLayoutUiState: AppLayoutUiState = {
  isSidebarOpen: true,
  isMobileSheetOpen: false,
  isChangePasswordOpen: false,
  isAssistantOpen: false,
  isSigningOut: false,
}

function appLayoutUiReducer(
  state: AppLayoutUiState,
  action: AppLayoutUiAction,
): AppLayoutUiState {
  switch (action.type) {
    case "setSidebarOpen":
      return { ...state, isSidebarOpen: action.value }
    case "setMobileSheetOpen":
      return { ...state, isMobileSheetOpen: action.value }
    case "setChangePasswordOpen":
      return { ...state, isChangePasswordOpen: action.value }
    case "setAssistantOpen":
      return { ...state, isAssistantOpen: action.value }
    case "setSigningOut":
      return { ...state, isSigningOut: action.value }
  }
}
```

In `AppLayoutShellContent`, replace individual state/setter calls with:

```ts
const [uiState, dispatchUi] = React.useReducer(appLayoutUiReducer, initialAppLayoutUiState)
```

Then map existing handlers to dispatch calls, for example:

```ts
onOpenChange={(value) => dispatchUi({ type: "setChangePasswordOpen", value })}
onClick={() => dispatchUi({ type: "setSidebarOpen", value: !uiState.isSidebarOpen })}
onToggle={() => dispatchUi({ type: "setAssistantOpen", value: !uiState.isAssistantOpen })}
dispatchUi({ type: "setSigningOut", value: true })
dispatchUi({ type: "setSigningOut", value: false })
```

- [ ] **Step 2: Run source guard and behavior tests**

Run:

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/__tests__/auth-shell-react-doctor-cleanup.source.test.ts' 'src/app/(app)/__tests__/AppLayoutShell.test.tsx'
```

Expected: PASS. Existing logout/session behavior remains unchanged.

## Chunk 5: Final Verification And PR

### Task 5: Run required verification and close issue

**Files:**
- No planned code changes beyond Tasks 1-4.

- [ ] **Step 1: Run repo TS/React gates**

Run:

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- 'src/app/(app)/__tests__/auth-shell-react-doctor-cleanup.source.test.ts' src/app/_components/__tests__/LoginForm.test.tsx 'src/app/(app)/__tests__/AppLayoutShell.test.tsx'
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected:

- No explicit `any`.
- Typecheck passes.
- Focused source/auth tests pass.
- React Doctor no longer reports the issue #450 categories in the touched files, or the PR documents any intentionally retained warning.

- [ ] **Step 2: Commit**

```bash
git add src/app/_components/LoginForm.tsx 'src/app/(app)/_components/AppLayoutShell.tsx' 'src/app/(app)/__tests__/auth-shell-react-doctor-cleanup.source.test.ts'
git commit -m "chore: clean auth shell doctor warnings"
```

- [ ] **Step 3: Open PR**

PR body must include:

```md
Closes #450

## Summary
- Add source guard tests for auth shell React Doctor cleanup.
- Replace redundant square size axes with size utilities.
- Replace app shell slate palette defaults with project tokens.
- Group app shell local UI booleans through a reducer.

## Test Plan
- [ ] node scripts/npm-run.js run verify:no-explicit-any
- [ ] node scripts/npm-run.js run typecheck
- [ ] node scripts/npm-run.js run test:run -- 'src/app/(app)/__tests__/auth-shell-react-doctor-cleanup.source.test.ts' src/app/_components/__tests__/LoginForm.test.tsx 'src/app/(app)/__tests__/AppLayoutShell.test.tsx'
- [ ] node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

