# Maintenance Page Refactor Plan (Revised)

**Goal:** Reduce `src/app/(app)/maintenance/page.tsx` from 1132 → ≤450 lines
**Approach:** Context pattern (matches RepairRequests/Equipment conventions)

---

## Problem Analysis

| Issue | Impact |
|-------|--------|
| 29 useState declarations | State management chaos |
| `use-maintenance-drafts.ts` NOT imported | 175 lines of logic duplicated inline |
| MobileMaintenanceLayout receives 56+ props | Prop drilling explosion |
| No context pattern | Unlike peer modules (RepairRequests, Equipment) |

---

## Key Design Decisions (from review)

### 1. What goes in Context vs PageClient

| In Context (stable) | In PageClient (high-frequency) |
|---------------------|-------------------------------|
| Auth: user, isRegionalLeader, canManagePlans | Draft state: tasks, draftTasks, hasChanges |
| Dialog state: single `DialogState` object | Completion tracking: completionStatus |
| Operations callbacks (from useMaintenanceOperations) | Table state: pagination, selection, sorting |
| `invalidateAndRefetch` callback | Filter state: search, facility |

**Rationale:** Putting `draftTasks` in context would cause re-renders on every keystroke during task editing.

### 2. Single DialogState Object (not 7 useState)

```typescript
interface DialogState {
  isAddPlanOpen: boolean
  isAddTasksOpen: boolean
  isBulkScheduleOpen: boolean
  isConfirmingCancel: boolean
  isConfirmingBulkDelete: boolean
  editingPlan: MaintenancePlan | null
  planToApprove: MaintenancePlan | null
  planToReject: MaintenancePlan | null
  planToDelete: MaintenancePlan | null
  taskToDelete: MaintenanceTask | null
}
```

### 3. Follow EquipmentDialogContext Pattern

Context focuses on **dialog orchestration only**. Mutations handled within individual dialogs or existing hooks.

---

## Implementation Strategy

### Phase 1: Create MaintenanceContext.tsx (~250 lines)

**Path:** `src/app/(app)/maintenance/_components/MaintenanceContext.tsx`

Move to context:
- Auth state: `user`, `isRegionalLeader`, `canManagePlans`, `canCompleteTask`
- Dialog state: single `DialogState` object with all 7+ dialog states
- Dialog actions: `open*Dialog`, `close*Dialog`, `closeAllDialogs`
- Operations: reference to `useMaintenanceOperations` callbacks
- Cache invalidation: `invalidateAndRefetch`

**DO NOT put in context:**
- `tasks`, `draftTasks`, `hasChanges` (high-frequency state)
- `completionStatus` (changes as users mark tasks complete)
- Table state (pagination, sorting, selection)

**Pattern to follow:** `src/app/(app)/equipment/_components/EquipmentDialogContext.tsx`

### Phase 2: Create MaintenancePageClient.tsx (~400 lines)

**Path:** `src/app/(app)/maintenance/_components/MaintenancePageClient.tsx`

Responsibilities:
- Plan filtering/search (server-side pagination)
- Facility filter state
- TanStack Table setup (plan + task tables)
- Tab rendering orchestration
- Mobile/desktop routing via `shouldUseMobileMaintenance`

### Phase 3: Refactor page.tsx → Thin Wrapper (~15 lines)

```tsx
export default function MaintenancePage() {
  return (
    <MaintenanceProvider>
      <MaintenancePageClient />
    </MaintenanceProvider>
  )
}
```

### Phase 4: Update Consumers to Use Context

**Files to update:**
1. `mobile-maintenance-layout.tsx` - Replace 56 props with `useMaintenanceContext()`
2. `maintenance-dialogs.tsx` - Remove prop drilling
3. `task-editing.tsx` - Access draft state from context

---

## File Changes Summary

| File | Before | After | Change |
|------|--------|-------|--------|
| `page.tsx` | 1132 | ~15 | -1117 |
| `MaintenanceContext.tsx` | 0 | ~250 | +250 (new) |
| `MaintenancePageClient.tsx` | 0 | ~450 | +450 (new) |
| `useMaintenanceContext.ts` | 0 | ~15 | +15 (new) |
| `mobile-maintenance-layout.tsx` | 925 | ~400 | -525 |
| `maintenance-dialogs.tsx` | 270 | ~150 | -120 |

**Net result:** page.tsx at 15 lines (well under 450 target)

### Why These Line Estimates

- **MaintenanceContext.tsx (~250 lines):** Follows EquipmentDialogContext pattern (284 lines). Contains ONLY auth + dialog state + stable callbacks.
- **MaintenancePageClient.tsx (~450 lines):** Contains all high-frequency state (drafts, completion, tables). Uses `useMaintenanceDrafts` hook.
- **MobileMaintenanceLayout (~400 lines):** Currently 925 lines because of prop drilling. With context, it consumes state directly and simplifies significantly.

---

## Critical Files to Reuse

1. **`_hooks/use-maintenance-drafts.ts`** (175 lines) - Currently UNUSED
   Contains: `tasks`, `draftTasks`, `hasChanges`, `saveAllChanges`, `cancelAllChanges`

2. **`_hooks/use-maintenance-operations.ts`** (169 lines) - Already used
   Contains: `openApproveDialog`, `openRejectDialog`, `openDeleteDialog`, mutations

3. **`_hooks/use-maintenance-print.ts`** (536 lines) - Already used
   Contains: `generatePlanForm`

---

## Verification Plan

1. **Type check:** `node scripts/npm-run.js run typecheck`
2. **Lint:** `node scripts/npm-run.js run lint`
3. **Manual test checklist:**
   - [ ] Plan list loads with server-side pagination
   - [ ] Facility filter works (global/regional users)
   - [ ] Plan selection navigates to tasks tab
   - [ ] Draft save/cancel operations work
   - [ ] Task completion marking works (approved plans)
   - [ ] Mobile layout renders correctly
   - [ ] All dialogs (add/edit plan, add tasks, bulk schedule) function
   - [ ] Print form generation works

---

## Execution Order

1. Create `useMaintenanceContext.ts` (consumer hook)
2. Create `MaintenanceContext.tsx` (provider with all state)
3. Create `MaintenancePageClient.tsx` (orchestration)
4. Update `page.tsx` to thin wrapper
5. Update `mobile-maintenance-layout.tsx` to use context
6. Update `maintenance-dialogs.tsx` to use context
7. Run typecheck + lint
8. Manual verification

---

## Comparison with Original Design Document

| Original Design (Option 2) | Final Plan |
|---------------------------|------------|
| Controller hooks only | Context + hooks (matches codebase patterns) |
| Keeps orchestration in page.tsx (~320-420 lines) | Moves to MaintenancePageClient.tsx (~15 lines in page.tsx) |
| No mention of 56-prop problem | Eliminates prop drilling via context |
| Doesn't mention unused use-maintenance-drafts.ts | Integrates existing unused hook |

**Why Context Pattern:** Exploration revealed that RepairRequests, Equipment, and all DeviceQuota modules use this pattern. It's the established convention in this codebase.

---

## Performance Considerations

### Re-render Prevention

1. **Context value memoization:** Use `useMemo` on context value with proper dependency array
2. **Dialog actions with useCallback:** All `open*Dialog`, `close*Dialog` functions wrapped in useCallback
3. **Single DialogState object:** Reduces individual state updates (one setter vs 7 setters)

### High-frequency State Isolation

These are intentionally kept OUT of context to avoid re-renders:
- `draftTasks` - changes on every edit keystroke
- `completionStatus` - changes as users mark tasks complete
- `taskRowSelection` - changes on table row selection

---

## Additional Recommendations

### MobileMaintenanceLayout Split (Future)

The 925-line mobile layout could be further split if needed:
- `MobilePlansList.tsx` (~300 lines)
- `MobileTasksList.tsx` (~400 lines)
- `MobileMaintenanceLayout.tsx` (~200 lines, orchestration only)

This is optional - context consumption alone should reduce it to ~400 lines.

### useMaintenanceDrafts Integration

Currently UNUSED. Before integrating, verify:
- [ ] Hook's API matches what PageClient needs
- [ ] localStorage caching logic works correctly
- [ ] Completion status tracking is compatible

---

## Reference Files

| Pattern | File | Lines |
|---------|------|-------|
| Dialog-only context | `equipment/_components/EquipmentDialogContext.tsx` | 284 |
| Full context with mutations | `repair-requests/_components/RepairRequestsContext.tsx` | 380 |
| Unused drafts hook | `maintenance/_hooks/use-maintenance-drafts.ts` | 175 |
| Current target | `maintenance/page.tsx` | 1132 |
