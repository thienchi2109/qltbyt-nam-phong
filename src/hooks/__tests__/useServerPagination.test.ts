/**
 * Tests for useServerPagination — a shared hook wrapping usePaginationState
 * with server-side pagination conveniences (1-based page, resetKey, pageCount).
 */
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { useServerPagination } from '@/hooks/useServerPagination'

describe('useServerPagination', () => {
  it('provides 1-based page number for RPC calls', () => {
    const { result } = renderHook(() =>
      useServerPagination({ totalCount: 100 })
    )

    // pageIndex is 0-based, page is 1-based
    expect(result.current.pagination.pageIndex).toBe(0)
    expect(result.current.page).toBe(1)
  })

  it('updates page when navigating via setPagination', () => {
    const { result } = renderHook(() =>
      useServerPagination({ totalCount: 100 })
    )

    act(() => {
      result.current.setPagination((prev: { pageIndex: number; pageSize: number }) => ({ ...prev, pageIndex: 2 }))
    })

    expect(result.current.page).toBe(3)
    expect(result.current.pagination.pageIndex).toBe(2)
  })

  it('provides pageCount derived from totalCount and pageSize', () => {
    const { result } = renderHook(() =>
      useServerPagination({ totalCount: 55, initialPageSize: 20 })
    )

    expect(result.current.pageCount).toBe(3) // ceil(55/20)
    expect(result.current.pageSize).toBe(20)
  })

  it('auto-resets to page 0 when resetKey changes', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useServerPagination({ totalCount: 100, resetKey }),
      { initialProps: { resetKey: 'search-a' } }
    )

    // Navigate to page 2
    act(() => {
      result.current.setPagination((prev: { pageIndex: number; pageSize: number }) => ({ ...prev, pageIndex: 2 }))
    })
    expect(result.current.page).toBe(3)

    // Change resetKey (e.g., search term changed)
    rerender({ resetKey: 'search-b' })
    expect(result.current.pagination.pageIndex).toBe(0)
    expect(result.current.page).toBe(1)
  })

  it('clamps pageIndex when totalCount decreases', () => {
    const { result, rerender } = renderHook(
      ({ totalCount }) =>
        useServerPagination({ totalCount, initialPageSize: 10 }),
      { initialProps: { totalCount: 50 } }
    )

    // Navigate to page 4 (0-based index 3)
    act(() => {
      result.current.setPagination((prev: { pageIndex: number; pageSize: number }) => ({ ...prev, pageIndex: 3 }))
    })
    expect(result.current.page).toBe(4)

    // Decrease totalCount so page 4 no longer exists
    rerender({ totalCount: 25 })
    // pageCount = ceil(25/10) = 3, so max pageIndex = 2
    expect(result.current.pagination.pageIndex).toBe(2)
    expect(result.current.page).toBe(3)
  })

  it('exposes canPreviousPage and canNextPage correctly', () => {
    const { result } = renderHook(() =>
      useServerPagination({ totalCount: 60, initialPageSize: 20 })
    )

    // Page 1 of 3
    expect(result.current.canPreviousPage).toBe(false)
    expect(result.current.canNextPage).toBe(true)

    // Navigate to last page
    act(() => {
      result.current.setPagination((prev: { pageIndex: number; pageSize: number }) => ({ ...prev, pageIndex: 2 }))
    })

    expect(result.current.canPreviousPage).toBe(true)
    expect(result.current.canNextPage).toBe(false)
  })

  it('defaults to pageSize 20', () => {
    const { result } = renderHook(() =>
      useServerPagination({ totalCount: 100 })
    )

    expect(result.current.pageSize).toBe(20)
  })

  it('resetToFirstPage sets page back to 1', () => {
    const { result } = renderHook(() =>
      useServerPagination({ totalCount: 100 })
    )

    act(() => {
      result.current.setPagination((prev: { pageIndex: number; pageSize: number }) => ({ ...prev, pageIndex: 3 }))
    })
    expect(result.current.page).toBe(4)

    act(() => {
      result.current.resetToFirstPage()
    })
    expect(result.current.page).toBe(1)
  })
})
