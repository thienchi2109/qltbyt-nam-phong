# Maintenance Page Phase 1: Mechanical Extraction Design

**Date**: 2025-12-26
**Status**: Approved
**Author**: Claude Code
**Target**: `src/app/(app)/maintenance/page.tsx` (1628 lines)

## Overview

Mechanically extract three logical blocks from the 1628-line `page.tsx` into focused, single-responsibility components. This is pure refactoring with **zero logic changes** - following the established extraction pattern used in previous maintenance page refactors.

**Goal**: Reduce `page.tsx` from 1628 to ~1178 lines (28% reduction) while improving code organization and maintainability.

**Approach**: Mechanical extraction - move code to new files, wire up props, validate behavior unchanged.

---

## What's Already Extracted

**Previous refactoring phases completed:**
- ✅ **Phase 1**: Hooks extraction (`use-maintenance-operations`, `use-maintenance-drafts`, `use-maintenance-print`) - ~480 lines
- ✅ **Phase 2**: Mobile layout extraction (`MobileMaintenanceLayout`) - ~800 lines
- ✅ **Phase 3**: Desktop components (`PlanFiltersBar`, `PlansTable`, `TasksTable`) - ~350 lines

**Current state**: `page.tsx` is 1628 lines, already reduced from original ~3400 lines

---

## Remaining Code Issues

**Current pain points:**
1. **Confusing structure** - Multiple concerns mixed in one file (state, columns, dialogs, editing)
2. **Hard to locate logic** - 1628 lines with interleaved concerns
3. **Column definitions bloated** - 220+ lines of `planColumns` and `taskColumns` mixed with component logic
4. **Dialog orchestration scattered** - Dialog states and handlers throughout the file

**What remains in `page.tsx`:**
- Main page component with state declarations (~200 lines)
- Table column definitions (`planColumns`, `taskColumns`) (~220 lines)
- Dialog orchestration and state (~150 lines)
- Task inline editing logic (~80 lines)
- `renderMobileCards()` fallback function (~100 lines)
- JSX layout composition (~200 lines)

---

## Phase 1 Extraction Plan

### Components to Extract

**1. `maintenance-columns.tsx` (~220 lines)**

**Purpose**: Table column definitions for Plans and Tasks tables.

**Exports**:
```typescript
export function usePlanColumns(options: PlanColumnOptions): ColumnDef<MaintenancePlan>[]
export function useTaskColumns(options: TaskColumnOptions): ColumnDef<MaintenanceTask>[]
```

**Dependencies**: Passed as parameters (handlers, state, permissions)

**What it contains**:
- `planColumns` definition (~130 lines)
- `taskColumns` definition (~90 lines)
- Cell renderers for all columns

**Data flow**: Pure functions, no state, return memoized column arrays

---

**2. `maintenance-dialogs.tsx` (~150 lines)**

**Purpose**: All dialog orchestration and rendering.

**Interface**:
```typescript
export type MaintenanceDialogsProps = {
  // Dialog triggers (controlled by parent)
  isAddPlanDialogOpen: boolean
  setIsAddPlanDialogOpen: (open: boolean) => void
  editingPlan: MaintenancePlan | null
  setEditingPlan: (plan: MaintenancePlan | null) => void
  isAddTasksDialogOpen: boolean
  setIsAddTasksDialogOpen: (open: boolean) => void
  isBulkScheduleOpen: boolean
  setIsBulkScheduleOpen: (open: boolean) => void
  isConfirmingCancel: boolean
  setIsConfirmingCancel: (open: boolean) => void
  isConfirmingBulkDelete: boolean
  setIsConfirmingBulkDelete: (open: boolean) => void

  // Data references
  selectedPlan: MaintenancePlan | null
  draftTasks: MaintenanceTask[]
  selectedTaskRowsCount: number

  // Handlers (from hooks or parent)
  onAddPlanSuccess?: () => void
  onEditPlanSuccess?: () => void
  onAddTasksSuccess?: () => void
  onBulkScheduleConfirm?: (tasks: MaintenanceTask[]) => void
  onCancelConfirm?: () => void
  onBulkDeleteConfirm?: () => void

  // Permissions
  canManagePlans: boolean
}
```

**What it contains**:
- Renders `AddMaintenancePlanDialog`
- Renders `EditMaintenancePlanDialog`
- Renders `AddTasksDialog`
- Renders `BulkScheduleDialog`
- Renders 2× `AlertDialog` (cancel changes, bulk delete)

**Data flow**: Parent manages all dialog state, component renders dialogs and wires up handlers

---

**3. `task-editing.tsx` (~80 lines)**

**Purpose**: Task inline editing state and operations.

**Interface**:
```typescript
export function useTaskEditing(options: {
  draftTasks: MaintenanceTask[]
  setDraftTasks: React.Dispatch<React.SetStateAction<MaintenanceTask[]>>
  canManagePlans: boolean
  isPlanApproved: boolean
}): {
  // State
  editingTaskId: number | null
  editingTaskData: Partial<MaintenanceTask> | null
  taskToDelete: MaintenanceTask | null

  // Handlers
  handleStartEdit: (task: MaintenanceTask) => void
  handleCancelEdit: () => void
  handleTaskDataChange: (field: keyof MaintenanceTask, value: unknown) => void
  handleSaveTask: () => void
  setTaskToDelete: (task: MaintenanceTask | null) => void
}
```

**What it contains**:
- Inline editing state management
- Edit/cancel/save handlers
- Validation before save
- Toast notifications for errors

**Data flow**: Parent passes `draftTasks`, hook manages editing state and returns handlers

---

## File Structure After Extraction

```
src/app/(app)/maintenance/
├── page.tsx                    # ~1178 lines (-28%)
├── _components/
│   ├── mobile-maintenance-layout.tsx  (existing - 940 lines)
│   ├── plan-filters-bar.tsx          (existing - 130 lines)
│   ├── plans-table.tsx               (existing - 180 lines)
│   ├── tasks-table.tsx               (existing - 210 lines)
│   ├── maintenance-dialogs.tsx       (NEW - ~150 lines)
│   ├── maintenance-columns.tsx       (NEW - ~220 lines)
│   └── task-editing.tsx              (NEW - ~80 lines)
└── _hooks/
    ├── use-maintenance-operations.ts  (existing - 150 lines)
    ├── use-maintenance-drafts.ts      (existing - 170 lines)
    └── use-maintenance-print.ts       (existing - 530 lines)
```

---

## page.tsx After Extraction

**Responsibilities:**
- Declare component state (useState)
- Data fetching (useMaintenancePlans, RPC calls)
- Hook composition (useMaintenanceOperations, useMaintenancePrint, etc.)
- Extract column definitions (usePlanColumns, useTaskColumns)
- Layout composition (JSX with Tabs, Cards, Tables)

**What gets removed:**
- ❌ Column definition code (moved to `maintenance-columns.tsx`)
- ❌ Dialog JSX (moved to `maintenance-dialogs.tsx`)
- ❌ Inline editing handlers (moved to `task-editing.tsx`)

**What gets added:**
```typescript
import { usePlanColumns, useTaskColumns } from "./_components/maintenance-columns"
import { MaintenanceDialogs } from "./_components/maintenance-dialogs"
import { useTaskEditing } from "./_components/task-editing"

// In component:
const planColumns = usePlanColumns({...})
const taskColumns = useTaskColumns({...})
const taskEditing = useTaskEditing({...})
```

---

## Error Handling & Validation

### Error Handling Strategy

**Parent (`page.tsx`) responsibilities:**
- All RPC calls remain in hooks (`useMaintenanceOperations`, `useMaintenanceDrafts`, `useMaintenancePrint`)
- Toast notifications already handled by hooks
- No changes needed - hooks manage errors internally

**Child components:**
- `MaintenanceDialogs`: No error handling (just renders dialogs)
- `MaintenanceColumns`: No error handling (pure functions)
- `useTaskEditing`: Validates before saving, returns errors to caller

---

### Validation in `useTaskEditing`

**Inline editing validation:**
- Required fields check (e.g., `thiet_bi_id` must exist)
- Type safety via TypeScript
- Toast notifications for validation errors
- Preserve editing state on error, reset on success

---

### Dialog State Validation

**`MaintenanceDialogs` ensures data integrity:**
- Disabled buttons when actions unavailable (e.g., bulk delete with 0 selected)
- Conditional rendering to prevent null reference errors
- Type-safe props with TypeScript

---

### Loading States

Loading state management remains in parent hooks:

| Component | Loading State | Source |
|-----------|---------------|--------|
| Plan operations | `isApproving`, `isRejecting`, `isDeleting` | `useMaintenanceOperations` |
| Task editing | `isSaving` | `useMaintenanceDrafts` |
| Print generation | `isGenerating` | `useMaintenancePrint` |
| Data fetching | `isLoadingPlans`, `isLoadingTasks` | `useMaintenancePlans`, RPC calls |

Child components receive loading states as props and disable accordingly.

---

## Testing Strategy

### Validation After Each Extraction

**After creating each new file:**
```bash
npm run typecheck  # Must PASS
git add <new-file>
git commit -m "feat(maintenance): extract <component-name> scaffold"
```

**After integrating each component into `page.tsx`:**
```bash
npm run typecheck  # Must PASS
npm run build      # Must SUCCESS
```

**Manual smoke test:**
- Start dev server: `npm run dev`
- Navigate to `/maintenance`
- Verify page loads without console errors
- Test extracted functionality (see checklists below)

---

### Manual Testing Checklist

**After `maintenance-columns.tsx`:**
- [ ] Plans table renders all columns correctly
- [ ] Tasks table renders all columns correctly
- [ ] Sorting works on sortable columns
- [ ] Action buttons (approve/reject/delete) work
- [ ] Inline edit starts on click

**After `maintenance-dialogs.tsx`:**
- [ ] Add Plan dialog opens/closes correctly
- [ ] Edit Plan dialog opens with correct data
- [ ] Bulk Schedule dialog works with selected tasks
- [ ] Delete confirmation appears and works
- [ ] Cancel changes confirmation works

**After `task-editing.tsx`:**
- [ ] Inline edit starts on "Sửa" click
- [ ] Typing in inputs updates values
- [ ] "Lưu" saves changes and shows success toast
- [ ] "Hủy" discards changes
- [ ] Editing another task auto-saves or warns

**Final integration testing:**
- [ ] Complete plan creation workflow
- [ ] Complete plan editing workflow
- [ ] Complete task management workflow
- [ ] Mobile and desktop views both work
- [ ] Refresh page → Changes persist

---

### Type Safety Coverage

**TypeScript prevents:**
- ❌ Missing required props
- ❌ Wrong prop types
- ❌ Incorrect handler signatures
- ❌ Null/undefined access

**We manually test:**
- User interactions
- Visual rendering
- Data persistence
- Error states

---

## Implementation Sequence

### Extraction Order (Lowest Risk → Highest Risk)

**Phase 1A: `maintenance-columns.tsx`** (Easiest)
- **Why first?** Pure functions, no state, easiest to validate
- **Risk:** Very low - just moving code to new file
- **Validation:** Typecheck passes, tables render correctly

**Phase 1B: `maintenance-dialogs.tsx`** (Medium)
- **Why second?** Self-contained, clear props interface
- **Risk:** Low - state stays in parent, just JSX extraction
- **Validation:** All dialogs open/close correctly

**Phase 1C: `task-editing.tsx`** (Medium-High)
- **Why third?** More complex state management
- **Risk:** Medium - editing state transitions need careful testing
- **Validation:** Inline editing works, save/cancel work correctly

---

### Implementation Steps (Per Component)

**For each component, repeat this cycle:**

1. Create file with imports and types
2. Extract implementation from `page.tsx`
3. Add import to `page.tsx`
4. Remove extracted code from `page.tsx`
5. Run typecheck → `npm run typecheck`
6. Manual smoke test → Dev server, check functionality
7. Git commit → Small, focused commit message

---

### Expected Line Count Reduction

| Phase | Component | Lines Extracted | page.tsx After |
|-------|-----------|-----------------|----------------|
| Start | — | — | 1628 |
| 1A | `maintenance-columns.tsx` | -220 | 1408 |
| 1B | `maintenance-dialogs.tsx` | -150 | 1258 |
| 1C | `task-editing.tsx` | -80 | 1178 |

**Final result**: `page.tsx` reduced from **1628 → ~1178 lines** (28% reduction)

---

### Rollback Strategy

**If something goes wrong:**
```bash
# After each commit, we can rollback
git revert HEAD          # Undo last commit
git revert HEAD~2        # Undo last 3 commits

# Or reset to known-good state
git reset --hard <commit-hash>
```

**Since we commit after each component:**
- Maximum loss: 1 component (~150 lines)
- Can't break everything at once
- Always have working state to return to

---

## Post-Extraction Cleanup (Optional)

After all three extractions complete:

1. **Review imports** → Remove unused imports
2. **Add file headers** → Add descriptive comments to each new file
3. **Update documentation** → Update any docs that reference page.tsx structure
4. **Close Beads issue** (if tracked)
5. **Final commit** → Summary commit: "refactor(maintenance): Phase 1 mechanical extraction complete (-450 lines)"

---

## Validation Criteria

**Success metrics:**
- ✅ `npm run typecheck` passes with 0 errors
- ✅ `npm run build` succeeds
- ✅ All manual testing checklists pass
- ✅ No console errors in browser
- ✅ `page.tsx` line count ≤ 1200 lines
- ✅ All existing functionality works identically

**Failure conditions:**
- ❌ TypeScript errors after extraction
- ❌ Build fails
- ❌ Any existing feature broken
- ❌ Console errors at runtime

---

## Future Work (Phase 2 - Optional)

If prop drilling becomes problematic after Phase 1, consider:

**Context API for Mobile Props:**
- Create `MaintenanceContext` to hold shared state
- Remove ~30 props from `MobileMaintenanceLayout`
- Cleaner data flow for mobile view

**Trigger for Phase 2:**
- Adding features requires threading too many props
- Difficult to track which components use which state
- Performance issues from unnecessary re-renders

**Note: Phase 2 is optional and may not be needed if Phase 1 resolves organizational issues.**

---

## Dependencies

### Required Imports for New Components

**`maintenance-columns.tsx`:**
```typescript
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
import { ArrowUpDown, MoreHorizontal, CalendarDays, CheckCircle2, Edit, Trash2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
```

**`maintenance-dialogs.tsx`:**
```typescript
import { AddMaintenancePlanDialog } from "@/components/add-maintenance-plan-dialog"
import { EditMaintenancePlanDialog } from "@/components/edit-maintenance-plan-dialog"
import { AddTasksDialog } from "@/components/add-tasks-dialog"
import { BulkScheduleDialog } from "@/components/bulk-schedule-dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
```

**`task-editing.tsx`:**
```typescript
import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import type { MaintenanceTask } from "@/lib/data"
```

---

## Related Work

- **Phase 1-3**: Completed (hooks, mobile layout, desktop components)
- **This design**: Phase 1 continuation (mechanical extraction)
- **Repair requests**: Similar dialog extraction pattern (`2025-12-25-repair-requests-dialog-extraction-design.md`)

---

## Summary

**What we're building:**
- 3 focused components extracted from 1628-line `page.tsx`
- Mechanical extraction following established patterns
- Zero logic changes - pure refactoring for maintainability

**Expected outcome:**
- `page.tsx`: 1628 → ~1178 lines (-28%)
- Better code organization
- Easier to locate and modify logic
- Foundation for future enhancements (optional Phase 2 Context API)

**Implementation timeline:**
- Phase 1A: `maintenance-columns.tsx` - ~1-2 hours
- Phase 1B: `maintenance-dialogs.tsx` - ~1-2 hours
- Phase 1C: `task-editing.tsx` - ~1-2 hours
- Testing and validation: ~1 hour

**Total estimate**: ~4-7 hours of focused work
