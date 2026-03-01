# Mobile Maintenance Layout Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the `MobileMaintenanceLayout` component (~800 lines) from `maintenance/page.tsx` into a separate file to reduce page complexity.

**Architecture:** Single-file extraction following the established `_components/` pattern. The component keeps its 56 props interface and moves with its helper function `getPlanStatusTone`.

**Tech Stack:** React, TypeScript, shadcn/ui, lucide-react, TanStack Table types

---

## Task 1: Create _components Directory

**Files:**
- Create: `src/app/(app)/maintenance/_components/` (directory)

**Step 1: Create the directory**

```bash
mkdir -p src/app/(app)/maintenance/_components
```

**Step 2: Verify directory exists**

Run: `ls src/app/(app)/maintenance/`
Expected: Should show `_components/` alongside `_hooks/` and `page.tsx`

**Step 3: No commit needed**

Git doesn't track empty directories. We'll commit with the first file.

---

## Task 2: Create mobile-maintenance-layout.tsx with Imports and Types

**Files:**
- Create: `src/app/(app)/maintenance/_components/mobile-maintenance-layout.tsx`
- Reference: `src/app/(app)/maintenance/page.tsx:1947-2003` (type definition)

**Step 1: Create the file with imports and type definition**

Create `src/app/(app)/maintenance/_components/mobile-maintenance-layout.tsx`:

```typescript
"use client"

import * as React from "react"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Edit,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  Save,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

export type MobileMaintenanceLayoutProps = {
  activeTab: string
  setActiveTab: (value: string) => void
  plans: MaintenancePlan[]
  selectedPlan: MaintenancePlan | null
  handleSelectPlan: (plan: MaintenancePlan) => void
  canManagePlans: boolean
  isRegionalLeader: boolean
  isLoadingPlans: boolean
  planSearchTerm: string
  setPlanSearchTerm: (value: string) => void
  onClearSearch: () => void
  totalPages: number
  totalCount: number
  currentPage: number
  setCurrentPage: (page: number) => void
  showFacilityFilter: boolean
  facilities: Array<{ id: number; name: string }>
  selectedFacilityId: number | null
  isLoadingFacilities: boolean
  isMobileFilterSheetOpen: boolean
  setIsMobileFilterSheetOpen: (open: boolean) => void
  pendingFacilityFilter: number | null
  setPendingFacilityFilter: (value: number | null) => void
  handleMobileFilterApply: () => void
  handleMobileFilterClear: () => void
  activeMobileFilterCount: number
  setIsAddPlanDialogOpen: (open: boolean) => void
  openApproveDialog: (plan: MaintenancePlan) => void
  openRejectDialog: (plan: MaintenancePlan) => void
  openDeleteDialog: (plan: MaintenancePlan) => void
  setEditingPlan: (plan: MaintenancePlan | null) => void
  setIsAddTasksDialogOpen: (open: boolean) => void
  handleGeneratePlanForm: () => void | Promise<void>
  tasks: MaintenanceTask[]
  draftTasks: MaintenanceTask[]
  isLoadingTasks: boolean
  expandedTaskIds: Record<number, boolean>
  toggleTaskExpansion: (taskId: number) => void
  hasChanges: boolean
  handleSaveAllChanges: () => void | Promise<void>
  handleCancelAllChanges: () => void
  isSavingAll: boolean
  setIsConfirmingCancel: (open: boolean) => void
  handleStartEdit: (task: MaintenanceTask) => void
  handleCancelEdit: () => void
  handleTaskDataChange: (field: keyof MaintenanceTask, value: unknown) => void
  handleSaveTask: () => void
  editingTaskId: number | null
  editingTaskData: Partial<MaintenanceTask> | null
  setTaskToDelete: (task: MaintenanceTask | null) => void
  canCompleteTask: boolean
  completionStatus: Record<string, { historyId: number }>
  handleMarkAsCompleted: (task: MaintenanceTask, month: number) => void | Promise<void>
  isCompletingTask: string | null
  isPlanApprovedForTasks: boolean
}

// Placeholder - will be replaced in next task
export function MobileMaintenanceLayout(props: MobileMaintenanceLayoutProps) {
  return <div>Placeholder</div>
}
```

**Step 2: Run typecheck to verify imports**

Run: `npm run typecheck`
Expected: PASS (no errors related to this file)

**Step 3: Commit**

```bash
git add src/app/(app)/maintenance/_components/mobile-maintenance-layout.tsx
git commit -m "feat(maintenance): add mobile-maintenance-layout scaffold with types"
```

---

## Task 3: Copy Component Implementation

**Files:**
- Modify: `src/app/(app)/maintenance/_components/mobile-maintenance-layout.tsx`
- Reference: `src/app/(app)/maintenance/page.tsx:2005-2803` (component + helper)

**Step 1: Copy getPlanStatusTone helper function**

Add before the component, after the type definition:

```typescript
function getPlanStatusTone(status: MaintenancePlan["trang_thai"]) {
  switch (status) {
    case "Bản nháp":
      return {
        header: "bg-amber-50 border-b border-amber-100",
      }
    case "Đã duyệt":
      return {
        header: "bg-emerald-50 border-b border-emerald-100",
      }
    case "Không duyệt":
      return {
        header: "bg-red-50 border-b border-red-100",
      }
    default:
      return {
        header: "bg-muted/50 border-b border-border/50",
      }
  }
}
```

**Step 2: Replace placeholder with full component**

Copy the entire `MobileMaintenanceLayout` function body from `page.tsx:2005-2782` (the function signature through the closing brace).

The component starts with:
```typescript
export function MobileMaintenanceLayout({
  activeTab,
  setActiveTab,
  // ... all props destructured
}: MobileMaintenanceLayoutProps) {
  const months = React.useMemo(() => Array.from({ length: 12 }, (_, idx) => idx + 1), [])
  // ... rest of implementation
}
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/(app)/maintenance/_components/mobile-maintenance-layout.tsx
git commit -m "feat(maintenance): add MobileMaintenanceLayout component implementation"
```

---

## Task 4: Update page.tsx to Import Extracted Component

**Files:**
- Modify: `src/app/(app)/maintenance/page.tsx`

**Step 1: Add import statement**

After the existing imports (around line 60-70), add:

```typescript
import { MobileMaintenanceLayout } from "./_components/mobile-maintenance-layout"
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (may show duplicate identifier warnings, which we'll fix in next task)

**Step 3: Commit**

```bash
git add src/app/(app)/maintenance/page.tsx
git commit -m "refactor(maintenance): add import for extracted MobileMaintenanceLayout"
```

---

## Task 5: Remove Extracted Code from page.tsx

**Files:**
- Modify: `src/app/(app)/maintenance/page.tsx:1947-2803`

**Step 1: Remove type definition, component, and helper**

Delete these sections from `page.tsx`:
1. `type MobileMaintenanceLayoutProps = { ... }` (lines ~1947-2003)
2. `function MobileMaintenanceLayout({ ... }) { ... }` (lines ~2005-2782)
3. `function getPlanStatusTone(status) { ... }` (lines ~2784-2803)

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Run build**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src/app/(app)/maintenance/page.tsx
git commit -m "refactor(maintenance): remove extracted MobileMaintenanceLayout (~800 lines)"
```

---

## Task 6: Final Verification

**Files:**
- Verify: `src/app/(app)/maintenance/page.tsx`
- Verify: `src/app/(app)/maintenance/_components/mobile-maintenance-layout.tsx`

**Step 1: Check line counts**

```bash
wc -l src/app/(app)/maintenance/page.tsx
wc -l src/app/(app)/maintenance/_components/mobile-maintenance-layout.tsx
```

Expected:
- page.tsx: ~2000 lines (down from ~2800)
- mobile-maintenance-layout.tsx: ~800 lines

**Step 2: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Run production build**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Update beads**

```bash
bd close qltbyt-nam-phong-tq5 --reason="Extracted MobileMaintenanceLayout (~800 lines) into _components/. page.tsx reduced from ~2800 to ~2000 lines."
bd sync --from-main
```

**Step 5: Final commit if needed**

If any cleanup was done:
```bash
git add .
git commit -m "chore(maintenance): Phase 2 complete - mobile layout extraction"
```

---

## Summary

| Task | Description | Lines Changed |
|------|-------------|---------------|
| 1 | Create _components directory | 0 |
| 2 | Create file with imports and types | +110 |
| 3 | Copy component implementation | +690 |
| 4 | Add import to page.tsx | +1 |
| 5 | Remove extracted code from page.tsx | -800 |
| 6 | Final verification | 0 |

**Net Result:** page.tsx reduced by ~800 lines, new component file ~800 lines.
