"use client"

import type { Table, ColumnDef } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import { DataTablePagination } from "@/components/shared/DataTablePagination"
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

const PLAN_ENTITY = { singular: "kế hoạch" } as const

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
  const displayFormat = () => {
    const base = `Hiển thị ${displayCount} trên ${totalCount} kế hoạch`
    return isFiltered ? `${base} (đã lọc)` : base
  }

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
      <div className="w-full mt-4">
        <DataTablePagination
          table={table}
          totalCount={totalCount}
          entity={PLAN_ENTITY}
          paginationMode={{
            mode: "server",
            currentPage,
            totalPages,
            pageSize,
            onPageChange,
            onPageSizeChange,
          }}
          displayFormat={displayFormat}
          pageSizeOptions={[10, 20, 50, 100, 200]}
          responsive={{ showFirstLastAt: "lg" }}
          isLoading={isLoading}
          enabled
        />
      </div>
    </>
  )
}
