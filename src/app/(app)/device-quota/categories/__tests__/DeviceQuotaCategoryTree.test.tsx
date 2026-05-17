import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { DeviceQuotaCategoryTree } from '../_components/DeviceQuotaCategoryTree'
import { useDeviceQuotaCategoryContext } from '../_hooks/useDeviceQuotaCategoryContext'

vi.mock('../_hooks/useDeviceQuotaCategoryContext', () => ({
  useDeviceQuotaCategoryContext: vi.fn(),
}))

// Mock the assigned-equipment panel to isolate tree tests from RPC fetching
vi.mock('../_components/DeviceQuotaCategoryAssignedEquipment', () => ({
  DeviceQuotaCategoryAssignedEquipment: ({
    nhomId,
    variant,
  }: {
    nhomId: number
    variant?: string
  }) => (
    <div data-testid={`assigned-equipment-panel-${nhomId}`} data-variant={variant}>
      Equipment panel
    </div>
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

    const navPane = screen.getByTestId('device-quota-category-nav-pane')
    expect(within(navPane).getByText('Nhóm gốc 1')).toBeInTheDocument()
    expect(within(navPane).getByText('Nhóm con 1.1')).toBeInTheDocument()
    expect(within(navPane).getByText('Nhóm con 1.2')).toBeInTheDocument()
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

  it('renders split navigation and detail panes with a 40:60 layout', () => {
    const categories = [
      { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Root', level: 1, so_luong_hien_co: 0, so_luong_toi_da: null },
      { id: 2, parent_id: 1, ma_nhom: '01', ten_nhom: 'Leaf With Equipment', level: 2, so_luong_hien_co: 3, so_luong_toi_da: 9, phan_loai: 'A' },
      { id: 3, parent_id: 1, ma_nhom: '02', ten_nhom: 'Empty Leaf', level: 2, so_luong_hien_co: 0, so_luong_toi_da: 4, phan_loai: 'B' },
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

    expect(screen.getByTestId('device-quota-split-pane')).toHaveClass(
      'lg:grid-cols-[minmax(320px,40%)_minmax(0,60%)]'
    )
    expect(screen.getByTestId('device-quota-category-nav-pane')).toBeInTheDocument()
    expect(screen.getByTestId('device-quota-category-detail-pane')).toBeInTheDocument()
  })

  it('selects the first visible leaf with assigned equipment by default', () => {
    const categories = [
      { id: 1, parent_id: null, ma_nhom: 'I', ten_nhom: 'Root', level: 1, so_luong_hien_co: 0, so_luong_toi_da: null },
      { id: 2, parent_id: 1, ma_nhom: '01', ten_nhom: 'Empty Leaf', level: 2, so_luong_hien_co: 0, so_luong_toi_da: 4 },
      { id: 3, parent_id: 1, ma_nhom: '02', ten_nhom: 'Leaf With Equipment', level: 2, so_luong_hien_co: 2, so_luong_toi_da: 5, phan_loai: 'A' },
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

    const detailPane = screen.getByTestId('device-quota-category-detail-pane')
    expect(within(detailPane).getByText('Leaf With Equipment')).toBeInTheDocument()
    expect(within(detailPane).getByTestId('assigned-equipment-panel-3')).toHaveAttribute(
      'data-variant',
      'panel'
    )
  })

  it('clamps long category names while keeping the full name accessible', () => {
    const longName = 'Máy cộng hưởng từ toàn thân cấu hình cao phục vụ chẩn đoán hình ảnh chuyên sâu tại nhiều khoa phòng'
    const categories = [
      { id: 1, parent_id: null, ma_nhom: 'MRI', ten_nhom: longName, level: 1, so_luong_hien_co: 1, so_luong_toi_da: null, mo_ta: 'Mô tả rất dài cần được giới hạn trong vùng đọc chi tiết để không đẩy bảng thiết bị xuống quá xa khỏi màn hình.' },
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

    const row = screen.getByRole('button', { name: new RegExp(`Chọn danh mục MRI: ${longName}`) })
    expect(row).toHaveAttribute('title', longName)
    expect(within(row).getByText(longName)).toHaveClass('line-clamp-2')

    const detailPane = screen.getByTestId('device-quota-category-detail-pane')
    expect(within(detailPane).getByRole('heading', { name: longName })).toHaveClass('line-clamp-3')
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

    expect(screen.getAllByText('3/9').length).toBeGreaterThanOrEqual(1)
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
    { id: 6, parent_id: 3, ma_nhom: '02.01', ten_nhom: 'Empty Leaf A', level: 3, so_luong_hien_co: 0, so_luong_toi_da: 4 },
    { id: 7, parent_id: 3, ma_nhom: '02.02', ten_nhom: 'Empty Leaf B', level: 3, so_luong_hien_co: 0, so_luong_toi_da: 4 },
    { id: 8, parent_id: 3, ma_nhom: '02.03', ten_nhom: 'Empty Leaf C', level: 3, so_luong_hien_co: 0, so_luong_toi_da: 3 },
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

    // Intermediate node (id:2): aggregated count = 0+2+3=5
    // Aggregated quota = own(10) + LeafA(5) + LeafB(5) = 20
    expect(screen.getByText('5/20')).toBeInTheDocument()
  })

  it('root header rolls up known child quotas when the root has no direct quota', () => {
    renderWithThreeLevelTree()

    // Root (id:1): equipment = 5, known descendant quota = 10+5+5+4+4+3.
    expect(screen.getAllByText('5/31').length).toBeGreaterThanOrEqual(1)
  })

  it('root header preserves unknown quota when direct root equipment has no direct quota', () => {
    const categories = [
      { id: 22, parent_id: null, ma_nhom: '02', ten_nhom: 'CT Scanner', level: 1, so_luong_hien_co: 2, so_luong_toi_da: null },
      { id: 299, parent_id: 22, ma_nhom: '02.01', ten_nhom: 'CT < 64', level: 2, so_luong_hien_co: 0, so_luong_toi_da: 4 },
      { id: 300, parent_id: 22, ma_nhom: '02.02', ten_nhom: 'CT 64-128', level: 2, so_luong_hien_co: 0, so_luong_toi_da: 4 },
      { id: 301, parent_id: 22, ma_nhom: '02.03', ten_nhom: 'CT >= 256', level: 2, so_luong_hien_co: 0, so_luong_toi_da: 3 },
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

    expect(screen.getByText('2/–')).toBeInTheDocument()
  })

  it('category rows are selectable and expose quota/classification context', () => {
    renderWithThreeLevelTree()

    const row = screen.getByRole('button', { name: /Chọn danh mục 01\.01: Leaf A/i })
    expect(row).toHaveAttribute('aria-pressed', 'true')
    expect(row).toHaveAttribute('title', 'Leaf A')
    expect(row).toHaveTextContent('2/5')
  })

  it('clicking a category row updates the detail pane without rendering equipment inline', () => {
    renderWithThreeLevelTree()

    const navPane = screen.getByTestId('device-quota-category-nav-pane')
    const detailPane = screen.getByTestId('device-quota-category-detail-pane')
    const row = screen.getByRole('button', { name: /Chọn danh mục 01\.02: Leaf B/i })

    fireEvent.click(row)

    expect(row).toHaveAttribute('aria-pressed', 'true')
    expect(within(detailPane).getByText('Leaf B')).toBeInTheDocument()
    expect(within(detailPane).getByTestId('assigned-equipment-panel-5')).toBeInTheDocument()
    expect(within(navPane).queryByTestId('assigned-equipment-panel-5')).not.toBeInTheDocument()
  })

  it('does not select a row when keyboard interaction targets its action menu', () => {
    renderWithThreeLevelTree()

    const leafBRow = screen.getByRole('button', { name: /Chọn danh mục 01\.02: Leaf B/i })
    const leafBMenu = within(leafBRow).getByRole('button', { name: /Mở menu danh mục Leaf B/i })

    fireEvent.keyDown(leafBMenu, { key: 'Enter' })

    expect(leafBRow).toHaveAttribute('aria-pressed', 'false')
  })

  it('selects a focused category row with Enter or Space', () => {
    renderWithThreeLevelTree()

    const detailPane = screen.getByTestId('device-quota-category-detail-pane')
    const emptyLeaf = screen.getByRole('button', { name: /Chọn danh mục 02\.01: Empty Leaf A/i })
    const emptyLeafB = screen.getByRole('button', { name: /Chọn danh mục 02\.02: Empty Leaf B/i })

    fireEvent.keyDown(emptyLeaf, { key: 'Enter' })
    expect(emptyLeaf).toHaveAttribute('aria-pressed', 'true')
    expect(within(detailPane).getByText('Empty Leaf A')).toBeInTheDocument()

    fireEvent.keyDown(emptyLeafB, { key: ' ' })
    expect(emptyLeafB).toHaveAttribute('aria-pressed', 'true')
    expect(within(detailPane).getByText('Empty Leaf B')).toBeInTheDocument()
  })

  it('intermediate node is selectable but does not render inline equipment', () => {
    renderWithThreeLevelTree()

    const navPane = screen.getByTestId('device-quota-category-nav-pane')
    const detailPane = screen.getByTestId('device-quota-category-detail-pane')
    const intermediate = screen.getByRole('button', { name: /Chọn danh mục 01: Intermediate/i })

    fireEvent.click(intermediate)

    expect(intermediate).toHaveAttribute('aria-pressed', 'true')
    expect(within(navPane).queryByTestId(/assigned-equipment-panel-/)).not.toBeInTheDocument()
    expect(within(detailPane).queryByTestId('assigned-equipment-panel-2')).not.toBeInTheDocument()
    expect(within(detailPane).getByText('Chọn một danh mục con để xem danh sách thiết bị được gán')).toBeInTheDocument()
  })

  it('zero-count leaf is still selectable for scanning its empty assignment state', () => {
    renderWithThreeLevelTree()

    expect(screen.getByRole('button', { name: /Chọn danh mục 02\.01: Empty Leaf A/i })).toBeInTheDocument()
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
    expect(screen.getByText('5/20')).toBeInTheDocument()

    // Root header quota denominator must also use full-tree scope:
    // Intermediate(10) + LeafA(5) + LeafB(5) + EmptyLeafA(4) + EmptyLeafB(4) + EmptyLeafC(3) = 31.
    expect(screen.getAllByText('5/31').length).toBeGreaterThanOrEqual(1)
  })

  // ============================================
  // Root-level drill-down for single-level taxonomy
  // ============================================

  it('root that is a leaf with equipment is selected in the detail pane', () => {
    const singleLevel = [
      { id: 10, parent_id: null, ma_nhom: 'R', ten_nhom: 'Root Leaf', level: 1, so_luong_hien_co: 2, so_luong_toi_da: 5 },
    ]

    mockUseContext.mockReturnValue({
      categories: singleLevel,
      allCategories: singleLevel,
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

    const detailPane = screen.getByTestId('device-quota-category-detail-pane')
    const rootRow = screen.getByRole('button', { name: /Chọn danh mục R: Root Leaf/i })
    expect(rootRow).toHaveAttribute('aria-pressed', 'true')
    expect(within(detailPane).getByText('Root Leaf')).toBeInTheDocument()
    expect(within(detailPane).getByTestId('assigned-equipment-panel-10')).toBeInTheDocument()
  })

  it('root that is a leaf with zero equipment is still selectable', () => {
    const singleLevelZero = [
      { id: 11, parent_id: null, ma_nhom: 'R', ten_nhom: 'Empty Root Leaf', level: 1, so_luong_hien_co: 0, so_luong_toi_da: 5 },
    ]

    mockUseContext.mockReturnValue({
      categories: singleLevelZero,
      allCategories: singleLevelZero,
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

    expect(screen.getByRole('button', { name: /Chọn danh mục R: Empty Root Leaf/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('root with children keeps a separate collapse control', () => {
    const rootWithChild = [
      { id: 12, parent_id: null, ma_nhom: 'R', ten_nhom: 'Root With Child', level: 1, so_luong_hien_co: 2, so_luong_toi_da: 5 },
      { id: 13, parent_id: 12, ma_nhom: '01', ten_nhom: 'Child', level: 2, so_luong_hien_co: 1, so_luong_toi_da: 5 },
    ]

    mockUseContext.mockReturnValue({
      categories: rootWithChild,
      allCategories: rootWithChild,
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

    const collapseButton = screen.getByRole('button', { name: /Thu gọn nhóm R: Root With Child/i })
    const rootRow = screen.getByRole('button', { name: /Chọn danh mục R: Root With Child/i })

    expect(collapseButton).toHaveAttribute('aria-expanded', 'true')
    expect(rootRow).toBeInTheDocument()
  })

  it('clicking the root row does not collapse the group', () => {
    const singleLevel = [
      { id: 20, parent_id: null, ma_nhom: 'R', ten_nhom: 'Root Leaf Stop', level: 1, so_luong_hien_co: 2, so_luong_toi_da: 5 },
    ]

    mockUseContext.mockReturnValue({
      categories: singleLevel,
      allCategories: singleLevel,
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

    const collapseButton = screen.getByRole('button', { name: /Thu gọn nhóm R: Root Leaf Stop/i })
    const rootRow = screen.getByRole('button', { name: /Chọn danh mục R: Root Leaf Stop/i })

    // Header should be expanded by default
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(rootRow)
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(rootRow, { key: 'Enter' })
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true')
  })
})
