# Desktop Components Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract 3 desktop UI components (PlanFiltersBar, PlansTable, TasksTable) from maintenance/page.tsx to reduce complexity by ~350 lines.

**Architecture:** Create focused presentational components that receive data and callbacks as props. Column definitions stay in page.tsx since they reference 15+ callbacks/state values. Components use TanStack Table instances passed from parent.

**Tech Stack:** React, TypeScript, TanStack Table, shadcn/ui, lucide-react

---

## Task 1: Create PlanFiltersBar Component

**Files:**
- Create: `src/app/(app)/maintenance/_components/plan-filters-bar.tsx`
- Reference: `src/app/(app)/maintenance/page.tsx:1517-1600`

**Step 1: Create the component file with types and imports**

Create `src/app/(app)/maintenance/_components/plan-filters-bar.tsx`:

```typescript
"use client"

import { AlertTriangle, Building2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

export function PlanFiltersBar({
  showFacilityFilter,
  facilities,
  selectedFacilityId,
  onFacilityChange,
  isLoadingFacilities,
  totalCount,
  searchTerm,
  onSearchChange,
  isRegionalLeader,
}: PlanFiltersBarProps) {
  return (
    <>
      {/* Regional Leader Info Banner */}
      {isRegionalLeader && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900">Chế độ xem của Sở Y tế</h4>
              <p className="text-sm text-blue-700 mt-1">
                Đang xem kế hoạch bảo trì thiết bị của tất cả cơ sở y tế trực thuộc trên địa bàn.
                Sở Y tế có thể xem chi tiết nhưng không được phép tạo, sửa, hoặc duyệt kế hoạch.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Facility Filter */}
      {showFacilityFilter && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select
              value={selectedFacilityId?.toString() || "all"}
              onValueChange={(value) => onFacilityChange(value === "all" ? null : parseInt(value, 10))}
              disabled={isLoadingFacilities || facilities.length === 0}
            >
              <SelectTrigger className="h-9 border-dashed">
                <SelectValue placeholder={isLoadingFacilities ? "Đang tải..." : "Chọn cơ sở..."} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>Tất cả cơ sở</span>
                  </div>
                </SelectItem>
                {facilities.length === 0 ? (
                  <SelectItem value="empty" disabled>
                    <span className="text-muted-foreground italic">Không có cơ sở</span>
                  </SelectItem>
                ) : (
                  facilities.map((facility) => (
                    <SelectItem key={facility.id} value={facility.id.toString()}>
                      <span className="truncate">{facility.name}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {selectedFacilityId && (
            <Badge variant="secondary" className="shrink-0">
              {totalCount} kế hoạch
            </Badge>
          )}
          {!selectedFacilityId && (
            <Badge variant="outline" className="shrink-0">
              {facilities.length} cơ sở • {totalCount} kế hoạch
            </Badge>
          )}
        </div>
      )}

      {/* Search Section */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Tìm kiếm theo tên kế hoạch, khoa/phòng, người lập..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="max-w-sm"
          />
        </div>
        {searchTerm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSearchChange("")}
          >
            <X className="h-4 w-4 mr-1" />
            Xóa tìm kiếm
          </Button>
        )}
      </div>
    </>
  )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/(app)/maintenance/_components/plan-filters-bar.tsx
git commit -m "feat(maintenance): add PlanFiltersBar component"
```

---

## Task 2: Create PlansTable Component

**Files:**
- Create: `src/app/(app)/maintenance/_components/plans-table.tsx`
- Reference: `src/app/(app)/maintenance/page.tsx:1603-1737`

**Step 1: Create the component file**

Create `src/app/(app)/maintenance/_components/plans-table.tsx`:

```typescript
"use client"

import type { Table, ColumnDef } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

export function PlansTable({
  table,
  columns,
  isLoading,
  onRowClick,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  displayCount,
  isFiltered,
}: PlansTableProps) {
  return (
    <>
      <div className="rounded-md border">
        <UITable>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columns.length}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => onRowClick(row.original)}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Chưa có kế hoạch nào.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </UITable>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between w-full mt-4">
        <div className="flex-1 text-sm text-muted-foreground">
          Hiển thị <strong>{displayCount}</strong> trên <strong>{totalCount}</strong> kế hoạch
          {isFiltered && " (đã lọc)"}
        </div>
        <div className="flex items-center gap-x-6 lg:gap-x-8">
          {/* Page size selector */}
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Số dòng</p>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 50, 100, 200].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page indicator */}
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Trang {currentPage} / {totalPages || 1}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1 || isLoading}
            >
              <span className="sr-only">Đến trang đầu</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isLoading}
            >
              <span className="sr-only">Trang trước</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || isLoading}
            >
              <span className="sr-only">Trang tiếp</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages || isLoading}
            >
              <span className="sr-only">Đến trang cuối</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/(app)/maintenance/_components/plans-table.tsx
git commit -m "feat(maintenance): add PlansTable component"
```

---

## Task 3: Create TasksTable Component

**Files:**
- Create: `src/app/(app)/maintenance/_components/tasks-table.tsx`
- Reference: `src/app/(app)/maintenance/page.tsx:1789-1939`

**Step 1: Create the component file**

Create `src/app/(app)/maintenance/_components/tasks-table.tsx`:

```typescript
"use client"

import type { Table, ColumnDef } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MaintenanceTask } from "@/lib/data"

export type TasksTableProps = {
  table: Table<MaintenanceTask>
  columns: ColumnDef<MaintenanceTask>[]
  editingTaskId: number | null
  totalCount: number

  // Bulk actions
  selectedCount: number
  showBulkActions: boolean
  onBulkSchedule: () => void
  onBulkAssignUnit: (unit: string | null) => void
  onBulkDelete: () => void
}

export function TasksTable({
  table,
  columns,
  editingTaskId,
  totalCount,
  selectedCount,
  showBulkActions,
  onBulkSchedule,
  onBulkAssignUnit,
  onBulkDelete,
}: TasksTableProps) {
  return (
    <>
      {/* Bulk Action Bar */}
      {showBulkActions && selectedCount > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-md border">
          <span className="text-sm font-medium">
            Đã chọn {selectedCount} mục:
          </span>
          <Button size="sm" variant="outline" onClick={onBulkSchedule}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Lên lịch hàng loạt
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Gán ĐVTH
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => onBulkAssignUnit('Nội bộ')}>Nội bộ</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onBulkAssignUnit('Thuê ngoài')}>Thuê ngoài</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onBulkAssignUnit(null)}>Xóa đơn vị</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="destructive" className="ml-auto" onClick={onBulkDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Xóa ({selectedCount})
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <UITable>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ minWidth: `${header.getSize()}px`, width: `${header.getSize()}px` }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.original.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={editingTaskId === row.original.id ? "bg-muted/50" : ""}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Chưa có công việc nào trong kế hoạch này.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </UITable>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between w-full mt-4">
        <div className="flex-1 text-sm text-muted-foreground">
          Đã chọn {table.getFilteredSelectedRowModel().rows.length} trên {totalCount} công việc.
        </div>
        <div className="flex items-center gap-x-6 lg:gap-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Số dòng</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Trang {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/(app)/maintenance/_components/tasks-table.tsx
git commit -m "feat(maintenance): add TasksTable component"
```

---

## Task 4: Update page.tsx Imports

**Files:**
- Modify: `src/app/(app)/maintenance/page.tsx`

**Step 1: Add imports for new components**

After the existing `MobileMaintenanceLayout` import (around line 92), add:

```typescript
import { PlanFiltersBar } from "./_components/plan-filters-bar"
import { PlansTable } from "./_components/plans-table"
import { TasksTable } from "./_components/tasks-table"
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (may show unused component warnings until we wire them up)

**Step 3: Commit**

```bash
git add src/app/(app)/maintenance/page.tsx
git commit -m "refactor(maintenance): add imports for desktop components"
```

---

## Task 5: Replace Plans Tab JSX with Components

**Files:**
- Modify: `src/app/(app)/maintenance/page.tsx:1517-1737`

**Step 1: Replace PlanFiltersBar section**

Find the section starting with `{/* Regional Leader Info Banner */}` (around line 1517) through the search section (around line 1600).

Replace with:

```typescript
<PlanFiltersBar
  showFacilityFilter={showFacilityFilter}
  facilities={facilities}
  selectedFacilityId={selectedFacilityId}
  onFacilityChange={setSelectedFacilityId}
  isLoadingFacilities={isLoadingFacilities}
  totalCount={totalCount}
  searchTerm={planSearchTerm}
  onSearchChange={setPlanSearchTerm}
  isRegionalLeader={isRegionalLeader}
/>
```

**Step 2: Replace PlansTable section**

Find the section with `{isMobile ? (` through the `</CardFooter>` (around lines 1603-1737).

Replace the desktop branch (the part after `:` in the ternary) and the CardFooter with:

```typescript
{isMobile ? (
  renderMobileCards()
) : (
  <PlansTable
    table={planTable}
    columns={planColumns}
    isLoading={isLoadingPlans}
    onRowClick={handleSelectPlan}
    currentPage={currentPage}
    totalPages={totalPages}
    totalCount={totalCount}
    pageSize={pageSize}
    onPageChange={setCurrentPage}
    onPageSizeChange={(size) => {
      setPageSize(size)
      setCurrentPage(1)
    }}
    displayCount={plans.length}
    isFiltered={!!(debouncedPlanSearch || selectedFacilityId)}
  />
)}
```

And remove the old `<CardFooter>...</CardFooter>` since pagination is now inside PlansTable.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/(app)/maintenance/page.tsx
git commit -m "refactor(maintenance): use PlanFiltersBar and PlansTable components"
```

---

## Task 6: Replace Tasks Tab JSX with TasksTable

**Files:**
- Modify: `src/app/(app)/maintenance/page.tsx:1789-1939`

**Step 1: Replace TasksTable section**

Find the section inside `<CardContent>` that starts with `{isLoadingTasks ? (` through the closing `</CardContent>` (around lines 1789-1868).

Replace with:

```typescript
{isLoadingTasks ? (
  <div className="flex items-center justify-center py-10">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
) : (
  <TasksTable
    table={taskTable}
    columns={taskColumns}
    editingTaskId={editingTaskId}
    totalCount={draftTasks.length}
    selectedCount={selectedTaskRowsCount}
    showBulkActions={!isPlanApproved && canManagePlans}
    onBulkSchedule={() => setIsBulkScheduleOpen(true)}
    onBulkAssignUnit={handleBulkAssignUnit}
    onBulkDelete={() => setIsConfirmingBulkDelete(true)}
  />
)}
```

**Step 2: Remove old CardFooter pagination**

Remove the `<CardFooter>...</CardFooter>` section (lines ~1870-1940) since pagination is now inside TasksTable.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Run build**

Run: `npm run build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add src/app/(app)/maintenance/page.tsx
git commit -m "refactor(maintenance): use TasksTable component"
```

---

## Task 7: Final Verification

**Files:**
- Verify all files in `src/app/(app)/maintenance/`

**Step 1: Check line counts**

```bash
wc -l src/app/(app)/maintenance/page.tsx
wc -l src/app/(app)/maintenance/_components/*.tsx
```

Expected:
- page.tsx: ~1600 lines (down from ~1946)
- plan-filters-bar.tsx: ~80 lines
- plans-table.tsx: ~120 lines
- tasks-table.tsx: ~150 lines

**Step 2: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Run production build**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Close bead and sync**

```bash
bd close qltbyt-nam-phong-qlh --reason="Extracted 3 desktop components (PlanFiltersBar, PlansTable, TasksTable). page.tsx reduced from ~1946 to ~1600 lines."
bd sync --from-main
```

**Step 5: Final commit if needed**

```bash
git add .
git commit -m "chore(maintenance): Phase 3 complete - desktop components extraction"
```

---

## Summary

| Task | Description | Lines Changed |
|------|-------------|---------------|
| 1 | Create PlanFiltersBar | +80 |
| 2 | Create PlansTable | +120 |
| 3 | Create TasksTable | +150 |
| 4 | Add imports to page.tsx | +3 |
| 5 | Replace Plans Tab JSX | -180 |
| 6 | Replace Tasks Tab JSX | -170 |
| 7 | Final verification | 0 |

**Net Result:** page.tsx reduced by ~350 lines, 3 new component files totaling ~350 lines.
