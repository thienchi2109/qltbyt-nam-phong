import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DeviceQuotaCategoryTree,
  type MockCategoryContextValue,
  basePagination,
  managerContextAccess,
  mockUseContext,
} from "./DeviceQuotaCategoryTreeTestSupport"

describe("DeviceQuotaCategoryTree name overflow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
