# Maintenance Context Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce `src/app/(app)/maintenance/page.tsx` from 1132 lines to `<= 450` lines by adopting the context pattern already used in RepairRequests and Equipment modules.

**Architecture:** Convert maintenance page orchestration to a provider + page client model. `page.tsx` becomes a thin wrapper that mounts `MaintenanceProvider` and `MaintenancePageClient`. Move shared state/actions from prop-drilled components into `MaintenanceContext`, while reusing existing hooks (`use-maintenance-drafts`, `use-maintenance-operations`, `use-maintenance-print`) instead of duplicating logic.

**Tech Stack:** Next.js App Router, React 18, TypeScript, TanStack Query, TanStack Table, Vitest, Testing Library

---

## Alignment Notes

- This plan is aligned to `docs/plans/2026-02-06-maintenance-page-refactor-plan.md`.
- Architectural direction: **Context pattern**, not controller-hooks-only.
- Scope includes:
  - `MaintenanceContext.tsx`
  - `MaintenancePageClient.tsx`
  - `useMaintenanceContext.ts`
  - migration of `mobile-maintenance-layout.tsx` and `maintenance-dialogs.tsx` to context consumers
  - thin wrapper `page.tsx`

## Task 1: Add Characterization Tests Before Refactor

**Files:**
- Create: `src/app/(app)/maintenance/__tests__/maintenance-page.characterization.test.tsx`
- Modify: `src/app/(app)/maintenance/__tests__/maintenance-columns-edit.test.tsx` (only if helper mocks need reuse)

**Step 1: Write the failing test**

```tsx
it("renders plans tab label for authenticated users", async () => {
  render(<MaintenancePage />)
  expect(await screen.findByRole("tab", { name: /Lập Kế hoạch/i })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/maintenance-page.characterization.test.tsx"`  
Expected: FAIL until session/query/router mocks are wired.

**Step 3: Write minimal implementation**

```tsx
// Add required mocks for:
// - useSession
// - useMaintenancePlans
// - useSearchParams/useRouter
// Assert baseline behavior only (no new behavior).
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/maintenance-page.characterization.test.tsx"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add "src/app/(app)/maintenance/__tests__/maintenance-page.characterization.test.tsx"
git commit -m "test(maintenance): add baseline characterization for page refactor"
```

## Task 2: Create Context Consumer Hook

**Files:**
- Create: `src/app/(app)/maintenance/_hooks/useMaintenanceContext.ts`
- Create: `src/app/(app)/maintenance/__tests__/useMaintenanceContext.test.tsx`

**Step 1: Write the failing test**

```tsx
it("throws when used outside MaintenanceProvider", () => {
  expect(() => renderHook(() => useMaintenanceContext())).toThrow(
    "useMaintenanceContext must be used within MaintenanceProvider"
  )
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/useMaintenanceContext.test.tsx"`  
Expected: FAIL because hook/context files do not exist.

**Step 3: Write minimal implementation**

```ts
import * as React from "react"
import { MaintenanceContext } from "../_components/MaintenanceContext"

export function useMaintenanceContext() {
  const context = React.useContext(MaintenanceContext)
  if (!context) throw new Error("useMaintenanceContext must be used within MaintenanceProvider")
  return context
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/useMaintenanceContext.test.tsx"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add "src/app/(app)/maintenance/_hooks/useMaintenanceContext.ts" \
        "src/app/(app)/maintenance/__tests__/useMaintenanceContext.test.tsx"
git commit -m "feat(maintenance): add MaintenanceContext consumer hook"
```

## Task 3: Create `MaintenanceContext.tsx` Provider

**Files:**
- Create: `src/app/(app)/maintenance/_components/MaintenanceContext.tsx`
- Create: `src/app/(app)/maintenance/__tests__/MaintenanceContext.test.tsx`
- Modify: `src/app/(app)/maintenance/_hooks/use-maintenance-drafts.ts` (only if API changes are required for context composition)

**Step 1: Write the failing test**

```tsx
it("provides dialog actions and draft state", () => {
  const { result } = renderHook(() => useMaintenanceContext(), { wrapper: MaintenanceProvider })
  expect(result.current.dialogState.isAddPlanDialogOpen).toBe(false)
  expect(typeof result.current.actions.setIsAddPlanDialogOpen).toBe("function")
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/MaintenanceContext.test.tsx"`  
Expected: FAIL with missing provider/context exports.

**Step 3: Write minimal implementation**

```tsx
export interface MaintenanceContextValue {
  user: SessionUser | null
  permissions: { isRegionalLeader: boolean; canManagePlans: boolean; canCompleteTask: boolean }
  dialogState: { isAddPlanDialogOpen: boolean; isAddTasksDialogOpen: boolean; ... }
  planState: { selectedPlan: MaintenancePlan | null; activeTab: string; ... }
  taskState: { tasks: MaintenanceTask[]; draftTasks: MaintenanceTask[]; hasChanges: boolean; ... }
  actions: { setSelectedPlan(...); setActiveTab(...); handleSaveAllChanges(...); ... }
}
```

Inside provider compose existing hooks:
- `useMaintenanceOperations(...)`
- `useMaintenanceDrafts(...)` (replace duplicated inline logic)
- `useMaintenancePrint(...)`

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/MaintenanceContext.test.tsx"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add "src/app/(app)/maintenance/_components/MaintenanceContext.tsx" \
        "src/app/(app)/maintenance/__tests__/MaintenanceContext.test.tsx" \
        "src/app/(app)/maintenance/_hooks/use-maintenance-drafts.ts"
git commit -m "feat(maintenance): add context provider for maintenance workflow"
```

## Task 4: Create `MaintenancePageClient.tsx`

**Files:**
- Create: `src/app/(app)/maintenance/_components/MaintenancePageClient.tsx`
- Create: `src/app/(app)/maintenance/__tests__/MaintenancePageClient.test.tsx`
- Modify: `src/app/(app)/maintenance/page.tsx` (temporarily import-and-render for test wiring only)

**Step 1: Write the failing test**

```tsx
it("renders plans and tasks tabs inside provider", () => {
  render(
    <MaintenanceProvider>
      <MaintenancePageClient />
    </MaintenanceProvider>
  )
  expect(screen.getByRole("tab", { name: /Lập Kế hoạch/i })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/MaintenancePageClient.test.tsx"`  
Expected: FAIL due missing component.

**Step 3: Write minimal implementation**

```tsx
export function MaintenancePageClient() {
  // move orchestration from page.tsx:
  // - server-side plan filtering/pagination
  // - facility loading/filter state
  // - table setup (plan + task)
  // - mobile/desktop branch
  // Keep existing UI text and business logic unchanged.
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/MaintenancePageClient.test.tsx"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add "src/app/(app)/maintenance/_components/MaintenancePageClient.tsx" \
        "src/app/(app)/maintenance/__tests__/MaintenancePageClient.test.tsx"
git commit -m "refactor(maintenance): move page orchestration to MaintenancePageClient"
```

## Task 5: Refactor `page.tsx` to Thin Wrapper

**Files:**
- Modify: `src/app/(app)/maintenance/page.tsx`
- Create: `src/app/(app)/maintenance/__tests__/maintenance-page.wrapper.test.tsx`

**Step 1: Write the failing test**

```tsx
it("mounts provider and page client", () => {
  render(<MaintenancePage />)
  expect(screen.getByRole("tab", { name: /Lập Kế hoạch/i })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/maintenance-page.wrapper.test.tsx"`  
Expected: FAIL until wrapper refactor is done.

**Step 3: Write minimal implementation**

```tsx
export default function MaintenancePage() {
  return (
    <MaintenanceProvider>
      <MaintenancePageClient />
    </MaintenanceProvider>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/maintenance-page.wrapper.test.tsx"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add "src/app/(app)/maintenance/page.tsx" \
        "src/app/(app)/maintenance/__tests__/maintenance-page.wrapper.test.tsx"
git commit -m "refactor(maintenance): make page.tsx thin provider wrapper"
```

## Task 6: Migrate `mobile-maintenance-layout.tsx` to Context Consumption

**Files:**
- Modify: `src/app/(app)/maintenance/_components/mobile-maintenance-layout.tsx`
- Create: `src/app/(app)/maintenance/__tests__/mobile-maintenance-layout.context.test.tsx`

**Step 1: Write the failing test**

```tsx
it("renders from context without 56-prop contract", () => {
  render(
    <MaintenanceProvider>
      <MobileMaintenanceLayout />
    </MaintenanceProvider>
  )
  expect(screen.getByRole("tab", { name: /Kế hoạch/i })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/mobile-maintenance-layout.context.test.tsx"`  
Expected: FAIL while component still requires prop-heavy interface.

**Step 3: Write minimal implementation**

```tsx
export function MobileMaintenanceLayout() {
  const { planState, taskState, permissions, actions } = useMaintenanceContext()
  // keep existing markup and behavior; replace props reads with context reads
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/mobile-maintenance-layout.context.test.tsx"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add "src/app/(app)/maintenance/_components/mobile-maintenance-layout.tsx" \
        "src/app/(app)/maintenance/__tests__/mobile-maintenance-layout.context.test.tsx"
git commit -m "refactor(maintenance): remove prop drilling from mobile layout via context"
```

## Task 7: Migrate `maintenance-dialogs.tsx` to Context Consumption

**Files:**
- Modify: `src/app/(app)/maintenance/_components/maintenance-dialogs.tsx`
- Create: `src/app/(app)/maintenance/__tests__/maintenance-dialogs.context.test.tsx`

**Step 1: Write the failing test**

```tsx
it("opens add-plan dialog from context state", () => {
  render(
    <MaintenanceProvider>
      <MaintenanceDialogs />
    </MaintenanceProvider>
  )
  expect(screen.queryByText(/Tạo kế hoạch mới/i)).not.toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/maintenance-dialogs.context.test.tsx"`  
Expected: FAIL while component still requires large props object.

**Step 3: Write minimal implementation**

```tsx
export function MaintenanceDialogs() {
  const { dialogState, planState, taskState, actions } = useMaintenanceContext()
  // keep existing dialogs and labels unchanged
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__/maintenance-dialogs.context.test.tsx"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add "src/app/(app)/maintenance/_components/maintenance-dialogs.tsx" \
        "src/app/(app)/maintenance/__tests__/maintenance-dialogs.context.test.tsx"
git commit -m "refactor(maintenance): move maintenance dialogs to context contract"
```

## Task 8: Final Integration and Verification Gates

**Files:**
- Modify: `src/app/(app)/maintenance/_components/MaintenancePageClient.tsx` (final wiring clean-up)
- Modify: `src/app/(app)/maintenance/_components/task-editing.tsx` (if still prop-dependent)
- Modify: `src/app/(app)/maintenance/_components/maintenance-columns.tsx` (if callback signatures changed)

**Step 1: Run targeted maintenance tests**

Run: `npm run test:run -- "src/app/(app)/maintenance/__tests__"`  
Expected: PASS.

**Step 2: Run type and lint checks**

Run: `node scripts/npm-run.js run typecheck`  
Expected: PASS.

Run: `node scripts/npm-run.js run lint`  
Expected: PASS (or only pre-existing unrelated warnings).

**Step 3: Enforce size gate**

Run: `wc -l "src/app/(app)/maintenance/page.tsx"`  
Expected: `<= 450`.

Optional visibility check:

Run: `wc -l "src/app/(app)/maintenance/_components/MaintenanceContext.tsx" "src/app/(app)/maintenance/_components/MaintenancePageClient.tsx"`  
Expected: each file stays around the planned target (`~350` and `~400`).

**Step 4: Commit**

```bash
git add "src/app/(app)/maintenance/page.tsx" \
        "src/app/(app)/maintenance/_components/MaintenanceContext.tsx" \
        "src/app/(app)/maintenance/_components/MaintenancePageClient.tsx" \
        "src/app/(app)/maintenance/_components/mobile-maintenance-layout.tsx" \
        "src/app/(app)/maintenance/_components/maintenance-dialogs.tsx" \
        "src/app/(app)/maintenance/_hooks/useMaintenanceContext.ts" \
        "src/app/(app)/maintenance/_hooks/use-maintenance-drafts.ts" \
        "src/app/(app)/maintenance/__tests__/maintenance-page.characterization.test.tsx" \
        "src/app/(app)/maintenance/__tests__/MaintenanceContext.test.tsx" \
        "src/app/(app)/maintenance/__tests__/MaintenancePageClient.test.tsx" \
        "src/app/(app)/maintenance/__tests__/maintenance-page.wrapper.test.tsx" \
        "src/app/(app)/maintenance/__tests__/mobile-maintenance-layout.context.test.tsx" \
        "src/app/(app)/maintenance/__tests__/maintenance-dialogs.context.test.tsx" \
        "src/app/(app)/maintenance/__tests__/useMaintenanceContext.test.tsx"
git commit -m "refactor(maintenance): adopt context pattern and shrink page.tsx below 450 lines"
```

## Session Completion (Mandatory)

Run:

```bash
git pull --rebase
bd sync
git push
git status
```

Expected:
- `git push` succeeds.
- `git status` reports current branch is up to date with `origin`.
