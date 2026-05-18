import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, it, expect } from 'vitest'

import { usePaginationState } from '@/hooks/usePaginationState'

describe('usePaginationState', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('initializes with defaults', () => {
    const { result } = renderHook(() => usePaginationState({ totalCount: 100 }))

    expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 20 })
    expect(result.current.pageCount).toBe(5)
    expect(result.current.displayPage).toBe(1)
  })

  it('supports totalCount=0 without pageCount', () => {
    const { result } = renderHook(() => usePaginationState({ totalCount: 0 }))

    expect(result.current.pageCount).toBe(0)
    expect(result.current.canNextPage).toBe(false)
  })

  it('resets to first page when resetKey changes', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => usePaginationState({ totalCount: 100, initialPageIndex: 2, resetKey }),
      { initialProps: { resetKey: 'a' } }
    )

    expect(result.current.pagination.pageIndex).toBe(2)

    rerender({ resetKey: 'b' })
    expect(result.current.pagination.pageIndex).toBe(0)
  })

  it('clamps pageIndex when totalCount decreases', () => {
    const { result, rerender } = renderHook(
      ({ totalCount }) => usePaginationState({ totalCount, initialPageIndex: 3, initialPageSize: 10 }),
      { initialProps: { totalCount: 100 } }
    )

    expect(result.current.pagination.pageIndex).toBe(3)

    rerender({ totalCount: 15 })
    expect(result.current.pagination.pageIndex).toBe(1)
  })

  it('goToPage accepts 1-based input', () => {
    const { result } = renderHook(() => usePaginationState({ totalCount: 100 }))

    act(() => {
      result.current.goToPage(3)
    })

    expect(result.current.pagination.pageIndex).toBe(2)
  })

  it('setPageSize resets pageIndex to 0', () => {
    const { result } = renderHook(() => usePaginationState({ totalCount: 100, initialPageIndex: 2 }))

    act(() => {
      result.current.setPageSize(50)
    })

    expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 50 })
  })

  it('initializes pageSize from pageSizeStorageKey', () => {
    window.localStorage.setItem('pagination:test-table:page-size', '75')

    const { result } = renderHook(() =>
      usePaginationState({
        totalCount: 300,
        initialPageIndex: 2,
        initialPageSize: 20,
        pageSizeStorageKey: 'pagination:test-table:page-size',
      })
    )

    expect(result.current.pagination).toEqual({ pageIndex: 2, pageSize: 75 })
  })

  it('persists pageSize without persisting current page', () => {
    const { result, unmount } = renderHook(() =>
      usePaginationState({
        totalCount: 300,
        pageSizeStorageKey: 'pagination:test-table:page-size',
      })
    )

    act(() => {
      result.current.goToPage(4)
      result.current.setPageSize(50)
    })

    expect(window.localStorage.getItem('pagination:test-table:page-size')).toBe('50')
    expect(window.localStorage.getItem('pagination:test-table:page-index')).toBeNull()

    unmount()

    const nextHook = renderHook(() =>
      usePaginationState({
        totalCount: 300,
        pageSizeStorageKey: 'pagination:test-table:page-size',
      })
    )

    expect(nextHook.result.current.pagination).toEqual({ pageIndex: 0, pageSize: 50 })
  })

  it('normalizes non-finite page sizes before storing them', () => {
    const { result } = renderHook(() =>
      usePaginationState({
        totalCount: 300,
        pageSizeStorageKey: 'pagination:test-table:page-size',
      })
    )

    act(() => {
      result.current.setPageSize(Number.NaN)
    })

    expect(result.current.pagination.pageSize).toBe(1)
    expect(window.localStorage.getItem('pagination:test-table:page-size')).toBe('1')
  })
})
