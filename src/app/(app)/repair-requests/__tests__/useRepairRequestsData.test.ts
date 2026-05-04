/**
 * TDD Cycle 1 — RED phase
 * Tests for useRepairRequestsData hook.
 *
 * Verifies:
 * - Hook returns expected shape (requests, pagination, KPI counts, overdue summary)
 * - repair_request_list query enabled = !!user && shouldFetchData
 * - repair_request_status_counts query enabled = !!user (always for auth user)
 * - repair_request_status_counts also carries overdue summary and ignores pagination
 * - totalRequests syncs from query result
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Hoisted mocks ─────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}))

// Track useQuery calls to inspect queryKey and enabled
let capturedQueries: Array<{ queryKey: unknown[]; enabled: boolean }> = []

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: unknown[]; enabled: boolean }) => {
    capturedQueries.push({ queryKey: options.queryKey, enabled: options.enabled })
    const key = options.queryKey[0] as string

    if (key === 'repair_request_list') {
      return {
        data: options.enabled
          ? { data: [{ id: 1 }], total: 42, page: 1, pageSize: 20 }
          : undefined,
        isLoading: false,
        isFetching: false,
        refetch: vi.fn(),
      }
    }

    if (key === 'repair_request_status_counts') {
      return {
        data: options.enabled
          ? {
              counts: { 'Chờ xử lý': 5, 'Đã duyệt': 3, 'Hoàn thành': 10, 'Không HT': 2 },
              overdue_summary: {
                total: 5,
                overdue: 2,
                due_today: 1,
                due_soon: 2,
                items: [{ id: 99, days_difference: -1 }],
              },
            }
          : undefined,
        isLoading: false,
      }
    }

    return { data: undefined, isLoading: false }
  },
}))

vi.mock('@/hooks/useServerPagination', () => ({
  useServerPagination: ({ totalCount }: { totalCount: number }) => ({
    page: 1,
    pageSize: 20,
    pagination: { pageIndex: 0, pageSize: 20 },
    setPagination: vi.fn(),
    pageCount: Math.ceil(totalCount / 20),
    canPreviousPage: false,
    canNextPage: totalCount > 20,
    resetToFirstPage: vi.fn(),
  }),
}))

vi.mock('@/lib/rpc-client', () => ({
  callRpc: vi.fn(),
}))

// ── Import hook AFTER mocks ───────────────────────────────────────
import { useRepairRequestsData } from '../_hooks/useRepairRequestsData'

// ── Helpers ───────────────────────────────────────────────────────
const defaultArgs = {
  debouncedSearch: '',
  uiFilters: { status: [] as string[], dateRange: null as null },
  selectedFacilityId: null as number | null,
  effectiveTenantKey: 'unit-1' as string | number | null,
  userRole: 'to_qltb' as string | undefined,
  userDiaBanId: null as string | number | null | undefined,
  shouldFetchData: true,
  hasUser: true,
}

// ── Tests ─────────────────────────────────────────────────────────
describe('useRepairRequestsData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedQueries = []
  })

  it('returns expected shape', () => {
    const { result } = renderHook(() => useRepairRequestsData(defaultArgs))

    expect(result.current).toMatchObject({
      requests: expect.any(Array),
      isLoading: expect.any(Boolean),
      isFetching: expect.any(Boolean),
      refetchRequests: expect.any(Function),
      statusCounts: expect.objectContaining({
        'Chờ xử lý': 5,
      }),
      statusCountsLoading: expect.any(Boolean),
      overdueSummary: expect.objectContaining({
        total: 5,
        overdue: 2,
      }),
      overdueLoading: expect.any(Boolean),
      totalRequests: expect.any(Number),
      repairPagination: expect.objectContaining({
        page: expect.any(Number),
        pageSize: expect.any(Number),
      }),
    })
  })

  it('enables list query when user exists and shouldFetchData is true', () => {
    renderHook(() => useRepairRequestsData(defaultArgs))

    const listCall = capturedQueries.find(
      (c) => (c.queryKey[0] as string) === 'repair_request_list'
    )
    expect(listCall).toBeDefined()
    expect(listCall!.enabled).toBe(true)
  })

  it('disables list query when shouldFetchData is false', () => {
    renderHook(() =>
      useRepairRequestsData({ ...defaultArgs, shouldFetchData: false })
    )

    const listCall = capturedQueries.find(
      (c) => (c.queryKey[0] as string) === 'repair_request_list'
    )
    expect(listCall).toBeDefined()
    expect(listCall!.enabled).toBe(false)
  })

  it('disables list query when hasUser is false', () => {
    renderHook(() =>
      useRepairRequestsData({ ...defaultArgs, hasUser: false })
    )

    const listCall = capturedQueries.find(
      (c) => (c.queryKey[0] as string) === 'repair_request_list'
    )
    expect(listCall).toBeDefined()
    expect(listCall!.enabled).toBe(false)
  })

  it('enables status counts query when user is authenticated (regardless of shouldFetchData)', () => {
    renderHook(() =>
      useRepairRequestsData({ ...defaultArgs, shouldFetchData: false })
    )

    const countsCall = capturedQueries.find(
      (c) => (c.queryKey[0] as string) === 'repair_request_status_counts'
    )
    expect(countsCall).toBeDefined()
    expect(countsCall!.enabled).toBe(true)
  })

  it('exposes overdue summary from the status counts payload', () => {
    const { result } = renderHook(() => useRepairRequestsData(defaultArgs))
    expect(result.current.overdueSummary).toMatchObject({
      total: 5,
      overdue: 2,
    })
  })

  it('disables status counts query when no user', () => {
    renderHook(() =>
      useRepairRequestsData({ ...defaultArgs, hasUser: false })
    )

    const countsCall = capturedQueries.find(
      (c) => (c.queryKey[0] as string) === 'repair_request_status_counts'
    )
    expect(countsCall).toBeDefined()
    expect(countsCall!.enabled).toBe(false)
  })

  it('syncs totalRequests from query result', () => {
    const { result } = renderHook(() => useRepairRequestsData(defaultArgs))

    // Query returns total: 42
    expect(result.current.totalRequests).toBe(42)
  })

  it('extracts requests array from query response', () => {
    const { result } = renderHook(() => useRepairRequestsData(defaultArgs))

    expect(result.current.requests).toEqual([{ id: 1 }])
  })

  it('keeps pagination out of the status counts query key', () => {
    renderHook(() => useRepairRequestsData(defaultArgs))

    const countsCall = capturedQueries.find(
      (c) => (c.queryKey[0] as string) === 'repair_request_status_counts'
    )
    expect(countsCall).toBeDefined()

    const params = countsCall!.queryKey[1] as Record<string, unknown>
    expect(params.page).toBeUndefined()
    expect(params.pageSize).toBeUndefined()
    expect(params.facilityId).toBeNull()
  })
})
