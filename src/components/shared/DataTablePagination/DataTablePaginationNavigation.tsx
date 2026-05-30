"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CornerDownRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  onPageJump?: (page: number) => void
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

interface DataTablePaginationPageJumpProps {
  currentPage: number
  totalPages: number
  isDisabled: boolean | undefined
  onPageJump: (page: number) => void
}

const DataTablePaginationPageJump = React.memo(function DataTablePaginationPageJump({
  currentPage,
  totalPages,
  isDisabled,
  onPageJump,
}: DataTablePaginationPageJumpProps) {
  const [pageJumpValue, setPageJumpValue] = React.useState(() =>
    currentPage > 0 ? String(currentPage) : ""
  )
  const canJump = totalPages > 0

  const commitPageJump = React.useCallback(() => {
    if (isDisabled || totalPages <= 0) {
      return
    }

    const parsedPage = Number.parseInt(pageJumpValue, 10)
    if (Number.isNaN(parsedPage)) {
      return
    }

    const nextPage = Math.min(Math.max(parsedPage, 1), totalPages)
    onPageJump(nextPage)
    setPageJumpValue(String(nextPage))
  }, [isDisabled, onPageJump, pageJumpValue, totalPages])

  const handlePageJumpSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      commitPageJump()
    },
    [commitPageJump]
  )

  return (
    <form className="flex items-center gap-2" onSubmit={handlePageJumpSubmit}>
      <Input
        aria-label="Đi tới trang"
        type="number"
        inputMode="numeric"
        min={1}
        max={Math.max(1, totalPages)}
        value={pageJumpValue}
        onChange={(event) => setPageJumpValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return
          }
          event.preventDefault()
          commitPageJump()
        }}
        className="h-8 w-20"
        disabled={isDisabled || !canJump}
      />
      <Button
        type="button"
        variant="outline"
        className="h-8 px-2"
        disabled={isDisabled || !canJump}
        aria-label="Đi tới trang"
        onClick={commitPageJump}
      >
        <CornerDownRight className="size-4" />
      </Button>
    </form>
  )
})

/** Renders accessible pagination controls for the shared data table. */
export const DataTablePaginationNavigation = React.memo(function DataTablePaginationNavigation({
  currentPage,
  totalPages,
  canPreviousPage,
  canNextPage,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
  onPageJump,
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
      <output
        className="text-sm font-medium"
        aria-live="polite"
        aria-atomic="true"
      >
        {resolvedLabels.pageIndicator} {currentPage} {resolvedLabels.pageSeparator} {totalPages}
      </output>
      {onPageJump ? (
        <DataTablePaginationPageJump
          key={currentPage}
          currentPage={currentPage}
          totalPages={totalPages}
          isDisabled={isDisabled}
          onPageJump={onPageJump}
        />
      ) : null}
      <div className="flex items-center gap-x-2">
        <Button
          type="button"
          variant="outline"
          className={cn("hidden size-8 p-0", showFirstLastClass)}
          onClick={onFirstPage}
          disabled={isDisabled || !canPreviousPage}
        >
          <span className="sr-only">{resolvedAriaLabels.firstPage}</span>
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="size-11 p-0 rounded-xl sm:size-8"
          onClick={onPreviousPage}
          disabled={isDisabled || !canPreviousPage}
        >
          <span className="sr-only">{resolvedAriaLabels.prevPage}</span>
          <ChevronLeft className="size-5 sm:size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="size-11 p-0 rounded-xl sm:size-8"
          onClick={onNextPage}
          disabled={isDisabled || !canNextPage}
        >
          <span className="sr-only">{resolvedAriaLabels.nextPage}</span>
          <ChevronRight className="size-5 sm:size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn("hidden size-8 p-0", showFirstLastClass)}
          onClick={onLastPage}
          disabled={isDisabled || !canNextPage}
        >
          <span className="sr-only">{resolvedAriaLabels.lastPage}</span>
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  )
})
