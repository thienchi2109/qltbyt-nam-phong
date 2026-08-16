import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DeviceQuotaCategoryTree,
  type MockCategoryContextValue,
  basePagination,
  managerContextAccess,
  mockUseContext,
  renderWithThreeLevelTree,
  threeLevelTree,
} from "./DeviceQuotaCategoryTreeTestSupport"

describe("DeviceQuotaCategoryTree interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it("category rows are selectable and expose quota/classification context", () => {
    renderWithThreeLevelTree()

    const row = screen.getByRole("button", { name: /Chọn danh mục 01\.01: Leaf A/i })
    expect(row).toHaveAttribute("aria-pressed", "true")
    expect(row).not.toHaveAttribute("title")
    expect(row).toHaveAccessibleName(/Tình trạng 2\/5/i)
  })

  it("clicking a category row updates the detail pane without rendering equipment inline", () => {
    renderWithThreeLevelTree()

    const navPane = screen.getByTestId("device-quota-category-nav-pane")
    const detailPane = screen.getByTestId("device-quota-category-detail-pane")
    const row = screen.getByRole("button", { name: /Chọn danh mục 01\.02: Leaf B/i })

    fireEvent.click(row)

    expect(row).toHaveAttribute("aria-pressed", "true")
    expect(within(detailPane).getByText("Leaf B")).toBeInTheDocument()
    expect(within(detailPane).getByTestId("assigned-equipment-panel-5")).toBeInTheDocument()
    expect(within(navPane).queryByTestId("assigned-equipment-panel-5")).not.toBeInTheDocument()
  })

  it("does not select a row when keyboard interaction targets its action menu", () => {
    renderWithThreeLevelTree()

    const leafBRow = screen.getByRole("button", { name: /Chọn danh mục 01\.02: Leaf B/i })
    const leafBMenu = screen.getByRole("button", { name: /Mở menu danh mục Leaf B/i })

    fireEvent.keyDown(leafBMenu, { key: "Enter" })

    expect(leafBRow).toHaveAttribute("aria-pressed", "false")
    expect(leafBMenu).toHaveAttribute("type", "button")
    expect(leafBMenu).not.toHaveClass("opacity-0")
  })

  it("selects a focused category row with Enter or Space", async () => {
    const user = userEvent.setup()
    renderWithThreeLevelTree()

    const detailPane = screen.getByTestId("device-quota-category-detail-pane")
    const emptyLeaf = screen.getByRole("button", { name: /Chọn danh mục 02\.01: Empty Leaf A/i })
    const emptyLeafB = screen.getByRole("button", { name: /Chọn danh mục 02\.02: Empty Leaf B/i })

    act(() => emptyLeaf.focus())
    await user.keyboard("{Enter}")
    expect(emptyLeaf).toHaveAttribute("aria-pressed", "true")
    expect(within(detailPane).getByText("Empty Leaf A")).toBeInTheDocument()

    act(() => emptyLeafB.focus())
    await user.keyboard(" ")
    expect(emptyLeafB).toHaveAttribute("aria-pressed", "true")
    expect(within(detailPane).getByText("Empty Leaf B")).toBeInTheDocument()
  })

  it("shows intermediate direct assignments in detail without rendering equipment inline", () => {
    renderWithThreeLevelTree()

    const navPane = screen.getByTestId("device-quota-category-nav-pane")
    const detailPane = screen.getByTestId("device-quota-category-detail-pane")
    const intermediate = screen.getByRole("button", { name: /Chọn danh mục 01: Intermediate/i })

    fireEvent.click(intermediate)

    expect(intermediate).toHaveAttribute("aria-pressed", "true")
    expect(within(navPane).queryByTestId(/assigned-equipment-panel-/)).not.toBeInTheDocument()
    expect(within(detailPane).getByTestId("assigned-equipment-panel-2")).toBeInTheDocument()
    expect(within(detailPane).getByText("Thiết bị gán trực tiếp")).toBeInTheDocument()
  })

  it("zero-count leaf is still selectable for scanning its empty assignment state", () => {
    renderWithThreeLevelTree()

    expect(
      screen.getByRole("button", { name: /Chọn danh mục 02\.01: Empty Leaf A/i })
    ).toBeInTheDocument()
  })

  it("displays full-tree aggregated totals even when categories is search-filtered", () => {
    // Simulate search: only root and one intermediate are visible,
    // but allCategories still contains the full tree
    const filteredCategories = [
      threeLevelTree[0], // Root (id:1)
      threeLevelTree[1], // Intermediate (id:2)
    ]

    mockUseContext.mockReturnValue({
      categories: filteredCategories,
      allCategories: threeLevelTree, // full tree with all leaves
      ...managerContextAccess,
      donViId: 1,
      isLoading: false,
      totalRootCount: 1,
      searchTerm: "Intermediate",
      pagination: basePagination,
      openCreateDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteDialog: vi.fn(),
      mutatingCategoryId: null,
    } as unknown as MockCategoryContextValue)

    render(<DeviceQuotaCategoryTree />)

    // Even though leaves are not in the visible categories,
    // the intermediate node should still show aggregated count from full tree
    expect(screen.getByText("5/20")).toBeInTheDocument()

    // Root header quota denominator must also use full-tree scope:
    // Intermediate(10) + LeafA(5) + LeafB(5) + EmptyLeafA(4) + EmptyLeafB(4) + EmptyLeafC(3) = 31.
    expect(screen.getAllByText("5/31").length).toBeGreaterThanOrEqual(1)
  })

  // ============================================
  // Root-level drill-down for single-level taxonomy
  // ============================================

  it("root that is a leaf with equipment is selected in the detail pane", () => {
    const singleLevel = [
      {
        id: 10,
        parent_id: null,
        ma_nhom: "R",
        ten_nhom: "Root Leaf",
        level: 1,
        so_luong_hien_co: 2,
        so_luong_toi_da: 5,
      },
    ]

    mockUseContext.mockReturnValue({
      categories: singleLevel,
      allCategories: singleLevel,
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
    const rootRow = screen.getByRole("button", { name: /Chọn danh mục R: Root Leaf/i })
    expect(rootRow).toHaveAttribute("aria-pressed", "true")
    expect(within(detailPane).getByText("Root Leaf")).toBeInTheDocument()
    expect(within(detailPane).getByTestId("assigned-equipment-panel-10")).toBeInTheDocument()
  })

  it("root that is a leaf with zero equipment is still selectable", () => {
    const singleLevelZero = [
      {
        id: 11,
        parent_id: null,
        ma_nhom: "R",
        ten_nhom: "Empty Root Leaf",
        level: 1,
        so_luong_hien_co: 0,
        so_luong_toi_da: 5,
      },
    ]

    mockUseContext.mockReturnValue({
      categories: singleLevelZero,
      allCategories: singleLevelZero,
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

    expect(
      screen.getByRole("button", { name: /Chọn danh mục R: Empty Root Leaf/i })
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("root with children keeps a separate collapse control", () => {
    const rootWithChild = [
      {
        id: 12,
        parent_id: null,
        ma_nhom: "R",
        ten_nhom: "Root With Child",
        level: 1,
        so_luong_hien_co: 2,
        so_luong_toi_da: 5,
      },
      {
        id: 13,
        parent_id: 12,
        ma_nhom: "01",
        ten_nhom: "Child",
        level: 2,
        so_luong_hien_co: 1,
        so_luong_toi_da: 5,
      },
    ]

    mockUseContext.mockReturnValue({
      categories: rootWithChild,
      allCategories: rootWithChild,
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

    const collapseButton = screen.getByRole("button", { name: /Thu gọn nhóm R: Root With Child/i })
    const rootRow = screen.getByRole("button", { name: /Chọn danh mục R: Root With Child/i })

    expect(collapseButton).toHaveAttribute("aria-expanded", "true")
    expect(rootRow).toBeInTheDocument()
  })

  it("clicking the root row does not collapse the group", () => {
    const singleLevel = [
      {
        id: 20,
        parent_id: null,
        ma_nhom: "R",
        ten_nhom: "Root Leaf Stop",
        level: 1,
        so_luong_hien_co: 2,
        so_luong_toi_da: 5,
      },
    ]

    mockUseContext.mockReturnValue({
      categories: singleLevel,
      allCategories: singleLevel,
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

    const collapseButton = screen.getByRole("button", { name: /Thu gọn nhóm R: Root Leaf Stop/i })
    const rootRow = screen.getByRole("button", { name: /Chọn danh mục R: Root Leaf Stop/i })

    // Header should be expanded by default
    expect(collapseButton).toHaveAttribute("aria-expanded", "true")

    fireEvent.click(rootRow)
    expect(collapseButton).toHaveAttribute("aria-expanded", "true")

    fireEvent.keyDown(rootRow, { key: "Enter" })
    expect(collapseButton).toHaveAttribute("aria-expanded", "true")
  })
})
