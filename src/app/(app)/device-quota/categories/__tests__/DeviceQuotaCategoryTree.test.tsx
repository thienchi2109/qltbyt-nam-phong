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

  it("reveals clamped root and child category names on pointer hover and keyboard focus", async () => {
    const user = userEvent.setup()
    const longRootName =
      "Máy cộng hưởng từ toàn thân cấu hình cao phục vụ chẩn đoán hình ảnh chuyên sâu tại nhiều khoa phòng"
    const longChildName =
      "Hệ thống chụp cộng hưởng từ chuyên dụng có cấu hình tên dài cho khoa chẩn đoán hình ảnh"
    const categories = [
      {
        id: 1,
        parent_id: null,
        ma_nhom: "MRI",
        ten_nhom: longRootName,
        level: 1,
        so_luong_hien_co: 1,
        so_luong_toi_da: null,
        mo_ta:
          "Mô tả rất dài cần được giới hạn trong vùng đọc chi tiết để không đẩy bảng thiết bị xuống quá xa khỏi màn hình.",
      },
      {
        id: 2,
        parent_id: 1,
        ma_nhom: "MRI.01",
        ten_nhom: longChildName,
        level: 2,
        so_luong_hien_co: 0,
        so_luong_toi_da: 2,
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

    const rootRow = screen.getByRole("button", {
      name: new RegExp(`Chọn danh mục MRI: ${longRootName}`),
    })
    const childRow = screen.getByRole("button", {
      name: new RegExp(`Chọn danh mục MRI\\.01: ${longChildName}`),
    })
    const rootGrid = rootRow.parentElement?.parentElement as HTMLElement
    const rootName = within(rootRow).getByText(longRootName)
    expect(rootRow).not.toHaveAttribute("title")
    expect(rootGrid).toHaveClass("grid-cols-[minmax(0,1fr)_4.5rem_9rem_2rem]", "gap-x-3")
    expect(within(rootRow).getByText("MRI")).toHaveClass("w-16", "shrink-0")
    expect(rootName).toHaveClass("line-clamp-2")
    expect(rootName.parentElement).toHaveClass("min-w-0", "flex-1")
    expect(within(rootRow).getByText("1 mục con", { exact: false })).toHaveClass("mt-0.5", "block")
    expect(within(childRow).getByText("MRI.01")).toHaveClass("w-16", "shrink-0")
    expect(within(childRow).getByText(longChildName)).toHaveClass(
      "line-clamp-2",
      "min-w-0",
      "flex-1"
    )

    await user.hover(rootRow)
    expect(await screen.findByRole("tooltip")).toBeVisible()
    expect(screen.getByRole("tooltip")).toHaveTextContent(longRootName)

    await user.unhover(rootRow)
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument())

    await user.tab()
    await user.tab()
    expect(rootRow).toHaveFocus()
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeVisible())
    expect(screen.getByRole("tooltip")).toHaveTextContent(longRootName)

    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument())
    await user.hover(childRow)
    expect(await screen.findByRole("tooltip")).toBeVisible()
    expect(screen.getByRole("tooltip")).toHaveTextContent(longChildName)

    await user.unhover(childRow)
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument())
    await user.tab()
    await user.tab()
    expect(childRow).toHaveFocus()
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeVisible())
    expect(screen.getByRole("tooltip")).toHaveTextContent(longChildName)

    const detailPane = screen.getByTestId("device-quota-category-detail-pane")
    expect(within(detailPane).getByRole("heading", { name: longChildName })).toHaveClass(
      "line-clamp-3"
    )
  })
})
