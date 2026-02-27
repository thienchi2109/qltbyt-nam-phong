# Mobile Maintenance Layout Extraction Design

**Date**: 2025-12-25
**Phase**: 2 of 4 (Maintenance Page Refactor)
**Target**: Extract `MobileMaintenanceLayout` component from `page.tsx`

## Overview

Extract the mobile-specific UI component (~800 lines) from `maintenance/page.tsx` into a dedicated file, following the established `_components/` pattern used in `repair-requests/`.

## File Structure

```
src/app/(app)/maintenance/
├── _hooks/
│   ├── use-maintenance-operations.ts  (Phase 1 - done)
│   ├── use-maintenance-drafts.ts      (Phase 1 - done)
│   └── use-maintenance-print.ts       (Phase 1 - done)
├── _components/
│   └── mobile-maintenance-layout.tsx  (NEW - ~800 lines)
└── page.tsx                           (reduced from ~2800 to ~2000 lines)
```

## Component Design

### Approach: Single File Extraction

Extract the entire component as-is into one file. This matches the `repair-requests/_components/RepairRequestsPageClient.tsx` pattern.

### What Gets Extracted

From `page.tsx`:
- Type definition: `MobileMaintenanceLayoutProps` (lines 1947-2003)
- Component: `MobileMaintenanceLayout` (lines 2005-2782)
- Helper function: `getPlanStatusTone` (lines 2784-2803)

### Props Interface (56 props)

The component receives all state and handlers from the parent page via props:

```typescript
type MobileMaintenanceLayoutProps = {
  // Tab state
  activeTab: string
  setActiveTab: (value: string) => void

  // Plan data
  plans: MaintenancePlan[]
  selectedPlan: MaintenancePlan | null
  handleSelectPlan: (plan: MaintenancePlan) => void
  isLoadingPlans: boolean

  // Pagination
  totalPages: number
  totalCount: number
  currentPage: number
  setCurrentPage: (page: number) => void

  // Search
  planSearchTerm: string
  setPlanSearchTerm: (value: string) => void
  onClearSearch: () => void

  // Facility filter
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

  // Permissions
  canManagePlans: boolean
  isRegionalLeader: boolean

  // Dialog triggers
  setIsAddPlanDialogOpen: (open: boolean) => void
  openApproveDialog: (plan: MaintenancePlan) => void
  openRejectDialog: (plan: MaintenancePlan) => void
  openDeleteDialog: (plan: MaintenancePlan) => void
  setEditingPlan: (plan: MaintenancePlan | null) => void
  setIsAddTasksDialogOpen: (open: boolean) => void
  handleGeneratePlanForm: () => void | Promise<void>

  // Task data
  tasks: MaintenanceTask[]
  draftTasks: MaintenanceTask[]
  isLoadingTasks: boolean

  // Task expansion
  expandedTaskIds: Record<number, boolean>
  toggleTaskExpansion: (taskId: number) => void

  // Draft changes
  hasChanges: boolean
  handleSaveAllChanges: () => void | Promise<void>
  handleCancelAllChanges: () => void
  isSavingAll: boolean
  setIsConfirmingCancel: (open: boolean) => void

  // Task editing
  handleStartEdit: (task: MaintenanceTask) => void
  handleCancelEdit: () => void
  handleTaskDataChange: (field: keyof MaintenanceTask, value: unknown) => void
  handleSaveTask: () => void
  editingTaskId: number | null
  editingTaskData: Partial<MaintenanceTask> | null
  setTaskToDelete: (task: MaintenanceTask | null) => void

  // Task completion
  canCompleteTask: boolean
  completionStatus: Record<string, { historyId: number }>
  handleMarkAsCompleted: (task: MaintenanceTask, month: number) => void | Promise<void>
  isCompletingTask: string | null
  isPlanApprovedForTasks: boolean
}
```

### Internal Structure

The component contains:
1. Local computed values (`months`, `planTabActive`, `safeAreaFooterStyle`, etc.)
2. Helper callbacks (`resolveStatusBadgeVariant`, `handleFacilityOptionSelect`)
3. Render functions (`renderPlanCards`, `renderTasks`)
4. JSX with tabs, cards, pagination, and bottom sheet

### Helper Function

```typescript
function getPlanStatusTone(status: MaintenancePlan["trang_thai"]) {
  switch (status) {
    case "Bản nháp":
      return { header: "bg-amber-50 border-b border-amber-100" }
    case "Đã duyệt":
      return { header: "bg-emerald-50 border-b border-emerald-100" }
    case "Không duyệt":
      return { header: "bg-red-50 border-b border-red-100" }
    default:
      return { header: "bg-muted/50 border-b border-border/50" }
  }
}
```

## Changes to page.tsx

1. **Add import**:
   ```typescript
   import { MobileMaintenanceLayout } from "./_components/mobile-maintenance-layout"
   ```

2. **Remove**: Lines 1947-2803 (type definition, component, and helper)

3. **Keep**: The existing JSX at line ~1425 that renders `<MobileMaintenanceLayout ... />`

## Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| page.tsx lines | ~2803 | ~2000 |
| Extracted component | 0 | ~800 lines |
| Reduction | — | ~800 lines |

## Dependencies

### Required Imports for New Component

```typescript
// React
import * as React from "react"

// Types
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"

// Icons
import { AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronDown,
         ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
         ClipboardList, Edit, FileText, Filter, Loader2, MoreHorizontal,
         PlusCircle, Save, Search, Trash2, Undo2, X } from "lucide-react"

// UI Components
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem,
         DropdownMenuLabel, DropdownMenuSeparator,
         DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger,
         SelectValue } from "@/components/ui/select"
import { Sheet, SheetClose, SheetContent, SheetFooter,
         SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
```

## Related Work

- **Phase 1** (Complete): Extract hooks (`use-maintenance-operations`, `use-maintenance-drafts`, `use-maintenance-print`)
- **Phase 2** (This design): Extract `MobileMaintenanceLayout`
- **Phase 3** (Blocked): Extract Desktop UI components
- **Phase 4** (Blocked): Simplify page.tsx to controller only
