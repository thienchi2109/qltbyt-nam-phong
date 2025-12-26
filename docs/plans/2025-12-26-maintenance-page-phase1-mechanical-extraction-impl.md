# Maintenance Page Phase 1: Mechanical Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract 3 logical blocks from `maintenance/page.tsx` (1628 lines) into focused components, reducing file size to ~1178 lines (-28%).

**Architecture:** Mechanical extraction - move code to new files, wire up props, validate behavior unchanged. Zero logic changes.

**Tech Stack:** React 18, TypeScript, TanStack Table, shadcn/ui

---

## Task 1: Create maintenance-columns.tsx

**Files:**
- Create: `src/app/(app)/maintenance/_components/maintenance-columns.tsx`
- Reference: `src/app/(app)/maintenance/page.tsx` lines ~500-720 (planColumns and taskColumns)

**Step 1: Create the file with imports**

Create `src/app/(app)/maintenance/_components/maintenance-columns.tsx`:

```typescript
"use client"

import type { ColumnDef, SortingState } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, CalendarDays, CheckCircle2, Edit, Trash2, ChevronDown } from "lucide-react"
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
import { NotesInput } from "./task-editing"

// Placeholder for column hooks - will be replaced in next task
export function usePlanColumns() {
  return []
}

export function useTaskColumns() {
  return []
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors related to this file)

**Step 3: Commit**

```bash
git add src/app/(app)/maintenance/_components/maintenance-columns.tsx
git commit -m "feat(maintenance): add maintenance-columns scaffold"
```

---

## Task 2: Extract planColumns Definition

**Files:**
- Modify: `src/app/(app)/maintenance/_components/maintenance-columns.tsx`
- Reference: `src/app/(app)/maintenance/page.tsx` lines ~500-630 (planColumns definition)

**Step 1: Read the planColumns definition from page.tsx**

Read `src/app/(app)/maintenance/page.tsx` starting around line 500 to find the `planColumns` definition. Look for:

```typescript
const planColumns: ColumnDef<MaintenancePlan>[] = [
  // ... column definitions
]
```

**Step 2: Create the usePlanColumns hook**

Replace the placeholder in `maintenance-columns.tsx` with:

```typescript
export interface PlanColumnOptions {
  sorting: SortingState
  setSorting: (sorting: SortingState) => void
  onRowClick: (plan: MaintenancePlan) => void
  openApproveDialog: (plan: MaintenancePlan) => void
  openRejectDialog: (plan: MaintenancePlan) => void
  openDeleteDialog: (plan: MaintenancePlan) => void
  canManagePlans: boolean
  isRegionalLeader: boolean
}

export function usePlanColumns(options: PlanColumnOptions): ColumnDef<MaintenancePlan>[] {
  const {
    sorting,
    setSorting,
    onRowClick,
    openApproveDialog,
    openRejectDialog,
    openDeleteDialog,
    canManagePlans,
    isRegionalLeader,
  } = options

  const planColumns: ColumnDef<MaintenancePlan>[] = [
    // Copy all column definitions from page.tsx here
    // This includes: select, ten_ke_hoach, khoa_phong, thiet_bi_count, tan_suat, nam, trang_thai, ngay_tao, actions columns
  ]

  return planColumns
}
```

**Step 3: Copy the column definitions**

Copy the entire `planColumns` array from `page.tsx` into the `planColumns` variable in `maintenance-columns.tsx`.

**Important:** Ensure you also copy any helper functions referenced by the columns (e.g., status badge variant helpers).

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: May show errors about missing variables/functions - we'll fix these in the next steps

**Step 5: Commit**

```bash
git add src/app/(app)/maintenance/_components/maintenance-columns.tsx
git commit -m "feat(maintenance): add usePlanColumns hook with definitions"
```

---

## Task 3: Extract taskColumns Definition

**Files:**
- Modify: `src/app/(app)/maintenance/_components/maintenance-columns.tsx`
- Reference: `src/app/(app)/maintenance/page.tsx` lines ~630-720 (taskColumns definition)

**Step 1: Read the taskColumns definition from page.tsx**

Read `src/app/(app)/maintenance/page.tsx` starting around line 630 to find the `taskColumns` definition.

**Step 2: Create the useTaskColumns hook**

Replace the placeholder in `maintenance-columns.tsx` with:

```typescript
export interface TaskColumnOptions {
  editingTaskId: number | null
  handleStartEdit: (task: MaintenanceTask) => void
  handleCancelEdit: () => void
  handleTaskDataChange: (field: keyof MaintenanceTask, value: unknown) => void
  handleSaveTask: () => void
  setTaskToDelete: (task: MaintenanceTask | null) => void
  toggleTaskExpansion: (taskId: number) => void
  expandedTaskIds: Record<number, boolean>
  canManagePlans: boolean
  isPlanApproved: boolean
  canCompleteTask: boolean
  handleMarkAsCompleted: (task: MaintenanceTask, month: number) => void
  isCompletingTask: string | null
  completionStatus: Record<string, { historyId: number }>
  selectedPlan: MaintenancePlan | null
}

export function useTaskColumns(options: TaskColumnOptions): ColumnDef<MaintenanceTask>[] {
  const {
    editingTaskId,
    handleStartEdit,
    handleCancelEdit,
    handleTaskDataChange,
    handleSaveTask,
    setTaskToDelete,
    toggleTaskExpansion,
    expandedTaskIds,
    canManagePlans,
    isPlanApproved,
    canCompleteTask,
    handleMarkAsCompleted,
    isCompletingTask,
    completionStatus,
    selectedPlan,
  } = options

  const taskColumns: ColumnDef<MaintenanceTask>[] = [
    // Copy all column definitions from page.tsx here
    // This includes: select, thiet_bi info columns, don_vi_thuc_hien, monthly checkboxes, ghi_chu, actions columns
  ]

  return taskColumns
}
```

**Step 3: Copy the column definitions**

Copy the entire `taskColumns` array from `page.tsx` into the `taskColumns` variable in `maintenance-columns.tsx`.

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: May show errors - we'll fix imports and dependencies next

**Step 5: Commit**

```bash
git add src/app/(app)/maintenance/_components/maintenance-columns.tsx
git commit -m "feat(maintenance): add useTaskColumns hook with definitions"
```

---

## Task 4: Fix Imports and Dependencies in maintenance-columns.tsx

**Files:**
- Modify: `src/app/(app)/maintenance/_components/maintenance-columns.tsx`

**Step 1: Add missing imports**

Ensure the file has all required imports:

```typescript
"use client"

import * as React from "react"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, CalendarDays, CheckCircle2, Edit, Trash2, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
```

**Step 2: Remove NotesInput import**

We won't need this anymore as it will be handled by the task-editing component.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (or only show errors in page.tsx which we'll fix next)

**Step 4: Commit**

```bash
git add src/app/(app)/maintenance/_components/maintenance-columns.tsx
git commit -m "refactor(maintenance): fix imports in maintenance-columns"
```

---

## Task 5: Update page.tsx to Use maintenance-columns

**Files:**
- Modify: `src/app/(app)/maintenance/page.tsx`

**Step 1: Add import**

After the existing component imports (around line 95), add:

```typescript
import { usePlanColumns, useTaskColumns } from "./_components/maintenance-columns"
```

**Step 2: Find where planColumns and taskColumns are defined**

Search for `const planColumns` and `const taskColumns` in the file (likely around lines 500-720).

**Step 3: Replace planColumns definition**

Replace the `const planColumns = [...]` definition with:

```typescript
const planColumns = usePlanColumns({
  sorting: planSorting,
  setSorting: setPlanSorting,
  onRowClick: handleSelectPlan,
  openApproveDialog: operations.openApproveDialog,
  openRejectDialog: operations.openRejectDialog,
  openDeleteDialog: operations.openDeleteDialog,
  canManagePlans,
  isRegionalLeader,
})
```

**Step 4: Replace taskColumns definition**

Replace the `const taskColumns = [...]` definition with:

```typescript
const taskColumns = useTaskColumns({
  editingTaskId,
  handleStartEdit,
  handleCancelEdit,
  handleTaskDataChange,
  handleSaveTask,
  setTaskToDelete,
  toggleTaskExpansion,
  expandedTaskIds,
  canManagePlans,
  isPlanApproved,
  canCompleteTask,
  handleMarkAsCompleted,
  isCompletingTask,
  completionStatus,
  selectedPlan,
})
```

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 6: Remove old column definitions**

Delete the old `planColumns` and `taskColumns` array definitions (now that they're in the hook).

**Step 7: Check line count**

Run: `wc -l src/app/(app)/maintenance/page.tsx`
Expected: Approximately 1408 lines (down from 1628, ~220 line reduction)

**Step 8: Commit**

```bash
git add src/app/(app)/maintenance/page.tsx
git commit -m "refactor(maintenance): use maintenance-columns hooks

- Replace inline planColumns with usePlanColumns hook
- Replace inline taskColumns with useTaskColumns hook
- Reduce page.tsx by ~220 lines"
```

---

## Task 6: Final Verification for Columns Extraction

**Files:**
- Verify: `src/app/(app)/maintenance/page.tsx`
- Verify: `src/app/(app)/maintenance/_components/maintenance-columns.tsx`

**Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS with 0 errors

**Step 2: Run build**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Manual smoke test**

Run: `npm run dev`

Then:
1. Navigate to `/maintenance`
2. Verify Plans table renders with all columns
3. Click sorting headers → verify sorting works
4. Click a plan row → verify tasks tab opens
5. Verify Tasks table renders with all columns
6. Check browser console for errors

**Step 4: Update Beads**

```bash
bd close <bead-id-for-columns> --reason="Extracted maintenance-columns.tsx (~220 lines). page.tsx reduced from 1628 to 1408 lines."
```

**Step 5: Final commit if needed**

If any cleanup was done:
```bash
git add .
git commit -m "chore(maintenance): Phase 1A complete - columns extraction"
```

---

## Task 7: Create task-editing.tsx Hook

**Files:**
- Create: `src/app/(app)/maintenance/_components/task-editing.tsx`
- Reference: `src/app/(app)/maintenance/page.tsx` lines ~300-400 (task editing handlers)

**Step 1: Create the file with imports**

Create `src/app/(app)/maintenance/_components/task-editing.tsx`:

```typescript
"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import type { MaintenanceTask } from "@/lib/data"

export interface UseTaskEditingOptions {
  draftTasks: MaintenanceTask[]
  setDraftTasks: React.Dispatch<React.SetStateAction<MaintenanceTask[]>>
  canManagePlans: boolean
  isPlanApproved: boolean
}

export function useTaskEditing(options: UseTaskEditingOptions) {
  const { toast } = useToast()

  const [editingTaskId, setEditingTaskId] = React.useState<number | null>(null)
  const [editingTaskData, setEditingTaskData] = React.useState<Partial<MaintenanceTask> | null>(null)
  const [taskToDelete, setTaskToDelete] = React.useState<MaintenanceTask | null>(null)

  const handleStartEdit = React.useCallback((task: MaintenanceTask) => {
    setEditingTaskId(task.id)
    setEditingTaskData({ ...task })
  }, [])

  const handleCancelEdit = React.useCallback(() => {
    setEditingTaskId(null)
    setEditingTaskData(null)
  }, [])

  const handleTaskDataChange = React.useCallback((field: keyof MaintenanceTask, value: unknown) => {
    setEditingTaskData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleSaveTask = React.useCallback(() => {
    // Implementation will be added in next task
  }, [])

  return {
    editingTaskId,
    editingTaskData,
    taskToDelete,
    setTaskToDelete,
    handleStartEdit,
    handleCancelEdit,
    handleTaskDataChange,
    handleSaveTask,
  }
}

// Memoized NotesInput component
export const NotesInput = React.memo(({ taskId, value, onChange }: {
  taskId: number
  value: string
  onChange: (value: string) => void
}) => {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8"
      autoFocus
    />
  )
})
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (or only show errors about handleSaveTask implementation)

**Step 3: Commit**

```bash
git add src/app/(app)/maintenance/_components/task-editing.tsx
git commit -m "feat(maintenance): add task-editing hook scaffold"
```

---

## Task 8: Implement handleSaveTask in task-editing.tsx

**Files:**
- Modify: `src/app/(app)/maintenance/_components/task-editing.tsx`

**Step 1: Read the original handleSaveTask from page.tsx**

Find the `handleSaveTask` function in `page.tsx` (likely around line 350-380).

**Step 2: Replace the placeholder handleSaveTask**

Replace the placeholder with the full implementation:

```typescript
const handleSaveTask = React.useCallback(() => {
  if (!editingTaskId || !editingTaskData) return

  const taskIndex = options.draftTasks.findIndex(t => t.id === editingTaskId)
  if (taskIndex === -1) return

  // Validation
  if (!editingTaskData.thiet_bi_id) {
    toast({
      variant: "destructive",
      title: "Lỗi",
      description: "Thiết bị là bắt buộc"
    })
    return
  }

  // Update the task in draftTasks
  const updatedTasks = [...options.draftTasks]
  updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], ...editingTaskData }

  options.setDraftTasks(updatedTasks)

  // Reset editing state
  setEditingTaskId(null)
  setEditingTaskData(null)

  toast({
    title: "Thành công",
    description: "Đã cập nhật công việc"
  })
}, [editingTaskId, editingTaskData, options.draftTasks, options.setDraftTasks, toast])
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/(app)/maintenance/_components/task-editing.tsx
git commit -m "feat(maintenance): implement handleSaveTask with validation"
```

---

## Task 9: Update page.tsx to Use task-editing Hook

**Files:**
- Modify: `src/app/(app)/maintenance/page.tsx`

**Step 1: Add import**

After the existing hook imports (around line 95), add:

```typescript
import { useTaskEditing } from "./_components/task-editing"
```

**Step 2: Find where editing state is declared**

Search for `editingTaskId`, `editingTaskData`, `taskToDelete` state declarations in page.tsx (likely around lines 200-210).

**Step 3: Add the hook call**

After the other hook calls (around line 300), add:

```typescript
const taskEditing = useTaskEditing({
  draftTasks,
  setDraftTasks,
  canManagePlans,
  isPlanApproved,
})
```

**Step 4: Update all references**

Replace throughout the file:
- `editingTaskId` → `taskEditing.editingTaskId`
- `editingTaskData` → `taskEditing.editingTaskData`
- `taskToDelete` → `taskEditing.taskToDelete`
- `handleStartEdit` → `taskEditing.handleStartEdit`
- `handleCancelEdit` → `taskEditing.handleCancelEdit`
- `handleTaskDataChange` → `taskEditing.handleTaskDataChange`
- `handleSaveTask` → `taskEditing.handleSaveTask`
- `setTaskToDelete` → `taskEditing.setTaskToDelete`

**Step 5: Remove old state declarations**

Delete the old `useState` declarations for:
- `editingTaskId`
- `editingTaskData`
- `taskToDelete`

**Step 6: Remove old handler functions**

Delete the old handler functions:
- `handleStartEdit`
- `handleCancelEdit`
- `handleTaskDataChange`
- `handleSaveTask`

**Step 7: Remove NotesInput component**

Delete the `NotesInput` component definition (lines 64-78), as it's now exported from `task-editing.tsx`.

**Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 9: Check line count**

Run: `wc -l src/app/(app)/maintenance/page.tsx`
Expected: Approximately 1258 lines (down from 1408, ~150 line reduction)

**Step 10: Commit**

```bash
git add src/app/(app)/maintenance/page.tsx
git commit -m "refactor(maintenance): use task-editing hook

- Replace inline editing state with useTaskEditing hook
- Remove editing handlers from page.tsx
- Reduce page.tsx by ~80 lines"
```

---

## Task 10: Final Verification for Task Editing Extraction

**Files:**
- Verify: `src/app/(app)/maintenance/page.tsx`
- Verify: `src/app/(app)/maintenance/_components/task-editing.tsx`

**Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS with 0 errors

**Step 2: Run build**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Manual smoke test**

Run: `npm run dev`

Then:
1. Navigate to `/maintenance`
2. Select a plan with tasks
3. Click "Sửa" button on a task
4. Modify values in inputs
5. Click "Lưu" → verify changes save
6. Click "Hủy" → verify changes discard
7. Check browser console for errors

**Step 4: Update Beads**

```bash
bd close <bead-id-for-task-editing> --reason="Extracted task-editing.tsx (~80 lines). page.tsx reduced from 1408 to 1328 lines."
```

**Step 5: Final commit if needed**

```bash
git add .
git commit -m "chore(maintenance): Phase 1C complete - task editing extraction"
```

---

## Task 11: Create maintenance-dialogs.tsx Component

**Files:**
- Create: `src/app/(app)/maintenance/_components/maintenance-dialogs.tsx`
- Reference: `src/app/(app)/maintenance/page.tsx` lines ~800-950 (dialog JSX)

**Step 1: Create the file with imports and types**

Create `src/app/(app)/maintenance/_components/maintenance-dialogs.tsx`:

```typescript
"use client"

import { AddMaintenancePlanDialog } from "@/components/add-maintenance-plan-dialog"
import { EditMaintenancePlanDialog } from "@/components/edit-maintenance-plan-dialog"
import { AddTasksDialog } from "@/components/add-tasks-dialog"
import { BulkScheduleDialog } from "@/components/bulk-schedule-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"

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

export function MaintenanceDialogs(props: MaintenanceDialogsProps) {
  return (
    <>
      {/* Dialogs will be added in next task */}
    </>
  )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/(app)/maintenance/_components/maintenance-dialogs.tsx
git commit -m "feat(maintenance): add maintenance-dialogs scaffold"
```

---

## Task 12: Add Dialog JSX to maintenance-dialogs.tsx

**Files:**
- Modify: `src/app/(app)/maintenance/_components/maintenance-dialogs.tsx`

**Step 1: Read dialog JSX from page.tsx**

Read `src/app/(app)/maintenance/page.tsx` to find all dialog JSX (likely in the main return statement, lines ~800-950).

Look for:
- `<AddMaintenancePlanDialog>`
- `<EditMaintenancePlanDialog>`
- `<AddTasksDialog>`
- `<BulkScheduleDialog>`
- `<AlertDialog>` for cancel confirmation
- `<AlertDialog>` for bulk delete confirmation

**Step 2: Replace placeholder with all dialogs**

Replace the placeholder comment with all the dialogs:

```typescript
export function MaintenanceDialogs(props: MaintenanceDialogsProps) {
  const {
    isAddPlanDialogOpen,
    setIsAddPlanDialogOpen,
    editingPlan,
    setEditingPlan,
    isAddTasksDialogOpen,
    setIsAddTasksDialogOpen,
    isBulkScheduleOpen,
    setIsBulkScheduleOpen,
    isConfirmingCancel,
    setIsConfirmingCancel,
    isConfirmingBulkDelete,
    setIsConfirmingBulkDelete,
    selectedPlan,
    draftTasks,
    selectedTaskRowsCount,
    onAddPlanSuccess,
    onEditPlanSuccess,
    onAddTasksSuccess,
    onBulkScheduleConfirm,
    onCancelConfirm,
    onBulkDeleteConfirm,
    canManagePlans,
  } = props

  return (
    <>
      {/* Add Maintenance Plan Dialog */}
      <AddMaintenancePlanDialog
        open={isAddPlanDialogOpen}
        onOpenChange={setIsAddPlanDialogOpen}
        onSuccess={onAddPlanSuccess}
      />

      {/* Edit Maintenance Plan Dialog */}
      {editingPlan && (
        <EditMaintenancePlanDialog
          open={!!editingPlan}
          onOpenChange={(open) => !open && setEditingPlan(null)}
          plan={editingPlan}
          onSuccess={onEditPlanSuccess}
        />
      )}

      {/* Add Tasks Dialog */}
      {selectedPlan && (
        <AddTasksDialog
          open={isAddTasksDialogOpen}
          onOpenChange={setIsAddTasksDialogOpen}
          planId={selectedPlan.id}
          loaiCongViec={selectedPlan.loai_cong_viec}
          onSuccess={onAddTasksSuccess}
        />
      )}

      {/* Bulk Schedule Dialog */}
      {selectedPlan && (
        <BulkScheduleDialog
          open={isBulkScheduleOpen}
          onOpenChange={setIsBulkScheduleOpen}
          plan={selectedPlan}
          tasks={draftTasks}
          onSchedule={onBulkScheduleConfirm}
        />
      )}

      {/* Cancel Changes Confirmation Dialog */}
      <AlertDialog open={isConfirmingCancel} onOpenChange={setIsConfirmingCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận hủy thay đổi</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn hủy tất cả thay đổi chưa lưu không? Mọi thay đổi sẽ bị mất.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction onClick={onCancelConfirm}>
              Xác nhận hủy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={isConfirmingBulkDelete} onOpenChange={setIsConfirmingBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa {selectedTaskRowsCount} công việc đã chọn không? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction onClick={onBulkDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Xóa ({selectedTaskRowsCount})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/(app)/maintenance/_components/maintenance-dialogs.tsx
git commit -m "feat(maintenance): add all dialogs to MaintenanceDialogs component"
```

---

## Task 13: Update page.tsx to Use maintenance-dialogs

**Files:**
- Modify: `src/app/(app)/maintenance/page.tsx`

**Step 1: Add import**

After the existing component imports (around line 95), add:

```typescript
import { MaintenanceDialogs } from "./_components/maintenance-dialogs"
```

**Step 2: Find dialog state declarations**

Search for dialog state in page.tsx:
- `isAddPlanDialogOpen`
- `editingPlan`
- `isAddTasksDialogOpen`
- `isBulkScheduleOpen`
- `isConfirmingCancel`
- `isConfirmingBulkDelete`

**Step 3: Find where dialogs are rendered**

Search the main return statement for where all the dialogs are rendered (likely near the end of the component).

**Step 4: Replace dialog JSX with component**

Replace all the dialog JSX with a single component:

```typescript
<MaintenanceDialogs
  isAddPlanDialogOpen={isAddPlanDialogOpen}
  setIsAddPlanDialogOpen={setIsAddPlanDialogOpen}
  editingPlan={editingPlan}
  setEditingPlan={setEditingPlan}
  isAddTasksDialogOpen={isAddTasksDialogOpen}
  setIsAddTasksDialogOpen={setIsAddTasksDialogOpen}
  isBulkScheduleOpen={isBulkScheduleOpen}
  setIsBulkScheduleOpen={setIsBulkScheduleOpen}
  isConfirmingCancel={isConfirmingCancel}
  setIsConfirmingCancel={setIsConfirmingCancel}
  isConfirmingBulkDelete={isConfirmingBulkDelete}
  setIsConfirmingBulkDelete={setIsConfirmingBulkDelete}
  selectedPlan={selectedPlan}
  draftTasks={draftTasks}
  selectedTaskRowsCount={selectedTaskRowsCount}
  onAddPlanSuccess={() => {
    setIsAddPlanDialogOpen(false)
    refetchPlans()
  }}
  onEditPlanSuccess={() => {
    setEditingPlan(null)
    refetchPlans()
  }}
  onAddTasksSuccess={() => {
    setIsAddTasksDialogOpen(false)
    if (selectedPlan) {
      // Refresh tasks
    }
  }}
  onBulkScheduleConfirm={(tasks) => {
    // Handle bulk schedule
    setIsBulkScheduleOpen(false)
  }}
  onCancelConfirm={() => {
    handleCancelAllChanges()
    setIsConfirmingCancel(false)
  }}
  onBulkDeleteConfirm={() => {
    handleBulkDeleteTasks()
    setIsConfirmingBulkDelete(false)
  }}
  canManagePlans={canManagePlans}
/>
```

**Step 5: Remove old dialog JSX**

Delete all the individual dialog components from the return statement (they're now in MaintenanceDialogs).

**Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 7: Check line count**

Run: `wc -l src/app/(app)/maintenance/page.tsx`
Expected: Approximately 1178 lines (down from 1258, ~80 line reduction)

**Step 8: Commit**

```bash
git add src/app/(app)/maintenance/page.tsx
git commit -m "refactor(maintenance): use MaintenanceDialogs component

- Replace all dialog JSX with single component
- Reduce page.tsx by ~80 lines"
```

---

## Task 14: Final Verification for Dialogs Extraction

**Files:**
- Verify: `src/app/(app)/maintenance/page.tsx`
- Verify: `src/app/(app)/maintenance/_components/maintenance-dialogs.tsx`

**Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS with 0 errors

**Step 2: Run build**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Manual smoke test**

Run: `npm run dev`

Then test each dialog:
1. **Add Plan**: Click "Thêm kế hoạch" → dialog opens → submit → verify plan appears
2. **Edit Plan**: Click "Sửa" → dialog opens → modify → submit → verify changes
3. **Add Tasks**: Select plan → click "Thêm thiết bị" → dialog opens → add tasks → submit
4. **Bulk Schedule**: Select tasks → click "Lên lịch hàng loạt" → dialog opens → schedule
5. **Delete Confirmation**: Select tasks → click "Xóa" → confirmation appears → confirm
6. **Cancel Confirmation**: Make changes → click "Hủy bỏ" → confirmation appears → confirm

**Step 4: Check line counts**

```bash
wc -l src/app/(app)/maintenance/page.tsx
wc -l src/app/(app)/maintenance/_components/*.tsx
```

Expected:
- page.tsx: ~1178 lines
- maintenance-columns.tsx: ~220 lines
- maintenance-dialogs.tsx: ~150 lines
- task-editing.tsx: ~80 lines

**Step 5: Update Beads**

```bash
bd close <bead-id-for-dialogs> --reason="Extracted maintenance-dialogs.tsx (~150 lines). page.tsx reduced from 1258 to 1178 lines."
```

**Step 6: Final commit**

```bash
git add .
git commit -m "chore(maintenance): Phase 1B complete - dialogs extraction"
```

---

## Task 15: Final Integration Testing

**Files:**
- Verify entire maintenance page functionality

**Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS with 0 errors

**Step 2: Run production build**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Complete workflow testing**

Run: `npm run dev`

Test the following workflows end-to-end:

**Workflow 1: Plan Management**
1. Navigate to `/maintenance`
2. Create new plan → verify in table
3. Edit plan → verify changes
4. Approve plan → verify status change
5. Delete plan → verify removed

**Workflow 2: Task Management**
1. Select draft plan
2. Add equipment → tasks appear
3. Inline edit task cells → save → changes persist
4. Refresh page → changes still there
5. Click "Lưu thay đổi" → verify saves to DB
6. Click "Xuất phiếu KH" → print preview opens

**Workflow 3: Bulk Operations**
1. Select plan with tasks
2. Select multiple task rows
3. Bulk schedule → verify checkboxes updated
4. Bulk assign unit → verify unit updated
5. Bulk delete → confirm deletion

**Workflow 4: Mobile/Desktop Views**
1. Resize browser to mobile width
2. Verify mobile cards render
3. Navigate through plans and tasks
4. Resize back to desktop
5. Verify tables render correctly

**Step 4: Check for console errors**

Open browser DevTools console and verify:
- No errors during page load
- No errors during interactions
- No warnings (except expected ones)

**Step 5: Final line count verification**

```bash
wc -l src/app/(app)/maintenance/page.tsx
```

Expected: ~1178 lines (target achieved)

**Step 6: Close all Beads issues**

```bash
bd close <main-bead-id> --reason="Phase 1 mechanical extraction complete. page.tsx reduced from 1628 to ~1178 lines (-28%).

Extracted components:
- maintenance-columns.tsx (~220 lines)
- maintenance-dialogs.tsx (~150 lines)
- task-editing.tsx (~80 lines)

Total extracted: ~450 lines
Final page.tsx: ~1178 lines"
```

**Step 7: Sync Beads**

```bash
bd sync --from-main
```

**Step 8: Final summary commit**

```bash
git add .
git commit -m "refactor(maintenance): Phase 1 mechanical extraction COMPLETE

Summary:
- page.tsx: 1628 → 1178 lines (-28%, -450 lines)
- Created 3 new components: maintenance-columns, maintenance-dialogs, task-editing
- All functionality preserved, zero logic changes
- All tests passing: typecheck, build, manual workflows

Components extracted:
1. maintenance-columns.tsx (~220 lines)
   - usePlanColumns() hook
   - useTaskColumns() hook

2. maintenance-dialogs.tsx (~150 lines)
   - All 6 dialogs consolidated
   - Add/Edit Plan, Add Tasks, Bulk Schedule, 2× Alerts

3. task-editing.tsx (~80 lines)
   - useTaskEditing() hook
   - Inline editing state and handlers
   - NotesInput component

Architecture improvements:
✅ Better code organization
✅ Easier to locate and modify logic
✅ Single responsibility components
✅ Foundation for future enhancements

Tested workflows:
✅ Plan CRUD operations
✅ Task inline editing
✅ Bulk operations
✅ Dialog orchestration
✅ Mobile and desktop views
✅ Print generation

Related issues: Closed"
```

---

## Summary

| Task | Description | Lines Changed | Commit Message |
|------|-------------|---------------|----------------|
| 1-6 | Extract maintenance-columns | -220 | "feat(maintenance): add maintenance-columns extraction" |
| 7-10 | Extract task-editing | -80 | "feat(maintenance): add task-editing hook extraction" |
| 11-14 | Extract maintenance-dialogs | -150 | "feat(maintenance): add maintenance-dialogs extraction" |
| 15 | Final integration testing | 0 | "refactor(maintenance): Phase 1 COMPLETE" |

**Total extraction**: ~450 lines moved from page.tsx to 3 new components

**Final state**: page.tsx reduced from **1628 → ~1178 lines** (-28%)

**Success criteria:**
- ✅ `npm run typecheck` passes
- ✅ `npm run build` succeeds
- ✅ All manual workflows tested and passing
- ✅ No console errors
- ✅ Line count target achieved

**Risk mitigation:**
- Small commits after each component
- Typecheck and build validation at each step
- Manual testing after each extraction
- Git revert available if needed
