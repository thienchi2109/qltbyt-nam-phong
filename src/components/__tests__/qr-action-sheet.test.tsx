/**
 * Unit tests for QRActionSheet component.
 *
 * Tests cover:
 * - Component rendering with different states
 * - Security: Uses callRpc (not direct Supabase access)
 * - Error handling for equipment not found
 * - Action button functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react"
import * as React from "react"

import {
  mockCallRpc,
  mockEquipment,
  mockOnClose,
  mockOnAction,
  renderQRActionSheet,
} from "./qr-action-sheet.fixtures"
import { QRActionSheet } from "../qr-action-sheet"
import { readyStatusCatalog } from "@/hooks/__tests__/equipment-status-catalog-fixtures"
vi.mock("@/hooks/use-equipment-status-catalog", () => ({
  useEquipmentStatusCatalog: () => readyStatusCatalog,
}))

describe("QRActionSheet", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    const actWarnings = consoleErrorSpy.mock.calls
      .map(([firstArg]) => String(firstArg))
      .filter((message) => message.includes("not wrapped in act"))

    expect(actWarnings).toHaveLength(0)
    consoleErrorSpy.mockRestore()
    vi.resetAllMocks()
  })

  describe("Rendering", () => {
    it("should display the scanned QR code", async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      renderQRActionSheet()

      expect(screen.getByText("TB-001")).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText("Máy siêu âm")).toBeInTheDocument()
      })
    })

    it("should show loading state while fetching equipment", async () => {
      // Create a promise that we can control
      let resolvePromise: (value: typeof mockEquipment) => void
      const pendingPromise = new Promise<typeof mockEquipment>((resolve) => {
        resolvePromise = resolve
      })
      mockCallRpc.mockReturnValueOnce(pendingPromise)

      renderQRActionSheet()

      expect(screen.getByText(/Đang tìm kiếm thiết bị/)).toBeInTheDocument()

      await act(async () => {
        resolvePromise!(mockEquipment)
        await pendingPromise
      })

      await waitFor(() => {
        expect(screen.getByText("Máy siêu âm")).toBeInTheDocument()
      })
    })

    it("should display equipment details after successful fetch", async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      renderQRActionSheet()

      await waitFor(() => {
        expect(screen.getByText("Máy siêu âm")).toBeInTheDocument()
      })

      expect(screen.getByText("SU-500 • GE Healthcare")).toBeInTheDocument()
      expect(screen.getByText("Hoạt động")).toBeInTheDocument()
    })

    it("should display a zero original price instead of falling back to N/A", async () => {
      mockCallRpc.mockResolvedValueOnce({
        ...mockEquipment,
        gia_goc: 0,
      })

      renderQRActionSheet()

      await waitFor(() => {
        expect(screen.getByText("Giá gốc:")).toBeInTheDocument()
      })

      const originalPriceRow = screen.getByText("Giá gốc:").closest("div")
      expect(originalPriceRow).toHaveTextContent(/0\s*₫/)
      expect(originalPriceRow).not.toHaveTextContent("N/A")
    })

    it("should display error message when equipment not found", async () => {
      mockCallRpc.mockResolvedValueOnce(null)

      renderQRActionSheet("INVALID-CODE")

      await waitFor(() => {
        expect(screen.getByText("Không tìm thấy thiết bị")).toBeInTheDocument()
      })

      expect(
        screen.getByText(/Không tìm thấy thiết bị với mã "INVALID-CODE" trong hệ thống/)
      ).toBeInTheDocument()
    })
  })

  describe("Security: RPC Usage", () => {
    it("should call equipment_get_by_code RPC (not direct table access)", async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      renderQRActionSheet()

      await waitFor(() => {
        expect(mockCallRpc).toHaveBeenCalledWith({
          fn: "equipment_get_by_code",
          args: { p_ma_thiet_bi: "TB-001" },
        })
      })
    })

    it("should trim QR code before sending to RPC", async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      renderQRActionSheet("  TB-001  ")

      await waitFor(() => {
        expect(mockCallRpc).toHaveBeenCalledWith({
          fn: "equipment_get_by_code",
          args: { p_ma_thiet_bi: "TB-001" },
        })
      })
    })

    it("should NOT pass p_don_vi parameter (tenant is enforced server-side)", async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      renderQRActionSheet()

      await waitFor(() => {
        const callArgs = mockCallRpc.mock.calls[0][0]
        expect(callArgs.args).not.toHaveProperty("p_don_vi")
      })
    })
  })

  describe("Error Handling", () => {
    it("should display access denied error when RPC throws access denied", async () => {
      mockCallRpc.mockRejectedValueOnce(new Error("Equipment not found or access denied"))

      renderQRActionSheet("TB-FORBIDDEN")

      await waitFor(() => {
        expect(screen.getByText("Không có quyền truy cập")).toBeInTheDocument()
      })

      expect(screen.getByText(/không thuộc quyền quản lý của bạn/)).toBeInTheDocument()
    })

    it("should clear equipment details and remove action paths after an access denied lookup", async () => {
      mockCallRpc
        .mockResolvedValueOnce(mockEquipment)
        .mockRejectedValueOnce(new Error("Equipment not found or access denied"))

      const { rerender } = renderQRActionSheet()

      await waitFor(() => {
        expect(screen.getByText("Máy siêu âm")).toBeInTheDocument()
        expect(screen.getByText("Xem thông tin chi tiết")).toBeInTheDocument()
      })

      rerender(
        <QRActionSheet qrCode="TB-FORBIDDEN" onClose={mockOnClose} onAction={mockOnAction} />
      )

      await waitFor(() => {
        expect(screen.getByText("Không có quyền truy cập")).toBeInTheDocument()
      })

      expect(screen.queryByText("Máy siêu âm")).not.toBeInTheDocument()
      expect(screen.queryByText("SU-500 • GE Healthcare")).not.toBeInTheDocument()
      expect(screen.queryByText("Ghi nhật ký sử dụng thiết bị")).not.toBeInTheDocument()
      expect(screen.queryByText("Xem thông tin chi tiết")).not.toBeInTheDocument()
      expect(screen.queryByText("Lịch sử bảo trì & sửa chữa")).not.toBeInTheDocument()
      expect(screen.queryByText("Tạo yêu cầu sửa chữa")).not.toBeInTheDocument()
      expect(screen.queryByText("Cập nhật trạng thái")).not.toBeInTheDocument()
      expect(mockOnAction).not.toHaveBeenCalled()
    })

    it("should display not found error when equipment does not exist", async () => {
      mockCallRpc.mockRejectedValueOnce(new Error("Equipment not found"))

      renderQRActionSheet("TB-NONEXISTENT")

      await waitFor(() => {
        expect(screen.getByText("Không tìm thấy thiết bị")).toBeInTheDocument()
      })
    })

    it("should display network error when connection fails", async () => {
      mockCallRpc.mockRejectedValueOnce(new Error("Network request failed"))

      renderQRActionSheet()

      await waitFor(() => {
        expect(screen.getByText("Lỗi kết nối mạng")).toBeInTheDocument()
      })
    })

    it("should display network error when RPC rejects with a network string", async () => {
      mockCallRpc.mockRejectedValueOnce("Network request failed")

      renderQRActionSheet()

      await waitFor(() => {
        expect(screen.getByText("Lỗi kết nối mạng")).toBeInTheDocument()
      })
    })

    it("should show retry button on error", async () => {
      mockCallRpc.mockRejectedValueOnce(new Error("Equipment not found"))

      renderQRActionSheet()

      await waitFor(() => {
        expect(screen.getByText("Thử lại")).toBeInTheDocument()
      })
    })

    it("should retry search when retry button clicked", async () => {
      mockCallRpc.mockRejectedValueOnce(new Error("Network request failed"))

      renderQRActionSheet()

      await waitFor(() => {
        expect(screen.getByText("Thử lại")).toBeInTheDocument()
      })

      // Setup success for retry
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      const retryButton = screen.getByText("Thử lại")
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(mockCallRpc).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe("Action Buttons", () => {
    it("should call onAction with equipment when action button clicked", async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      renderQRActionSheet()

      await waitFor(() => {
        expect(screen.getByText("Máy siêu âm")).toBeInTheDocument()
      })

      const viewDetailsButton = screen.getByText("Xem thông tin chi tiết")
      fireEvent.click(viewDetailsButton)

      expect(mockOnAction).toHaveBeenCalledWith("view-details", mockEquipment)
    })

    it("should render all action buttons when equipment is found", async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      renderQRActionSheet()

      await waitFor(() => {
        expect(screen.getByText("Ghi nhật ký sử dụng thiết bị")).toBeInTheDocument()
        expect(screen.getByText("Xem thông tin chi tiết")).toBeInTheDocument()
        expect(screen.getByText("Lịch sử bảo trì & sửa chữa")).toBeInTheDocument()
        expect(screen.getByText("Tạo yêu cầu sửa chữa")).toBeInTheDocument()
        expect(screen.getByText("Cập nhật trạng thái")).toBeInTheDocument()
      })
    })
  })

  describe("Close Behavior", () => {
    it("should expose an accessible close button label in the header", async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      renderQRActionSheet()

      await waitFor(() => {
        expect(screen.getByText("Máy siêu âm")).toBeInTheDocument()
      })

      expect(screen.getByRole("button", { name: "Đóng bảng hành động QR" })).toBeInTheDocument()
    })

    it("should call onClose when close button is clicked", async () => {
      mockCallRpc.mockResolvedValueOnce(mockEquipment)

      renderQRActionSheet()

      // Wait for equipment to load
      await waitFor(() => {
        expect(screen.getByText("Máy siêu âm")).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: "Đóng bảng hành động QR" }))
      expect(mockOnClose).toHaveBeenCalled()
    })
  })
})
