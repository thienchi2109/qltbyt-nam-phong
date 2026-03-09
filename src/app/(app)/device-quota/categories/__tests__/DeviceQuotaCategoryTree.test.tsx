import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaCategoryTree } from '../_components/DeviceQuotaCategoryTree'
import { useDeviceQuotaCategoryContext } from '../_hooks/useDeviceQuotaCategoryContext'

vi.mock('../_hooks/useDeviceQuotaCategoryContext', () => ({
  useDeviceQuotaCategoryContext: vi.fn(),
}))

// Mock the assigned-equipment panel to isolate tree tests from RPC fetching
vi.mock('../_components/DeviceQuotaCategoryAssignedEquipment', () => ({
  DeviceQuotaCategoryAssignedEquipment: ({ nhomId }: { nhomId: number }) => (
    <div data-testid={`assigned-equipment-panel-${nhomId}`}>Equipment panel</div>
  ),
}))

const mockUseContext = vi.mocked(useDeviceQuotaCategoryContext)
type MockCategoryContextValue = ReturnType<typeof useDeviceQuotaCategoryContext>

const basePagination = {
  pagination: { pageIndex: 0, pageSize: 20 },
  setPagination: vi.fn(),
  pageCount: 0,
  displayPage: 1,
  resetToFirstPage: vi.fn(),
  setPageSize: vi.fn(),
  goToPage: vi.fn(),
  canPreviousPage: false,
  canNextPage: false,
}

describe('DeviceQuotaCategoryTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state and triggers create dialog', () => {
    const openCreateDialog = vi.fn()

    mockUseContext.mockReturnValue({
      categories: [],
      allCategories: [],
      donViId: 1,
      isLoading: false,
      totalRootCount: 0,
      searchTerm: '',
      pagination: basePagination,
      openCreateDialog,
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByText('Chưa có danh mục nào')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tạo danh mục' }))
    expect(openCreateDialog).toHaveBeenCalledTimes(1)
  })

  it('shows search empty state when searching', () => {
    mockUseContext.mockReturnValue({
      categories: [],
      allCategories: [],
      donViId: 1,
      isLoading: false,
      totalRootCount: 0,
      searchTerm: 'xyz',
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByText('Không tìm thấy danh mục')).toBeInTheDocument()
  })

  it('renders category groups with root headers', () => {
    const categories = [
      { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Nhóm gốc 1', level: 1, so_luong_hien_co: 5, phan_loai: 'A' },
      { id: 2, parent_id: 1, ma_nhom: '01', ten_nhom: 'Nhóm con 1.1', level: 2, so_luong_hien_co: 3, phan_loai: 'A' },
      { id: 3, parent_id: 1, ma_nhom: '02', ten_nhom: 'Nhóm con 1.2', level: 2, so_luong_hien_co: 2, phan_loai: 'B' },
    ]
    mockUseContext.mockReturnValue({
      categories,
      allCategories: categories,
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: '',
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByText('Nhóm gốc 1')).toBeInTheDocument()
    expect(screen.getByText('Nhóm con 1.1')).toBeInTheDocument()
    expect(screen.getByText('Nhóm con 1.2')).toBeInTheDocument()
    expect(screen.getAllByText('Loại A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Loại B')).toBeInTheDocument()
  })

  it('uses semantic list markup', () => {
    const categories = [
      { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Nhóm 1', level: 1, so_luong_hien_co: 0 },
    ]
    mockUseContext.mockReturnValue({
      categories,
      allCategories: categories,
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: '',
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByRole('list', { name: 'Tiêu chuẩn, định mức thiết bị' })).toBeInTheDocument()
  })

  it('shows column header when data exists', () => {
    const categories = [
      { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Nhóm 1', level: 1, so_luong_hien_co: 0 },
    ]
    mockUseContext.mockReturnValue({
      categories,
      allCategories: categories,
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: '',
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByText('Phân loại')).toBeInTheDocument()
    expect(screen.getByText('Tình trạng sử dụng')).toBeInTheDocument()
  })

  it('hides column header when no data', () => {
    mockUseContext.mockReturnValue({
      categories: [],
      allCategories: [],
      donViId: 1,
      isLoading: false,
      totalRootCount: 0,
      searchTerm: '',
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.queryByText('Phân loại')).not.toBeInTheDocument()
    expect(screen.queryByText('Tình trạng sử dụng')).not.toBeInTheDocument()
  })

  it('renders quota progress bars for child rows', () => {
    const categories = [
      { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Root', level: 1, so_luong_hien_co: 0, so_luong_toi_da: null },
      { id: 2, parent_id: 1, ma_nhom: '01', ten_nhom: 'Child', level: 2, so_luong_hien_co: 3, so_luong_toi_da: 9 },
    ]
    mockUseContext.mockReturnValue({
      categories,
      allCategories: categories,
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: '',
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByText('3/9')).toBeInTheDocument()
  })

  it('renders aggregated quota progress bar on group header', () => {
    const categories = [
      { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Root', level: 1, so_luong_hien_co: 0, so_luong_toi_da: 5 },
      { id: 2, parent_id: 1, ma_nhom: '01', ten_nhom: 'Child A', level: 2, so_luong_hien_co: 3, so_luong_toi_da: 9 },
      { id: 3, parent_id: 1, ma_nhom: '02', ten_nhom: 'Child B', level: 2, so_luong_hien_co: 2, so_luong_toi_da: 6 },
    ]
    mockUseContext.mockReturnValue({
      categories,
      allCategories: categories,
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: '',
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    // Group header: aggregated total = 0+3+2=5, total quota = 5+9+6=20
    expect(screen.getByText('5/20')).toBeInTheDocument()
  })

  // ============================================
  // Aggregated counts + expansion behavior
  // ============================================

  const threeLevelTree = [
    { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Root', level: 1, so_luong_hien_co: 0, so_luong_toi_da: null },
    { id: 2, parent_id: 1, ma_nhom: '01', ten_nhom: 'Intermediate', level: 2, so_luong_hien_co: 0, so_luong_toi_da: 10 },
    { id: 4, parent_id: 2, ma_nhom: '01.01', ten_nhom: 'Leaf A', level: 3, so_luong_hien_co: 2, so_luong_toi_da: 5 },
    { id: 5, parent_id: 2, ma_nhom: '01.02', ten_nhom: 'Leaf B', level: 3, so_luong_hien_co: 3, so_luong_toi_da: 5 },
    { id: 3, parent_id: 1, ma_nhom: '02', ten_nhom: 'Empty Intermediate', level: 2, so_luong_hien_co: 0, so_luong_toi_da: null },
    { id: 6, parent_id: 3, ma_nhom: '02.01', ten_nhom: 'Empty Leaf', level: 3, so_luong_hien_co: 0, so_luong_toi_da: null },
  ]

  function renderWithThreeLevelTree() {
    mockUseContext.mockReturnValue({
      categories: threeLevelTree,
      allCategories: threeLevelTree,
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: '',
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    return render(<DeviceQuotaCategoryTree />)
  }

  it('shows aggregated count for intermediate node from descendant leaves', () => {
    renderWithThreeLevelTree()

    // Intermediate node (id:2): raw count=0, but leaves 4+5 = 2+3=5
    // Should show "5/10" (aggregated current / quota)
    expect(screen.getByText('5/10')).toBeInTheDocument()
  })

  it('root header uses aggregated total without double-counting', () => {
    renderWithThreeLevelTree()

    // Root (id:1): aggregated = 5, so_luong_toi_da=null → "5/–"
    expect(screen.getByText('5/–')).toBeInTheDocument()
  })

  it('leaf with equipment shows expand button with aria-expanded', () => {
    renderWithThreeLevelTree()

    const expandButton = screen.getByRole('button', { name: /Leaf A/i })
    expect(expandButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('clicking expand button opens assignment panel', () => {
    renderWithThreeLevelTree()

    const expandButton = screen.getByRole('button', { name: /Leaf A/i })

    fireEvent.click(expandButton)

    expect(expandButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('assigned-equipment-panel-4')).toBeInTheDocument()
  })

  it('clicking expand button again collapses the panel', () => {
    renderWithThreeLevelTree()

    const expandButton = screen.getByRole('button', { name: /Leaf A/i })

    // Open
    fireEvent.click(expandButton)
    expect(expandButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('assigned-equipment-panel-4')).toBeInTheDocument()

    // Collapse
    fireEvent.click(expandButton)
    expect(expandButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('assigned-equipment-panel-4')).not.toBeInTheDocument()
  })

  it('intermediate node has no expand button', () => {
    renderWithThreeLevelTree()

    expect(screen.queryByRole('button', { name: /Intermediate/i })).not.toBeInTheDocument()
  })

  it('zero-count leaf has no expand button', () => {
    renderWithThreeLevelTree()

    expect(screen.queryByRole('button', { name: /Empty Leaf/i })).not.toBeInTheDocument()
  })

  it('displays full-tree aggregated totals even when categories is search-filtered', () => {
    // Simulate search: only root and one intermediate are visible,
    // but allCategories still contains the full tree
    const filteredCategories = [
      threeLevelTree[0], // Root (id:1)
      threeLevelTree[1], // Intermediate (id:2)
    ]

    mockUseContext.mockReturnValue({
      categories: filteredCategories,
      allCategories: threeLevelTree, // full tree with all leaves
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: 'Intermediate',
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    // Even though leaves are not in the visible categories,
    // the intermediate node should still show aggregated count from full tree
    expect(screen.getByText('5/10')).toBeInTheDocument()
  })
})
