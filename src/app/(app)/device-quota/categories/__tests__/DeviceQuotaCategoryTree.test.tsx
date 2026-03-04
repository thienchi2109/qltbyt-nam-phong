import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaCategoryTree } from '../_components/DeviceQuotaCategoryTree'
import { useDeviceQuotaCategoryContext } from '../_hooks/useDeviceQuotaCategoryContext'

vi.mock('../_hooks/useDeviceQuotaCategoryContext', () => ({
  useDeviceQuotaCategoryContext: vi.fn(),
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
    mockUseContext.mockReturnValue({
      categories: [
        { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Nhóm gốc 1', level: 1, so_luong_hien_co: 5, phan_loai: 'A' },
        { id: 2, parent_id: 1, ma_nhom: '01', ten_nhom: 'Nhóm con 1.1', level: 2, so_luong_hien_co: 3, phan_loai: 'A' },
        { id: 3, parent_id: 1, ma_nhom: '02', ten_nhom: 'Nhóm con 1.2', level: 2, so_luong_hien_co: 2, phan_loai: 'B' },
      ],
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

    // Root header rendered
    expect(screen.getByText('Nhóm gốc 1')).toBeInTheDocument()
    // Children rendered
    expect(screen.getByText('Nhóm con 1.1')).toBeInTheDocument()
    expect(screen.getByText('Nhóm con 1.2')).toBeInTheDocument()
    // Classification badges
    expect(screen.getAllByText('Loại A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Loại B')).toBeInTheDocument()
  })

  it('uses semantic list markup', () => {
    mockUseContext.mockReturnValue({
      categories: [
        { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Nhóm 1', level: 1, so_luong_hien_co: 0 },
      ],
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
    mockUseContext.mockReturnValue({
      categories: [
        { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Nhóm 1', level: 1, so_luong_hien_co: 0 },
      ],
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
    mockUseContext.mockReturnValue({
      categories: [
        { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Root', level: 1, so_luong_hien_co: 0, so_luong_toi_da: null },
        { id: 2, parent_id: 1, ma_nhom: '01', ten_nhom: 'Child', level: 2, so_luong_hien_co: 3, so_luong_toi_da: 9 },
      ],
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

    // Child row should show fraction 3/9
    expect(screen.getByText('3/9')).toBeInTheDocument()
  })

  it('renders aggregated quota progress bar on group header', () => {
    mockUseContext.mockReturnValue({
      categories: [
        { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Root', level: 1, so_luong_hien_co: 0, so_luong_toi_da: 5 },
        { id: 2, parent_id: 1, ma_nhom: '01', ten_nhom: 'Child A', level: 2, so_luong_hien_co: 3, so_luong_toi_da: 9 },
        { id: 3, parent_id: 1, ma_nhom: '02', ten_nhom: 'Child B', level: 2, so_luong_hien_co: 2, so_luong_toi_da: 6 },
      ],
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

    // Group header: total equipment = 0+3+2=5, total quota = 5+9+6=20
    expect(screen.getByText('5/20')).toBeInTheDocument()
  })
})
