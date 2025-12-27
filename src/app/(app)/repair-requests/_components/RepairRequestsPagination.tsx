import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import type { Table } from "@tanstack/react-table"

/**
 * Props for the RepairRequestsPagination component.
 */
export interface RepairRequestsPaginationProps<T> {
  /** The react-table instance */
  table: Table<T>
  /** Total number of requests (for accurate display text) */
  totalRequests: number
  /** Current pagination state */
  pagination: { pageIndex: number; pageSize: number }
}

/**
 * Pagination controls with page size selector and navigation buttons.
 * Displays current position and allows navigation between pages.
 */
export function RepairRequestsPagination<T>({
  table,
  totalRequests,
  pagination
}: RepairRequestsPaginationProps<T>) {
  const currentPage = pagination.pageIndex + 1
  const pageSize = pagination.pageSize
  const startItem = totalRequests > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const endItem = Math.min(currentPage * pageSize, totalRequests)

  return (
    <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4 md:gap-0">
      {/* Display text */}
      <div className="flex-1 text-sm text-muted-foreground text-center md:text-left w-full md:w-auto order-2 md:order-1">
        Hiển thị {startItem}-{endItem} trên tổng {totalRequests} yêu cầu
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-4 md:space-x-6 lg:space-x-8 w-full md:w-auto justify-center md:justify-end order-1 md:order-2">
        {/* Page size selector */}
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Số dòng</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger className="h-8 w-[70px] touch-target-sm md:h-8">
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

        {/* Page indicator */}
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Trang {currentPage} / {table.getPageCount()}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex touch-target-sm md:h-8 md:w-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0 touch-target-sm md:h-8 md:w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0 touch-target-sm md:h-8 md:w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex touch-target-sm md:h-8 md:w-8"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
