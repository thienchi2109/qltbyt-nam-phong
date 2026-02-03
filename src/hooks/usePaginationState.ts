import * as React from "react"
import type { UsePaginationStateOptions, UsePaginationStateReturn } from "@/components/shared/DataTablePagination/types"

export function usePaginationState({
  initialPageSize = 20,
  initialPageIndex = 0,
  totalCount,
  resetKey,
}: UsePaginationStateOptions): UsePaginationStateReturn {
  const [pagination, setPagination] = React.useState({
    pageIndex: initialPageIndex,
    pageSize: initialPageSize,
  })

  const pageCount = Math.max(0, Math.ceil(totalCount / pagination.pageSize))

  // Auto-reset to first page when resetKey changes
  const prevResetKey = React.useRef(resetKey)
  React.useEffect(() => {
    if (resetKey !== prevResetKey.current) {
      setPagination(prev => ({ ...prev, pageIndex: 0 }))
      prevResetKey.current = resetKey
    }
  }, [resetKey])

  // Bounds checking - ensure pageIndex doesn't exceed pageCount
  // Handles: deletion of last items on page, filter reducing results
  React.useEffect(() => {
    // Guard against pageCount === 0 (empty state)
    if (pageCount === 0) return
    if (pagination.pageIndex >= pageCount) {
      setPagination(prev => ({ ...prev, pageIndex: Math.max(0, pageCount - 1) }))
    }
  }, [pagination.pageIndex, pageCount])

  const resetToFirstPage = React.useCallback(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [])

  const setPageSize = React.useCallback((size: number) => {
    setPagination({ pageIndex: 0, pageSize: size })
  }, [])

  const goToPage = React.useCallback((page: number) => {
    // Accept 1-based page, convert to 0-based internally
    setPagination(prev => ({ ...prev, pageIndex: Math.max(0, page - 1) }))
  }, [])

  // Memoize return object to prevent unnecessary re-renders in consumers
  return React.useMemo(() => ({
    pagination,
    setPagination,
    pageCount,
    displayPage: pagination.pageIndex + 1,
    resetToFirstPage,
    setPageSize,
    goToPage,
    canPreviousPage: pagination.pageIndex > 0,
    canNextPage: pagination.pageIndex < pageCount - 1,
  }), [pagination, pageCount, resetToFirstPage, setPageSize, goToPage])
}
