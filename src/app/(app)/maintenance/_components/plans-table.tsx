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
