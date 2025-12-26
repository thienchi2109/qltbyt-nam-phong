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
