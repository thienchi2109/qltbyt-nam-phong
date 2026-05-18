import * as React from "react"
import type { UsePaginationStateOptions, UsePaginationStateReturn } from "@/components/shared/DataTablePagination/types"
import { normalizePageSize, readPageSizeFromStorage, writePageSizeToStorage } from "@/lib/page-size-storage"

type PaginationState = { pageIndex: number; pageSize: number }

export function usePaginationState({
  initialPageSize = 20,
  initialPageIndex = 0,
  totalCount,
  pageSizeStorageKey,
  resetKey,
}: UsePaginationStateOptions): UsePaginationStateReturn {
  const [pagination, setPagination] = React.useState(() => ({
    pageIndex: Math.max(0, initialPageIndex),
    pageSize: readPageSizeFromStorage(pageSizeStorageKey, initialPageSize),
  }))

  const pageCount = Math.max(0, Math.ceil(totalCount / pagination.pageSize))

  // Auto-reset to first page when resetKey changes (render-time, not useEffect).
  // Must be synchronous so pagination resets in the SAME render where the
  // query key changes — prevents useQuery from firing with stale page number.
  // See: rerender-derived-state-no-effect (Vercel React best practices)
  const prevResetKey = React.useRef(resetKey)
  if (resetKey !== prevResetKey.current) {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
    prevResetKey.current = resetKey
  }

  // Bounds checking - ensure pageIndex doesn't exceed pageCount
  // Handles: deletion of last items on page, filter reducing results, empty state
  React.useEffect(() => {
    if (pagination.pageIndex >= pageCount) {
      setPagination(prev => ({ ...prev, pageIndex: Math.max(0, pageCount - 1) }))
    }
  }, [pagination.pageIndex, pageCount])

  const setPersistedPagination = React.useCallback<React.Dispatch<React.SetStateAction<PaginationState>>>((nextPagination) => {
    setPagination(prev => {
      const resolvedPagination = typeof nextPagination === "function"
        ? nextPagination(prev)
        : nextPagination
      const safePagination = {
        pageIndex: Math.max(0, resolvedPagination.pageIndex),
        pageSize: normalizePageSize(resolvedPagination.pageSize),
      }

      if (safePagination.pageSize !== prev.pageSize) {
        writePageSizeToStorage(pageSizeStorageKey, safePagination.pageSize)
      }

      return safePagination
    })
  }, [pageSizeStorageKey])

  const resetToFirstPage = React.useCallback(() => {
    setPersistedPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [setPersistedPagination])

  const setPageSize = React.useCallback((size: number) => {
    setPersistedPagination({ pageIndex: 0, pageSize: normalizePageSize(size) })
  }, [setPersistedPagination])

  const goToPage = React.useCallback((page: number) => {
    // Accept 1-based page, convert to 0-based internally
    setPersistedPagination(prev => ({ ...prev, pageIndex: Math.max(0, page - 1) }))
  }, [setPersistedPagination])

  // Memoize return object to prevent unnecessary re-renders in consumers
  return React.useMemo(() => ({
    pagination,
    setPagination: setPersistedPagination,
    pageCount,
    displayPage: pagination.pageIndex + 1,
    resetToFirstPage,
    setPageSize,
    goToPage,
    canPreviousPage: pagination.pageIndex > 0,
    canNextPage: pagination.pageIndex < pageCount - 1,
  }), [pagination, setPersistedPagination, pageCount, resetToFirstPage, setPageSize, goToPage])
}
