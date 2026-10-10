import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import * as React from "react"
import {
  setupMockHookState,
  createMockEquipment,
  createMockFile,
  mockCallRpc,
  mockNormalizeDateForImport,
  mockNormalizeFullDateForImport,
  mockToast,
} from "./import-equipment-dialog.fixtures"
import { ImportEquipmentDialog } from "../import-equipment-dialog"

describe("Dialog Open/Close Behavior", () => {
  it("should call onOpenChange when cancel button clicked", () => {
    const { mockResetState } = setupMockHookState()
    const onOpenChange = vi.fn()

    render(<ImportEquipmentDialog open={true} onOpenChange={onOpenChange} onSuccess={() => {}} />)

    fireEvent.click(screen.getByRole("button", { name: /Hủy/i }))

    expect(mockResetState).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("should disable cancel button when submitting", () => {
    setupMockHookState({ status: "submitting" })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByRole("button", { name: /Hủy/i })).toBeDisabled()
  })
})

describe("Import Submission", () => {
  it("should call RPC with correct arguments on submit", async () => {
    const mockEquipment = createMockEquipment()
    const { mockSetSubmitting, mockSetSuccess } = setupMockHookState({
      status: "parsed",
      selectedFile: createMockFile(),
      parsedData: [mockEquipment],
      parseError: null,
      validationErrors: [],
    })

    mockCallRpc.mockResolvedValue({
      success: true,
      inserted: 1,
      failed: 0,
      total: 1,
      details: [],
    })

    const onSuccess = vi.fn()

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={onSuccess} />)

    fireEvent.click(screen.getByTestId("submit-button"))

    await waitFor(() => {
      expect(mockSetSubmitting).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "equipment_bulk_import",
        args: {
          p_items: expect.arrayContaining([
            expect.objectContaining({
              ma_thiet_bi: "EQ001",
              ten_thiet_bi: "May sieu am",
            }),
          ]),
        },
      })
    })

    await waitFor(() => {
      expect(mockSetSuccess).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it("should show toast on successful import", async () => {
    setupMockHookState({
      status: "parsed",
      selectedFile: createMockFile(),
      parsedData: [createMockEquipment()],
      parseError: null,
      validationErrors: [],
    })

    mockCallRpc.mockResolvedValue({
      success: true,
      inserted: 1,
      failed: 0,
      total: 1,
      details: [],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    fireEvent.click(screen.getByTestId("submit-button"))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled()
    })
  })

  it("should show error toast on RPC failure", async () => {
    const { mockSetSubmitError } = setupMockHookState({
      status: "parsed",
      selectedFile: createMockFile(),
      parsedData: [createMockEquipment()],
      parseError: null,
      validationErrors: [],
    })

    mockCallRpc.mockRejectedValue(new Error("Database connection failed"))

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    fireEvent.click(screen.getByTestId("submit-button"))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi",
        })
      )
    })

    await waitFor(() => {
      expect(mockSetSubmitError).toHaveBeenCalledWith("Database connection failed")
    })
  })

  it("should show plain-object RPC errors instead of an empty import toast description", async () => {
    const { mockSetSubmitError } = setupMockHookState({
      status: "parsed",
      selectedFile: createMockFile(),
      parsedData: [createMockEquipment()],
      parseError: null,
      validationErrors: [],
    })

    mockCallRpc.mockRejectedValueOnce({ message: "Permission denied" })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    fireEvent.click(screen.getByTestId("submit-button"))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi",
          description: "Không thể nhập dữ liệu. Permission denied",
        })
      )
    })

    await waitFor(() => {
      expect(mockSetSubmitError).toHaveBeenCalledWith("Permission denied")
    })
  })

  it("should not call RPC when parsed data is empty", async () => {
    setupMockHookState({
      status: "parsed",
      selectedFile: createMockFile(),
      parsedData: [],
      parseError: null,
      validationErrors: [],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    // Button should be disabled
    expect(screen.getByTestId("submit-button")).toBeDisabled()
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it("should clean undefined values from payload", async () => {
    const equipmentWithUndefined = {
      ma_thiet_bi: "EQ001",
      ten_thiet_bi: "May sieu am",
      khoa_phong_quan_ly: "Khoa Noi",
      nguoi_dang_truc_tiep_quan_ly: "A",
      tinh_trang_hien_tai: "Hoạt động",
      vi_tri_lap_dat: "P1",
      model: undefined,
      serial: undefined,
    }

    setupMockHookState({
      status: "parsed",
      selectedFile: createMockFile(),
      parsedData: [equipmentWithUndefined],
      parseError: null,
      validationErrors: [],
    })

    mockCallRpc.mockResolvedValue({
      success: true,
      inserted: 1,
      failed: 0,
      total: 1,
      details: [],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    fireEvent.click(screen.getByTestId("submit-button"))

    await waitFor(() => {
      const callArgs = mockCallRpc.mock.calls[0][0]
      const item = callArgs.args.p_items[0]
      // Should not have undefined keys
      expect(item).not.toHaveProperty("model")
      expect(item).not.toHaveProperty("serial")
      expect(item.ma_thiet_bi).toBe("EQ001")
    })
  })
})
