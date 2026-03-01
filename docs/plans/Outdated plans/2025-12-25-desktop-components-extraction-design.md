# Desktop Components Extraction Design

**Date**: 2025-12-25
**Phase**: 3 of 4 (Maintenance Page Refactor)
**Target**: Extract desktop UI into 3 focused components

## Overview

Extract the desktop-specific UI (~350 lines) from `maintenance/page.tsx` into three focused components: `PlanFiltersBar`, `PlansTable`, and `TasksTable`. Column definitions remain in page.tsx since they reference many callbacks and state values.

## File Structure

```
src/app/(app)/maintenance/
├── _hooks/
│   ├── use-maintenance-operations.ts  (Phase 1)
│   ├── use-maintenance-drafts.ts      (Phase 1)
│   └── use-maintenance-print.ts       (Phase 1)
├── _components/
│   ├── mobile-maintenance-layout.tsx  (Phase 2 - 940 lines)
│   ├── plan-filters-bar.tsx           (NEW - ~80 lines)
│   ├── plans-table.tsx                (NEW - ~120 lines)
│   └── tasks-table.tsx                (NEW - ~150 lines)
└── page.tsx                           (reduced from ~1946 to ~1600 lines)
```

## Component Designs

### 1. PlanFiltersBar

**Purpose**: Renders the facility filter dropdown, search input, and regional leader info banner.

**Source Lines**: 1517-1600 (~83 lines)

**Props Interface**:
```typescript
export type PlanFiltersBarProps = {
  // Facility filter
  showFacilityFilter: boolean
  facilities: Array<{ id: number; name: string }>
  selectedFacilityId: number | null
  onFacilityChange: (id: number | null) => void
  isLoadingFacilities: boolean
  totalCount: number

  // Search
  searchTerm: string
  onSearchChange: (value: string) => void

  // Regional leader banner
  isRegionalLeader: boolean
}
```

**Renders**:
- Regional leader info banner (when `isRegionalLeader`)
- Facility dropdown with Building2 icon
- Count badges (facilities count, plans count)
- Search input with clear button

### 2. PlansTable

**Purpose**: Renders the plans TanStack Table with server-side pagination.

**Source Lines**: 1603-1737 (~134 lines)

**Props Interface**:
```typescript
import type { Table, ColumnDef } from "@tanstack/react-table"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"

export type PlansTableProps = {
  table: Table<MaintenancePlan>
  columns: ColumnDef<MaintenancePlan>[]
  isLoading: boolean
  onRowClick: (plan: MaintenancePlan) => void

  // Server-side pagination
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void

  // Display info
  displayCount: number
  isFiltered: boolean
}
```

**Renders**:
- Table with header groups and rows
- Loading skeleton (5 rows)
- Empty state message
- Pagination footer with:
  - Display count text
  - Page size selector
  - Page indicator
  - Navigation buttons (first, prev, next, last)

### 3. TasksTable

**Purpose**: Renders the tasks TanStack Table with bulk action bar and client-side pagination.

**Source Lines**: 1789-1939 (~150 lines)

**Props Interface**:
```typescript
import type { Table, ColumnDef } from "@tanstack/react-table"
import type { MaintenanceTask } from "@/lib/data"

export type TasksTableProps = {
  table: Table<MaintenanceTask>
  columns: ColumnDef<MaintenanceTask>[]
  isLoading: boolean
  editingTaskId: number | null
  totalCount: number

  // Bulk actions
  selectedCount: number
  showBulkActions: boolean
  onBulkSchedule: () => void
  onBulkAssignUnit: (unit: string | null) => void
  onBulkDelete: () => void
}
```

**Renders**:
- Bulk action bar (when `showBulkActions && selectedCount > 0`):
  - Selection count
  - "Lên lịch hàng loạt" button
  - "Gán ĐVTH" dropdown (Nội bộ, Thuê ngoài, Xóa đơn vị)
  - "Xóa" button
- Table with header groups and rows
- Row highlighting for editing task
- Empty state message
- Pagination footer (client-side via table instance)

## Changes to page.tsx

### Add Imports
```typescript
import { PlanFiltersBar } from "./_components/plan-filters-bar"
import { PlansTable } from "./_components/plans-table"
import { TasksTable } from "./_components/tasks-table"
```

### Keep in page.tsx
- `planColumns` definition (lines 681-817)
- `taskColumns` definition (lines 889-1206)
- `planTable` hook (lines 819-887)
- `taskTable` hook (lines 1208-1223)
- `renderMobileCards()` function (lines 476-678)

### Replace JSX
Replace inline JSX with component calls:
- Lines 1517-1600 → `<PlanFiltersBar ... />`
- Lines 1603-1737 → `<PlansTable ... />`
- Lines 1789-1939 → `<TasksTable ... />`

## Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| page.tsx | 1946 lines | ~1600 lines |
| plan-filters-bar.tsx | 0 | ~80 lines |
| plans-table.tsx | 0 | ~120 lines |
| tasks-table.tsx | 0 | ~150 lines |
| **Net reduction** | — | ~350 lines |

## Dependencies

### Required Imports for New Components

**plan-filters-bar.tsx**:
```typescript
import { AlertTriangle, Building2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
```

**plans-table.tsx**:
```typescript
import { flexRender } from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
```

**tasks-table.tsx**:
```typescript
import { flexRender } from "@tanstack/react-table"
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
```

## Related Work

- **Phase 1** (Complete): Extract hooks
- **Phase 2** (Complete): Extract MobileMaintenanceLayout
- **Phase 3** (This design): Extract desktop components
- **Phase 4** (Blocked): Simplify page.tsx to controller only
