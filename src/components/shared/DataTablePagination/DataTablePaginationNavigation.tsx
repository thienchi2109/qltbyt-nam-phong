"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DEFAULT_ARIA_LABELS = {
  firstPage: "Đến trang đầu",
  prevPage: "Trang trước",
  nextPage: "Trang tiếp",
  lastPage: "Đến trang cuối",
}

const DEFAULT_LABELS = {
  pageIndicator: "Trang",
  pageSeparator: "/",
}

export interface DataTablePaginationNavigationProps {
  currentPage: number
  totalPages: number
  canPreviousPage: boolean
  canNextPage: boolean
  onFirstPage: () => void
  onPreviousPage: () => void
  onNextPage: () => void
  onLastPage: () => void
  showFirstLastAt?: "sm" | "md" | "lg"
  stackAt?: "sm" | "md" | "lg"
  disabled?: boolean
  isLoading?: boolean
  ariaLabels?: {
    firstPage?: string
    prevPage?: string
    nextPage?: string
    lastPage?: string
  }
  labels?: {
    pageIndicator?: string
    pageSeparator?: string
  }
  className?: string
}

export const DataTablePaginationNavigation = React.memo(function DataTablePaginationNavigation({
  currentPage,
  totalPages,
  canPreviousPage,
  canNextPage,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
  showFirstLastAt = "sm",
  stackAt = "sm",
  disabled,
  isLoading,
  ariaLabels,
  labels,
  className,
}: DataTablePaginationNavigationProps) {
  const resolvedAriaLabels = { ...DEFAULT_ARIA_LABELS, ...ariaLabels }
  const resolvedLabels = { ...DEFAULT_LABELS, ...labels }
  const isDisabled = disabled || isLoading
  const showFirstLastClass =
    showFirstLastAt === "md"
      ? "md:flex"
      : showFirstLastAt === "lg"
        ? "lg:flex"
        : "sm:flex"
  const stackClass =
    stackAt === "md"
      ? "md:flex-row md:gap-3"
      : stackAt === "lg"
        ? "lg:flex-row lg:gap-3"
        : "sm:flex-row sm:gap-3"

  return (
    <div className={cn("flex flex-col items-center gap-2", stackClass, className)}>
      <div 
        className="text-sm font-medium"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {resolvedLabels.pageIndicator} {currentPage} {resolvedLabels.pageSeparator} {totalPages}
      </div>
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          className={cn("hidden h-8 w-8 p-0", showFirstLastClass)}
          onClick={onFirstPage}
          disabled={isDisabled || !canPreviousPage}
        >
          <span className="sr-only">{resolvedAriaLabels.firstPage}</span>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-11 p-0 rounded-xl sm:h-8 sm:w-8"
          onClick={onPreviousPage}
          disabled={isDisabled || !canPreviousPage}
        >
          <span className="sr-only">{resolvedAriaLabels.prevPage}</span>
          <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-11 p-0 rounded-xl sm:h-8 sm:w-8"
          onClick={onNextPage}
          disabled={isDisabled || !canNextPage}
        >
          <span className="sr-only">{resolvedAriaLabels.nextPage}</span>
          <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn("hidden h-8 w-8 p-0", showFirstLastClass)}
          onClick={onLastPage}
          disabled={isDisabled || !canNextPage}
        >
          <span className="sr-only">{resolvedAriaLabels.lastPage}</span>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
})
