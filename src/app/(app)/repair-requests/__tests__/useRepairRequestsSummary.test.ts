/**
 * TDD Cycle 3 — RED phase
 * Tests for useRepairRequestsSummary hook.
 *
 * Verifies:
 * - kpiTotal = sum of all status counts
 * - kpiTotal = 0 when statusCounts is undefined
 * - summaryItems includes 'total' + 4 status items
 * - Each item has correct tone
 * - Clicking a status item triggers filter update
 * - Clicking 'total' clears status filter
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Import hook AFTER setup ──────────────────────────────────────
import { useRepairRequestsSummary } from '../_hooks/useRepairRequestsSummary'

// ── Helpers ──────────────────────────────────────────────────────
const mockSetUiFiltersState = vi.fn()
const mockSetUiFilters = vi.fn()

const statusCounts = {
  'Chờ xử lý': 5,
  'Đã duyệt': 3,
  'Hoàn thành': 10,
  'Không HT': 2,
} as const

function createDefaultOptions() {
  return {
    statusCounts: statusCounts as Record<string, number> | undefined,
    uiFilters: { status: [] as string[], dateRange: null as null },
    setUiFiltersState: mockSetUiFiltersState,
    setUiFilters: mockSetUiFilters,
  }
}

// ── Tests ────────────────────────────────────────────────────────
describe('useRepairRequestsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns expected shape', () => {
    const { result } = renderHook(() =>
      useRepairRequestsSummary(createDefaultOptions())
    )

    expect(result.current).toMatchObject({
      kpiTotal: expect.any(Number),
      summaryItems: expect.any(Array),
    })
  })

  it('calculates kpiTotal as sum of all status counts', () => {
    const { result } = renderHook(() =>
      useRepairRequestsSummary(createDefaultOptions())
    )

    // 5 + 3 + 10 + 2 = 20
    expect(result.current.kpiTotal).toBe(20)
  })

  it('returns kpiTotal = 0 when statusCounts is undefined', () => {
    const { result } = renderHook(() =>
      useRepairRequestsSummary({ ...createDefaultOptions(), statusCounts: undefined })
    )

    expect(result.current.kpiTotal).toBe(0)
  })

  it('returns 5 summary items (total + 4 statuses)', () => {
    const { result } = renderHook(() =>
      useRepairRequestsSummary(createDefaultOptions())
    )

    expect(result.current.summaryItems).toHaveLength(5)
    expect(result.current.summaryItems[0].key).toBe('total')
    expect(result.current.summaryItems[0].value).toBe(20)
  })

  it('maps correct tones', () => {
    const { result } = renderHook(() =>
      useRepairRequestsSummary(createDefaultOptions())
    )

    const items = result.current.summaryItems
    expect(items[0].tone).toBe('default') // total
    expect(items[1].tone).toBe('warning') // Chờ xử lý
    expect(items[2].tone).toBe('muted')   // Đã duyệt
    expect(items[3].tone).toBe('success') // Hoàn thành
    expect(items[4].tone).toBe('danger')  // Không HT
  })

  it('clicking total clears status filter', () => {
    const { result } = renderHook(() =>
      useRepairRequestsSummary(createDefaultOptions())
    )

    act(() => {
      result.current.summaryItems[0].onClick!()
    })

    expect(mockSetUiFiltersState).toHaveBeenCalledWith(
      expect.objectContaining({ status: [] })
    )
    expect(mockSetUiFilters).toHaveBeenCalledWith(
      expect.objectContaining({ status: [] })
    )
  })

  it('clicking a status item filters by that status', () => {
    const { result } = renderHook(() =>
      useRepairRequestsSummary(createDefaultOptions())
    )

    // Click 'Đã duyệt' (index 2)
    act(() => {
      result.current.summaryItems[2].onClick!()
    })

    expect(mockSetUiFiltersState).toHaveBeenCalledWith(
      expect.objectContaining({ status: ['Đã duyệt'] })
    )
    expect(mockSetUiFilters).toHaveBeenCalledWith(
      expect.objectContaining({ status: ['Đã duyệt'] })
    )
  })

  it('marks total as active when no status filter', () => {
    const { result } = renderHook(() =>
      useRepairRequestsSummary(createDefaultOptions())
    )

    expect(result.current.summaryItems[0].active).toBe(true)
    expect(result.current.summaryItems[1].active).toBe(false)
  })

  it('marks correct status as active when filter is applied', () => {
    const { result } = renderHook(() =>
      useRepairRequestsSummary({
        ...createDefaultOptions(),
        uiFilters: { status: ['Hoàn thành'], dateRange: null },
      })
    )

    expect(result.current.summaryItems[0].active).toBe(false) // total
    expect(result.current.summaryItems[3].active).toBe(true)  // Hoàn thành
  })
})
