import * as React from "react"
import { fireEvent, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { readyStatusCatalog } from "@/hooks/__tests__/equipment-status-catalog-fixtures"
import {
  mockCallRpc,
  mockEquipment,
  mockOnClose,
  mockOnAction,
  renderQRActionSheet,
} from "./qr-action-sheet.fixtures"
import { QRActionSheet } from "../qr-action-sheet"

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), retry: vi.fn() }))
vi.mock("@/hooks/use-equipment-status-catalog", () => ({
  useEquipmentStatusCatalog: () => mocks.catalog(),
}))

describe("QR lifecycle catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.catalog.mockReturnValue({ ...readyStatusCatalog, refetch: mocks.retry })
  })

  it.each([
    ["Hoạt động", "bg-green-100", "text-green-800"],
    ["Chờ sửa chữa", "bg-red-100", "text-red-800"],
    ["Chờ bảo trì", "bg-yellow-100", "text-yellow-800"],
    ["Chờ hiệu chuẩn/kiểm định", "bg-blue-100", "text-blue-800"],
    ["Ngưng sử dụng", "bg-gray-100", "text-gray-800"],
    ["Chưa có nhu cầu sử dụng", "bg-purple-100", "text-purple-800"],
  ])("retains %s badge and all legacy navigation items", async (status, background, color) => {
    mockCallRpc.mockResolvedValueOnce({ ...mockEquipment, tinh_trang_hien_tai: status })
    renderQRActionSheet()
    expect(await screen.findByText(status)).toHaveClass(background, color)
    for (const title of [
      "Ghi nhật ký sử dụng thiết bị",
      "Xem thông tin chi tiết",
      "Lịch sử bảo trì & sửa chữa",
      "Tạo yêu cầu sửa chữa",
      "Cập nhật trạng thái",
    ])
      expect(screen.getByRole("button", { name: new RegExp(title) })).toBeEnabled()
  })

  it("shows the dark gray white liquidation badge and blocks only new repair", async () => {
    mockCallRpc.mockResolvedValueOnce({ ...mockEquipment, tinh_trang_hien_tai: "Thanh lý nội bộ" })
    renderQRActionSheet()
    expect(await screen.findByText("Thanh lý nội bộ")).toHaveClass("bg-gray-800", "text-white")
    const repair = screen.getByRole("button", { name: /Tạo yêu cầu sửa chữa/ })
    expect(repair).toBeDisabled()
    fireEvent.click(repair)
    expect(mockOnAction).not.toHaveBeenCalled()
    for (const [title, action] of [
      ["Ghi nhật ký sử dụng thiết bị", "usage-log"],
      ["Cập nhật trạng thái", "update-status"],
      ["Lịch sử bảo trì & sửa chữa", "view-history"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(title) }))
      expect(mockOnAction).toHaveBeenLastCalledWith(action, expect.anything())
    }
  })

  it("uses block metadata for an inactive known label and does not infer it from terminal alone", async () => {
    const metadata = {
      ...readyStatusCatalog.data[0],
      status_value: "Kết thúc theo dõi",
      is_terminal: true,
      is_active: false,
    }
    mocks.catalog.mockReturnValue({
      ...readyStatusCatalog,
      data: [metadata],
      activeValues: [],
      canWrite: false,
    })
    mockCallRpc.mockResolvedValueOnce({
      ...mockEquipment,
      tinh_trang_hien_tai: metadata.status_value,
    })
    const view = renderQRActionSheet()
    await screen.findByText(metadata.status_value)
    expect(screen.getByRole("button", { name: /Tạo yêu cầu sửa chữa/ })).toBeEnabled()
    mocks.catalog.mockReturnValue({
      ...readyStatusCatalog,
      data: [{ ...metadata, blocks_operational_actions: true }],
    })
    view.rerender(<QRActionSheet qrCode="TB-001" onClose={mockOnClose} onAction={mockOnAction} />)
    expect(screen.getByRole("button", { name: /Tạo yêu cầu sửa chữa/ })).toBeDisabled()
  })

  it.each(["paused", "fetching", "error", "pending"])(
    "blocks new repair during catalog %s and exposes retry",
    async (state) => {
      mocks.catalog.mockReturnValue({
        ...readyStatusCatalog,
        data: state === "pending" ? undefined : readyStatusCatalog.data,
        isSuccess: state !== "error" && state !== "pending",
        fetchStatus: state === "error" ? "idle" : state,
        canWrite: false,
        refetch: mocks.retry,
      })
      mockCallRpc.mockResolvedValueOnce(mockEquipment)
      renderQRActionSheet()
      await screen.findByText("Máy siêu âm")
      const repair = screen.getByRole("button", { name: /Tạo yêu cầu sửa chữa/ })
      expect(repair).toBeDisabled()
      fireEvent.click(repair)
      expect(mockOnAction).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
      expect(mocks.retry).toHaveBeenCalledOnce()
      expect(screen.getByRole("button", { name: /Ghi nhật ký sử dụng thiết bị/ })).toBeEnabled()
    }
  )
})
