/**
 * equipment-pagination.tsx
 *
 * Pagination controls for the equipment table.
 * Includes page size selector, navigation buttons, and export link.
 * Renders responsively for mobile and desktop layouts.
 */

"use client"

import * as React from "react"
import type { Table } from "@tanstack/react-table"
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
import { ResponsivePaginationInfo } from "@/components/responsive-pagination-info"
import type { Equipment } from "@/types/database"

export interface EquipmentPaginationProps {
  table: Table<Equipment>
  pagination: { pageIndex: number; pageSize: number }
  onPaginationChange: (pagination: { pageIndex: number; pageSize: number }) => void
  pageCount: number
  currentCount: number
  totalCount: number
  onExportData: () => void
  isLoading: boolean
  shouldFetchEquipment: boolean
}

export function EquipmentPagination({
  table,
  pagination,
  onPaginationChange,
  pageCount,
  currentCount,
  totalCount,
  onExportData,
  isLoading,
  shouldFetchEquipment,
}: EquipmentPaginationProps) {
  if (!shouldFetchEquipment) {
    return null
  }

  return (
    <>
      {/* Records count - responsive position */}
      <div className="order-2 sm:order-1">
        <ResponsivePaginationInfo
          currentCount={currentCount}
          totalCount={totalCount}
          currentPage={pagination.pageIndex + 1}
          totalPages={pageCount}
        />
      </div>

      {/* Export and pagination controls */}
      <div className="flex flex-col gap-3 items-center order-1 sm:order-2 sm:items-end">
        <button
          onClick={onExportData}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
          disabled={table.getFilteredRowModel().rows.length === 0 || isLoading}
        >
          Tải về file Excel
        </button>

        {/* Mobile-optimized pagination */}
        <div className="flex flex-col gap-3 items-center sm:flex-row sm:gap-6">
          {/* Page size selector - Hidden on mobile */}
          <div className="hidden sm:flex items-center space-x-2">
            <p className="text-sm font-medium">Số dòng</p>
            <Select
              value={`${pagination.pageSize}`}
              onValueChange={(value) => {
                onPaginationChange({ ...pagination, pageSize: Number(value), pageIndex: 0 })
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pagination.pageSize} />
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

          {/* Page info and navigation */}
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
            <div className="text-sm font-medium">
              Trang {pagination.pageIndex + 1} / {pageCount}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 sm:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-10 w-10 p-0 rounded-xl sm:h-8 sm:w-8"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-10 w-10 p-0 rounded-xl sm:h-8 sm:w-8"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 sm:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
