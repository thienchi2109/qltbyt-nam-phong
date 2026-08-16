import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from "vitest"

import {
  DeviceQuotaCategoryTree,
  type MockCategoryContextValue,
  basePagination,
  managerContextAccess,
  mockUseContext,
} from "./DeviceQuotaCategoryTreeTestSupport"
describe("DeviceQuotaCategoryTree", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows empty state and triggers create dialog", () => {
    const openCreateDialog = vi.fn()

    mockUseContext.mockReturnValue({
      categories: [],
      allCategories: [],
      ...managerContextAccess,
      donViId: 1,
      isLoading: false,
      totalRootCount: 0,
      searchTerm: "",
      pagination: basePagination,
      openCreateDialog,
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByText("Chưa có danh mục nào")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Tạo danh mục" }))
    expect(openCreateDialog).toHaveBeenCalledTimes(1)
  })

  it("shows search empty state when searching", () => {
    mockUseContext.mockReturnValue({
      categories: [],
      allCategories: [],
      ...managerContextAccess,
      donViId: 1,
      isLoading: false,
      totalRootCount: 0,
      searchTerm: "xyz",
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByText("Không tìm thấy danh mục")).toBeInTheDocument()
  })

  it("renders category groups with root headers", () => {
    const categories = [
      {
        id: 1,
        parent_id: null,
        ma_nhom: "I",
        ten_nhom: "Nhóm gốc 1",
        level: 1,
        so_luong_hien_co: 5,
        phan_loai: "A",
      },
      {
        id: 2,
        parent_id: 1,
        ma_nhom: "01",
        ten_nhom: "Nhóm con 1.1",
        level: 2,
        so_luong_hien_co: 3,
        phan_loai: "A",
      },
      {
        id: 3,
        parent_id: 1,
        ma_nhom: "02",
        ten_nhom: "Nhóm con 1.2",
        level: 2,
        so_luong_hien_co: 2,
        phan_loai: "B",
      },
    ]
    mockUseContext.mockReturnValue({
      categories,
      allCategories: categories,
      ...managerContextAccess,
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: "",
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    const navPane = screen.getByTestId("device-quota-category-nav-pane")
    expect(within(navPane).getByText("Nhóm gốc 1")).toBeInTheDocument()
    expect(within(navPane).getByText("Nhóm con 1.1")).toBeInTheDocument()
    expect(within(navPane).getByText("Nhóm con 1.2")).toBeInTheDocument()
    expect(screen.getAllByText("Loại A").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Loại B")).toBeInTheDocument()
  })

  it("uses semantic list markup", () => {
    const categories = [
      { id: 1, parent_id: null, ma_nhom: "I", ten_nhom: "Nhóm 1", level: 1, so_luong_hien_co: 0 },
    ]
    mockUseContext.mockReturnValue({
      categories,
      allCategories: categories,
      ...managerContextAccess,
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: "",
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByRole("list", { name: "Tiêu chuẩn, định mức thiết bị" })).toBeInTheDocument()
  })

  it("shows column header when data exists", () => {
    const categories = [
      { id: 1, parent_id: null, ma_nhom: "I", ten_nhom: "Nhóm 1", level: 1, so_luong_hien_co: 0 },
    ]
    mockUseContext.mockReturnValue({
      categories,
      allCategories: categories,
      ...managerContextAccess,
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: "",
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.getByText("Phân loại")).toBeInTheDocument()
    expect(screen.getByText("Tình trạng sử dụng")).toBeInTheDocument()
  })

  it("renders split navigation and detail panes with a 46:54 layout", () => {
    const categories = [
      {
        id: 1,
        parent_id: null,
        ma_nhom: "I",
        ten_nhom: "Root",
        level: 1,
        so_luong_hien_co: 0,
        so_luong_toi_da: null,
      },
      {
        id: 2,
        parent_id: 1,
        ma_nhom: "01",
        ten_nhom: "Leaf With Equipment",
        level: 2,
        so_luong_hien_co: 3,
        so_luong_toi_da: 9,
        phan_loai: "A",
      },
      {
        id: 3,
        parent_id: 1,
        ma_nhom: "02",
        ten_nhom: "Empty Leaf",
        level: 2,
        so_luong_hien_co: 0,
        so_luong_toi_da: 4,
        phan_loai: "B",
      },
    ]
    mockUseContext.mockReturnValue({
      categories,
      allCategories: categories,
      ...managerContextAccess,
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: "",
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    const splitPane = screen.getByTestId("device-quota-split-pane")
    expect(splitPane).toHaveClass("grid-cols-1", "xl:grid-cols-[minmax(560px,46fr)_minmax(0,54fr)]")
    expect(splitPane).not.toHaveClass(
      "lg:grid-cols-[minmax(560px,46fr)_minmax(0,54fr)]",
      "lg:grid-cols-[minmax(320px,40%)_minmax(0,60%)]"
    )
    expect(screen.getByTestId("device-quota-category-nav-pane")).toBeInTheDocument()
    expect(screen.getByTestId("device-quota-category-detail-pane")).toBeInTheDocument()
  })

  it("selects the first visible leaf with assigned equipment by default", () => {
    const categories = [
      {
        id: 1,
        parent_id: null,
        ma_nhom: "I",
        ten_nhom: "Root",
        level: 1,
        so_luong_hien_co: 0,
        so_luong_toi_da: null,
      },
      {
        id: 2,
        parent_id: 1,
        ma_nhom: "01",
        ten_nhom: "Empty Leaf",
        level: 2,
        so_luong_hien_co: 0,
        so_luong_toi_da: 4,
      },
      {
        id: 3,
        parent_id: 1,
        ma_nhom: "02",
        ten_nhom: "Leaf With Equipment",
        level: 2,
        so_luong_hien_co: 2,
        so_luong_toi_da: 5,
        phan_loai: "A",
      },
    ]
    mockUseContext.mockReturnValue({
      categories,
      allCategories: categories,
      ...managerContextAccess,
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: "",
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    const detailPane = screen.getByTestId("device-quota-category-detail-pane")
    expect(within(detailPane).getByText("Leaf With Equipment")).toBeInTheDocument()
    expect(within(detailPane).getByTestId("assigned-equipment-panel-3")).toHaveAttribute(
      "data-variant",
      "panel"
    )
  })
})
