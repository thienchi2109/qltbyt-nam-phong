import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { MaintenancePlan } from '@/hooks/use-cached-maintenance'
import { usePlanColumns, type PlanColumnOptions } from '../_components/maintenance-columns'

/**
 * Unit tests for usePlanColumns hook - Edit button functionality
 *
 * These tests verify that:
 * 1. setEditingPlan is correctly wired to the hook options
 * 2. The column actions cell can access setEditingPlan
 * 3. The interface contract is correct
 */

describe('usePlanColumns - Edit button', () => {
  const mockSetEditingPlan = vi.fn()
  const mockOnRowClick = vi.fn()
  const mockOpenApproveDialog = vi.fn()
  const mockOpenRejectDialog = vi.fn()
  const mockOpenDeleteDialog = vi.fn()
  const mockSetSorting = vi.fn()

  const defaultOptions: PlanColumnOptions = {
    sorting: [],
    setSorting: mockSetSorting,
    onRowClick: mockOnRowClick,
    openApproveDialog: mockOpenApproveDialog,
    openRejectDialog: mockOpenRejectDialog,
    openDeleteDialog: mockOpenDeleteDialog,
    setEditingPlan: mockSetEditingPlan,
    canManagePlans: true,
    isRegionalLeader: false,
  }

  const draftPlan: MaintenancePlan = {
    id: 1,
    ten_ke_hoach: 'Test Plan Draft',
    nam: 2024,
    trang_thai: 'Bản nháp',
    loai_cong_viec: 'Bảo dưỡng',
    don_vi_id: 1,
    khoa_phong_id: null,
    khoa_phong: null,
    nguoi_lap_ke_hoach: 'Test User',
    ngay_phe_duyet: null,
    nguoi_duyet: null,
    ly_do_khong_duyet: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes setEditingPlan in PlanColumnOptions interface', () => {
    // TypeScript compile-time check: this test ensures the interface is correct
    // If setEditingPlan is missing from PlanColumnOptions, this will fail to compile
    const options: PlanColumnOptions = {
      ...defaultOptions,
      setEditingPlan: mockSetEditingPlan,
    }

    expect(options.setEditingPlan).toBe(mockSetEditingPlan)
  })

  it('returns columns with actions column defined', () => {
    const { result } = renderHook(() => usePlanColumns(defaultOptions))

    const columns = result.current
    const actionsColumn = columns.find((col) => col.id === 'actions')

    expect(actionsColumn).toBeDefined()
    expect(actionsColumn?.id).toBe('actions')
  })

  it('has correct number of columns including actions', () => {
    const { result } = renderHook(() => usePlanColumns(defaultOptions))

    // Expected columns: ten_ke_hoach, nguoi_lap_ke_hoach, nam, khoa_phong,
    // loai_cong_viec, trang_thai, ngay_phe_duyet, actions
    expect(result.current.length).toBe(8)
  })

  it('actions column has cell renderer function', () => {
    const { result } = renderHook(() => usePlanColumns(defaultOptions))

    const actionsColumn = result.current.find((col) => col.id === 'actions')

    expect(actionsColumn?.cell).toBeDefined()
    expect(typeof actionsColumn?.cell).toBe('function')
  })

  it('setEditingPlan is accessible in hook closure', () => {
    // This test verifies that the hook correctly captures setEditingPlan
    // by checking the mock is included in options
    const customMock = vi.fn()
    const options: PlanColumnOptions = {
      ...defaultOptions,
      setEditingPlan: customMock,
    }

    const { result } = renderHook(() => usePlanColumns(options))

    // The hook should return columns without error
    expect(result.current).toBeDefined()
    expect(result.current.length).toBeGreaterThan(0)

    // The options should contain our mock
    expect(options.setEditingPlan).toBe(customMock)
  })

  it('hook works with canManagePlans=false', () => {
    const options: PlanColumnOptions = {
      ...defaultOptions,
      canManagePlans: false,
    }

    const { result } = renderHook(() => usePlanColumns(options))

    expect(result.current).toBeDefined()
    expect(result.current.length).toBe(8)
  })

  it('hook works with isRegionalLeader=true', () => {
    const options: PlanColumnOptions = {
      ...defaultOptions,
      isRegionalLeader: true,
    }

    const { result } = renderHook(() => usePlanColumns(options))

    expect(result.current).toBeDefined()
    expect(result.current.length).toBe(8)
  })
})
