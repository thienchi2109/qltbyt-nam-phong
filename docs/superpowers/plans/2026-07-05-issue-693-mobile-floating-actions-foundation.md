# Issue 693 Mobile Floating Actions Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared mobile floating-actions foundation and roll it out to Repair Requests as the first page under umbrella #690.

**Architecture:** Add a narrow shared `src/components/shared/floating-actions/` package that owns the HeroUI mobile action menu, action descriptor types, and page-to-layout registration hook. `AppLayoutShell` composes the registered page action with the existing assistant action; Repair Requests registers its create action instead of rendering its own mobile FAB.

**Tech Stack:** Next.js App Router, React 19, TypeScript, HeroUI, Vitest, Testing Library, lucide-react.

---

## Scope

- In scope: #693 only; shared foundation, `AppLayoutShell` integration, Repair Requests mobile rollout, HeroUI boundary update.
- Out of scope: Transfers (#694), Maintenance (#695), assistant panel behavior changes, create sheet behavior changes.
- Required skills before implementation: `next-best-practices`, `react-best-practices`, `code-deduplication`, `superpowers:test-driven-development`.

## File Structure

- Create `src/components/shared/floating-actions/MobileFloatingActionMenu.tsx`
  - HeroUI dropdown/menu trigger for mobile floating actions.
- Create `src/components/shared/floating-actions/MobileFloatingActionsContext.tsx`
  - Provider, descriptor type, and registration hook.
- Create `src/components/shared/floating-actions/index.ts`
  - Public exports for shared consumers.
- Create tests under `src/components/shared/floating-actions/__tests__/`.
- Modify `src/app/(app)/_components/AppLayoutShell.tsx`
  - Wrap app shell in provider and render combined menu when a page action is registered.
- Modify `src/app/(app)/repair-requests/_components/RepairRequestsPageLayout.tsx`
  - Register `Tạo yêu cầu` on mobile when allowed; remove local mobile FAB.
- Modify `scripts/check-heroui-import-boundary.js` and its test
  - Allow direct HeroUI imports only in approved boundary folders.

## Task 1: HeroUI Boundary For Shared Floating Actions

- [ ] Write failing test in `scripts/__tests__/check-heroui-import-boundary.test.ts`.
  - Add an allowed fixture for `src/components/shared/floating-actions/MobileFloatingActionMenu.tsx`.
  - Keep a rejected fixture for a feature file importing `@heroui/react` directly.
- [ ] Run:
  - `node scripts/npm-run.js run test:run -- scripts/__tests__/check-heroui-import-boundary.test.ts`
  - Expected: FAIL because only the equipment pilot folder is allowed.
- [ ] Update `scripts/check-heroui-import-boundary.js`.
  - Replace the single prefix with `ALLOWED_BOUNDARY_PREFIXES`.
  - Allow `src/components/equipment/heroui-pilot/`.
  - Allow `src/components/shared/floating-actions/`.
- [ ] Re-run the same test.
  - Expected: PASS.

## Task 2: Shared Mobile Action Menu

- [ ] Write failing tests in `src/components/shared/floating-actions/__tests__/MobileFloatingActionMenu.test.tsx`.
  - Mock `@heroui/react` so Dropdown items render inline in jsdom.
  - Assert the trigger is one fixed rounded mobile button using the existing floating action class contract.
  - Assert accessible actions `Trợ lý AI` and a supplied page action render.
  - Clicking each action calls the supplied callback exactly once.
- [ ] Run:
  - `node scripts/npm-run.js run test:run -- src/components/shared/floating-actions/__tests__/MobileFloatingActionMenu.test.tsx`
  - Expected: FAIL because the component does not exist.
- [ ] Implement `MobileFloatingActionMenu.tsx`.
  - Import HeroUI only here.
  - Use `Dropdown`, `DropdownTrigger`, `DropdownPopover`, `DropdownMenu`, `DropdownItem`.
  - Reuse `FloatingActionButton` or `floatingActionButtonClassName` for trigger sizing, safe-area offset, z-index, and `md:hidden`.
  - Accept descriptors: `{ id: string; label: string; icon: React.ReactNode; onSelect: () => void }`.
- [ ] Re-run the component test.
  - Expected: PASS.

## Task 3: Page Action Registration Context

- [ ] Write failing tests in `src/components/shared/floating-actions/__tests__/MobileFloatingActionsContext.test.tsx`.
  - Consumer can register one page action and layout can read it.
  - Unmount clears the registered action.
  - Updating the action replaces the previous descriptor.
- [ ] Run:
  - `node scripts/npm-run.js run test:run -- src/components/shared/floating-actions/__tests__/MobileFloatingActionsContext.test.tsx`
  - Expected: FAIL because the context does not exist.
- [ ] Implement `MobileFloatingActionsContext.tsx`.
  - Export `MobileFloatingActionDescriptor`.
  - Export `MobileFloatingActionsProvider`.
  - Export `useMobileFloatingActions()` for layout reads.
  - Export `usePageFloatingAction(action: MobileFloatingActionDescriptor | null)` for pages.
  - Keep provider state local to the app shell; no persistence.
- [ ] Re-run the context test.
  - Expected: PASS.

## Task 4: AppLayoutShell Composition

- [ ] Update/add `src/app/(app)/__tests__/AppLayoutShell.test.tsx`.
  - Mock the shared menu so it exposes received action labels and calls callbacks.
  - Render a child that calls `usePageFloatingAction({ id: "repair-create", label: "Tạo yêu cầu", ... })`.
  - Assert the combined menu receives `Trợ lý AI` and `Tạo yêu cầu`.
  - Assert the standalone `AssistantTriggerButton` fallback still renders when no page action is registered.
- [ ] Run:
  - `node scripts/npm-run.js run test:run -- "src/app/(app)/__tests__/AppLayoutShell.test.tsx"`
  - Expected: FAIL before layout wiring.
- [ ] Update `src/app/(app)/_components/AppLayoutShell.tsx`.
  - Wrap `AppLayoutShellContent` with `MobileFloatingActionsProvider`.
  - Inside content, read the registered page action.
  - If page action exists, render `MobileFloatingActionMenu` with assistant + page action.
  - If no page action exists, render existing `AssistantTriggerButton` unchanged.
  - Keep `AssistantPanel` render/close behavior unchanged.
- [ ] Re-run the layout test.
  - Expected: PASS.

## Task 5: Repair Requests Rollout

- [ ] Update `src/app/(app)/repair-requests/__tests__/RepairRequestsPageLayout.test.tsx`.
  - Mock `usePageFloatingAction`.
  - Assert mobile non-regional users register `Tạo yêu cầu`.
  - Invoke the registered action and assert `openCreateSheet` is called once.
  - Assert regional leaders register `null`.
  - Assert non-mobile compact/tablet keeps the existing visible create button.
- [ ] Run:
  - `node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__/RepairRequestsPageLayout.test.tsx"`
  - Expected: FAIL before page wiring.
- [ ] Update `RepairRequestsPageLayout.tsx`.
  - Remove the local mobile `FloatingActionButton` render block.
  - Call `usePageFloatingAction(...)` with `Tạo yêu cầu` only when `!isRegionalLeader && isMobile`.
  - Preserve the existing desktop/tablet button: `!isRegionalLeader && isCompactLayout && !isMobile`.
  - Preserve `RepairRequestsCreateSheet` rendering.
- [ ] Re-run the Repair Requests test.
  - Expected: PASS.

## Verification

- [ ] Focused tests:
  - `node scripts/npm-run.js run test:run -- scripts/__tests__/check-heroui-import-boundary.test.ts`
  - `node scripts/npm-run.js run test:run -- src/components/shared/floating-actions/__tests__/MobileFloatingActionMenu.test.tsx`
  - `node scripts/npm-run.js run test:run -- src/components/shared/floating-actions/__tests__/MobileFloatingActionsContext.test.tsx`
  - `node scripts/npm-run.js run test:run -- "src/app/(app)/__tests__/AppLayoutShell.test.tsx"`
  - `node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__/RepairRequestsPageLayout.test.tsx"`
- [ ] Required TS/React gates:
  - `node scripts/npm-run.js run format:check`
  - `node scripts/npm-run.js run verify:no-explicit-any`
  - `node scripts/npm-run.js run verify:dedupe`
  - `node scripts/npm-run.js run verify:heroui-boundary`
  - `node scripts/npm-run.js run typecheck`
  - `node scripts/npm-run.js run react-doctor`
- [ ] Review blast radius:
  - Run Code Review Graph `detect_changes_tool` with `detail_level="minimal"`.
  - Inspect `AppLayoutShell`, assistant trigger fallback, Repair Requests mobile create flow, and HeroUI boundary.

## Completion

- [ ] Commit implementation with a message like `feat: add mobile floating actions foundation`.
- [ ] Update #693 with test evidence.
- [ ] Close #693 only after the merged PR satisfies all acceptance criteria.
- [ ] Leave #690 open until #694 and #695 are complete.
