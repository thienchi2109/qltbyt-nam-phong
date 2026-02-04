"use client"

import * as React from "react"
import type { RowData } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { DataTablePaginationInfo } from "./DataTablePaginationInfo"
import { DataTablePaginationNavigation } from "./DataTablePaginationNavigation"
import { DataTablePaginationSizeSelector } from "./DataTablePaginationSizeSelector"
import type { DataTablePaginationProps } from "./types"

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100]

export function DataTablePaginationMain<TData extends RowData>({
  table,
  totalCount,
  entity,
  paginationMode,
  displayFormat = "count-total",
  showFilteredIndicator = false,
  isFiltered = false,
  pageSizeOptions,
  responsive,
  isLoading,
  disabled,
  enabled = true,
  slots,
  ariaLabels,
  className,
}: DataTablePaginationProps<TData>) {
  const safeTotalCount = Math.max(0, totalCount)
  const isServer = paginationMode?.mode === "server"
  const isControlled = paginationMode?.mode === "controlled"
  const tablePagination = table.getState().pagination

  const pageSize = paginationMode?.mode === "server"
    ? paginationMode.pageSize
    : paginationMode?.mode === "controlled"
      ? paginationMode.pagination.pageSize
      : tablePagination.pageSize

  const pageIndex = paginationMode?.mode === "server"
    ? Math.max(0, paginationMode.currentPage - 1)
    : paginationMode?.mode === "controlled"
      ? paginationMode.pagination.pageIndex
      : tablePagination.pageIndex

  const totalPages = paginationMode?.mode === "server"
    ? paginationMode.totalPages
    : Math.max(0, Math.ceil(safeTotalCount / pageSize))

  const currentPage = totalPages === 0
    ? 0
    : paginationMode?.mode === "server"
      ? paginationMode.currentPage
      : pageIndex + 1
  const lastPageIndex = Math.max(0, totalPages - 1)
  const safePageIndex = Math.min(pageIndex, lastPageIndex)

  const canPreviousPage = totalPages > 0 && (isServer ? currentPage > 1 : safePageIndex > 0)
  const canNextPage = totalPages > 0 && (isServer ? currentPage < totalPages : safePageIndex < lastPageIndex)

  const selectedCount =
    typeof table.getFilteredSelectedRowModel === "function"
      ? table.getFilteredSelectedRowModel().rows.length
      : 0

  const hasItems = safeTotalCount > 0 && currentPage > 0
  const startItem = hasItems ? (currentPage - 1) * pageSize + 1 : 0
  const endItem = hasItems ? Math.min(currentPage * pageSize, safeTotalCount) : 0

  const { showFirstLastAt = "sm", showSizeSelectorAt = null, stackLayoutAt = "sm" } =
    responsive ?? {}

  const resolvedPageSizeOptions = pageSizeOptions ?? DEFAULT_PAGE_SIZES

  // All hooks must be called before any early return
  const setPageIndex = React.useCallback(
    (nextIndex: number) => {
      if (isServer && paginationMode?.mode === "server") {
        paginationMode.onPageChange(nextIndex + 1)
        return
      }
      if (isControlled && paginationMode?.mode === "controlled") {
        paginationMode.onPaginationChange({
          ...paginationMode.pagination,
          pageIndex: nextIndex,
        })
        return
      }
      table.setPageIndex(nextIndex)
    },
    [isServer, isControlled, paginationMode, table]
  )

  const handlePageSizeChange = React.useCallback(
    (size: number) => {
      if (isServer && paginationMode?.mode === "server") {
        paginationMode.onPageSizeChange(size)
        paginationMode.onPageChange(1)
        return
      }
      if (isControlled && paginationMode?.mode === "controlled") {
        paginationMode.onPaginationChange({ pageIndex: 0, pageSize: size })
        return
      }
      table.setPageSize(size)
    },
    [isServer, isControlled, paginationMode, table]
  )

  const handleFirstPage = React.useCallback(() => {
    setPageIndex(0)
  }, [setPageIndex])

  const handlePreviousPage = React.useCallback(() => {
    setPageIndex(Math.max(0, safePageIndex - 1))
  }, [setPageIndex, safePageIndex])

  const handleNextPage = React.useCallback(() => {
    setPageIndex(Math.min(safePageIndex + 1, lastPageIndex))
  }, [setPageIndex, safePageIndex, lastPageIndex])

  const handleLastPage = React.useCallback(() => {
    setPageIndex(lastPageIndex)
  }, [setPageIndex, lastPageIndex])

  // Early return AFTER all hooks
  if (!enabled) {
    return null
  }

  const stackClass =
    stackLayoutAt === "md"
      ? "md:flex-row md:gap-0"
      : stackLayoutAt === "lg"
        ? "lg:flex-row lg:gap-0"
        : "sm:flex-row sm:gap-0"

  const infoOrderClass =
    stackLayoutAt === "md"
      ? "md:order-1"
      : stackLayoutAt === "lg"
        ? "lg:order-1"
        : "sm:order-1"

  const controlsOrderClass =
    stackLayoutAt === "md"
      ? "md:order-2"
      : stackLayoutAt === "lg"
        ? "lg:order-2"
        : "sm:order-2"

  const controlsAlignClass =
    stackLayoutAt === "md"
      ? "md:items-end md:w-auto"
      : stackLayoutAt === "lg"
        ? "lg:items-end lg:w-auto"
        : "sm:items-end sm:w-auto"

  const navRowClass =
    stackLayoutAt === "md"
      ? "md:flex-row md:gap-6"
      : stackLayoutAt === "lg"
        ? "lg:flex-row lg:gap-6"
        : "sm:flex-row sm:gap-6"

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-4 flex-col",
        stackClass,
        className
      )}
    >
      <div className={cn("flex-1 w-full order-2", infoOrderClass)}>
        {slots?.beforeInfo}
        <DataTablePaginationInfo
          displayContext={{
            startItem,
            endItem,
            totalCount: safeTotalCount,
            currentPage,
            totalPages,
            selectedCount,
            entity,
          }}
          displayFormat={displayFormat}
          showFilteredIndicator={showFilteredIndicator}
          isFiltered={isFiltered}
        />
        {slots?.afterInfo}
      </div>

      <div
        className={cn(
          "flex flex-col gap-3 items-center w-full order-1",
          controlsOrderClass,
          controlsAlignClass
        )}
      >
        {slots?.beforeNav}
        <div className={cn("flex flex-col items-center gap-3", navRowClass)}>
          <DataTablePaginationSizeSelector
            pageSize={pageSize}
            pageSizeOptions={resolvedPageSizeOptions}
            onPageSizeChange={handlePageSizeChange}
            showAt={showSizeSelectorAt}
            disabled={disabled || isLoading}
          />
          <DataTablePaginationNavigation
            currentPage={currentPage}
            totalPages={totalPages}
            canPreviousPage={canPreviousPage}
            canNextPage={canNextPage}
            onFirstPage={handleFirstPage}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
            onLastPage={handleLastPage}
            showFirstLastAt={showFirstLastAt}
            stackAt={stackLayoutAt}
            disabled={disabled}
            isLoading={isLoading}
            ariaLabels={ariaLabels}
          />
        </div>
        {slots?.afterNav}
      </div>
    </div>
  )
}
