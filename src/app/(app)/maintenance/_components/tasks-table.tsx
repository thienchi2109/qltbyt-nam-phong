"use client"

import type { Table, ColumnDef } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import {
  CalendarDays,
  Trash2,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/shared/DataTablePagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MaintenanceTask } from "@/lib/data"

const TASK_ENTITY = { singular: "công việc" } as const

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
  const filteredTotal = table.getFilteredRowModel().rows.length

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
      <div className="w-full mt-4">
        <DataTablePagination
          table={table}
          totalCount={filteredTotal}
          entity={TASK_ENTITY}
          displayFormat={(ctx) => `Đã chọn ${ctx.selectedCount ?? 0} trên ${totalCount} công việc.`}
          responsive={{ showFirstLastAt: "lg" }}
        />
      </div>
    </>
  )
}
