/**
 * Shared hook for server-side paginated queries.
 *
 * Wraps usePaginationState with convenience getters:
 * - `page` (1-based, ready for p_page RPC arg)
 * - `pageSize` (ready for p_page_size RPC arg)
 *
 * Consumers still get the full usePaginationState return for
 * DataTablePagination compatibility (0-based pageIndex, setPagination, etc.).
 */
import * as React from 'react'
import { usePaginationState } from '@/hooks/usePaginationState'

export interface UseServerPaginationOptions {
  totalCount: number
  initialPageSize?: number
  resetKey?: string | number | null
}

export interface UseServerPaginationReturn {
  /** 1-based page number, ready for RPC `p_page` arg */
  page: number
  /** Current page size, ready for RPC `p_page_size` arg */
  pageSize: number

  /** 0-based pagination state for DataTablePagination / TanStack Table */
  pagination: { pageIndex: number; pageSize: number }
  setPagination: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>

  /** Total number of pages */
  pageCount: number

  canPreviousPage: boolean
  canNextPage: boolean
  resetToFirstPage: () => void
}

export function useServerPagination({
  totalCount,
  initialPageSize = 20,
  resetKey,
}: UseServerPaginationOptions): UseServerPaginationReturn {
  const state = usePaginationState({
    totalCount,
    initialPageSize,
    resetKey: resetKey ?? undefined,
  })

  return React.useMemo(() => ({
    // 1-based accessors for RPC calls
    page: state.pagination.pageIndex + 1,
    pageSize: state.pagination.pageSize,

    // Pass-through for table/UI compatibility
    pagination: state.pagination,
    setPagination: state.setPagination,
    pageCount: state.pageCount,
    canPreviousPage: state.canPreviousPage,
    canNextPage: state.canNextPage,
    resetToFirstPage: state.resetToFirstPage,
  }), [
    state.pagination,
    state.setPagination,
    state.pageCount,
    state.canPreviousPage,
    state.canNextPage,
    state.resetToFirstPage,
  ])
}
