import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { usePaginationState } from '@/hooks/usePaginationState'

describe('usePaginationState', () => {
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
})
