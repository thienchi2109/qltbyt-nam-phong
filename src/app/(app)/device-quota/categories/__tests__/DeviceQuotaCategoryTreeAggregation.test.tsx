import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DeviceQuotaCategoryTree,
  type MockCategoryContextValue,
  basePagination,
  managerContextAccess,
  mockUseContext,
  renderWithThreeLevelTree,
} from "./DeviceQuotaCategoryTreeTestSupport"

describe("DeviceQuotaCategoryTree aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it("hides column header when no data", () => {
    mockUseContext.mockReturnValue({
      categories: [],
      allCategories: [],
      ...managerContextAccess,
      donViId: 1,
      isLoading: false,
      totalRootCount: 0,
      searchTerm: "",
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    expect(screen.queryByText("Phân loại")).not.toBeInTheDocument()
    expect(screen.queryByText("Tình trạng sử dụng")).not.toBeInTheDocument()
  })

  it("renders quota progress bars for child rows", () => {
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
        ten_nhom: "Child",
        level: 2,
        so_luong_hien_co: 3,
        so_luong_toi_da: 9,
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

    expect(screen.getAllByText("3/9").length).toBeGreaterThanOrEqual(1)
  })

  it("renders aggregated quota progress bar on group header", () => {
    const categories = [
      {
        id: 1,
        parent_id: null,
        ma_nhom: "I",
        ten_nhom: "Root",
        level: 1,
        so_luong_hien_co: 0,
        so_luong_toi_da: 5,
      },
      {
        id: 2,
        parent_id: 1,
        ma_nhom: "01",
        ten_nhom: "Child A",
        level: 2,
        so_luong_hien_co: 3,
        so_luong_toi_da: 9,
      },
      {
        id: 3,
        parent_id: 1,
        ma_nhom: "02",
        ten_nhom: "Child B",
        level: 2,
        so_luong_hien_co: 2,
        so_luong_toi_da: 6,
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

    // Group header: aggregated total = 0+3+2=5, total quota = 5+9+6=20
    expect(screen.getByText("5/20")).toBeInTheDocument()
  })

  it("shows aggregated count for intermediate node from descendant leaves", () => {
    renderWithThreeLevelTree()

    // Intermediate node (id:2): aggregated count = 0+2+3=5
    // Aggregated quota = own(10) + LeafA(5) + LeafB(5) = 20
    expect(screen.getByText("5/20")).toBeInTheDocument()
  })

  it("root header rolls up known child quotas when the root has no direct quota", () => {
    renderWithThreeLevelTree()

    // Root (id:1): equipment = 5, known descendant quota = 10+5+5+4+4+3.
    expect(screen.getAllByText("5/31").length).toBeGreaterThanOrEqual(1)
  })

  it("root header preserves unknown quota when direct root equipment has no direct quota", () => {
    const categories = [
      {
        id: 22,
        parent_id: null,
        ma_nhom: "02",
        ten_nhom: "CT Scanner",
        level: 1,
        so_luong_hien_co: 2,
        so_luong_toi_da: null,
      },
      {
        id: 299,
        parent_id: 22,
        ma_nhom: "02.01",
        ten_nhom: "CT < 64",
        level: 2,
        so_luong_hien_co: 0,
        so_luong_toi_da: 4,
      },
      {
        id: 300,
        parent_id: 22,
        ma_nhom: "02.02",
        ten_nhom: "CT 64-128",
        level: 2,
        so_luong_hien_co: 0,
        so_luong_toi_da: 4,
      },
      {
        id: 301,
        parent_id: 22,
        ma_nhom: "02.03",
        ten_nhom: "CT >= 256",
        level: 2,
        so_luong_hien_co: 0,
        so_luong_toi_da: 3,
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

    expect(screen.getByText("2/–")).toBeInTheDocument()
  })
})
