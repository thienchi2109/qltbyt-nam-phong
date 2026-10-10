import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import * as React from "react"
import {
  setupMockHookState,
  createMockEquipment,
  createMockFile,
  mockUseBulkImportState,
  mockCallRpc,
  mockNormalizeDateForImport,
  mockNormalizeFullDateForImport,
} from "./import-equipment-dialog.fixtures"
import { ImportEquipmentDialog } from "../import-equipment-dialog"

describe("Integration with useBulkImportState", () => {
  it("should pass correct headerMap to hook", () => {
    setupMockHookState()

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(mockUseBulkImportState).toHaveBeenCalledWith(
      expect.objectContaining({
        headerMap: expect.objectContaining({
          "Mã thiết bị": "ma_thiet_bi",
          "Tên thiết bị": "ten_thiet_bi",
          Model: "model",
          Serial: "serial",
          "Ngày ngừng sử dụng": "ngay_ngung_su_dung",
        }),
      })
    )
  })

  it("should map Ngày ngừng sử dụng to ngay_ngung_su_dung", () => {
    setupMockHookState()

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(mockUseBulkImportState).toHaveBeenCalledWith(
      expect.objectContaining({
        headerMap: expect.objectContaining({
          "Ngày ngừng sử dụng": "ngay_ngung_su_dung",
        }),
      })
    )
  })

  it("should pass transformRow function to hook", () => {
    setupMockHookState()

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(mockUseBulkImportState).toHaveBeenCalledWith(
      expect.objectContaining({
        transformRow: expect.any(Function),
      })
    )
  })

  it("should use the strict full-date helper for ngay_ngung_su_dung before the generic fallback", () => {
    setupMockHookState()

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    const hookConfig = mockUseBulkImportState.mock.calls[0][0]
    const transformed = hookConfig.transformRow({
      ngay_nhap: "2024-12-31",
      ngay_ngung_su_dung: "2024-12-31",
    })

    expect(mockNormalizeFullDateForImport).toHaveBeenCalledWith("2024-12-31")
    expect(mockNormalizeDateForImport).toHaveBeenCalledWith("2024-12-31")
    expect(transformed.ngay_ngung_su_dung).toBe("full:2024-12-31")
    expect(transformed.ngay_nhap).toBe("generic:2024-12-31")
  })

  it("skips chronology validation when ngay_dua_vao_su_dung came from a partial raw date", () => {
    mockNormalizeDateForImport.mockImplementation((val: unknown) => {
      if (val === "2025") {
        return { value: "2025-01-01", rejected: false }
      }

      if (val === "2024-12-31") {
        return { value: "2024-12-31", rejected: false }
      }

      return { value: `generic:${String(val)}`, rejected: false }
    })

    mockNormalizeFullDateForImport.mockImplementation((val: unknown) => {
      if (val === "2025") {
        return { value: null, rejected: false }
      }

      if (val === "2024-12-31" || val === "2025-01-01") {
        return { value: String(val), rejected: false }
      }

      return { value: `full:${String(val)}`, rejected: false }
    })

    setupMockHookState()

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    const hookConfig = mockUseBulkImportState.mock.calls[0][0]
    const transformed = hookConfig.transformRow({
      khoa_phong_quan_ly: "Khoa Noi",
      nguoi_dang_truc_tiep_quan_ly: "Nguyen Van A",
      tinh_trang_hien_tai: "Ngưng sử dụng",
      vi_tri_lap_dat: "Phong 101",
      ngay_dua_vao_su_dung: "2025",
      ngay_ngung_su_dung: "2024-12-31",
    })

    const validation = hookConfig.validateData([transformed])

    expect(validation.isValid).toBe(true)
    expect(validation.errors).toEqual([])
  })

  it("does not show the rejected-date warning for invalid ngay_ngung_su_dung values", async () => {
    mockNormalizeFullDateForImport.mockReturnValue({ value: null, rejected: true })

    const mockHandleFileChange = vi.fn(async () => {
      const hookConfig = mockUseBulkImportState.mock.calls[0][0]
      hookConfig.transformRow({ ngay_ngung_su_dung: 42 })
    })

    mockUseBulkImportState.mockImplementation(() => ({
      state: {
        status: "idle",
        selectedFile: null,
        parsedData: [],
        parseError: null,
        validationErrors: [],
      },
      fileInputRef: { current: null },
      handleFileChange: mockHandleFileChange,
      resetState: vi.fn(),
      setSubmitting: vi.fn(),
      setSuccess: vi.fn(),
      setSubmitError: vi.fn(),
    }))

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [createMockFile()] },
    })

    await waitFor(() => {
      expect(mockHandleFileChange).toHaveBeenCalledTimes(1)
    })

    expect(
      screen.queryByText(/ngày có định dạng không hợp lệ \(trước năm 1970\) đã bị bỏ qua/i)
    ).not.toBeInTheDocument()
  })

  it("should pass validateData function to hook", () => {
    setupMockHookState()

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(mockUseBulkImportState).toHaveBeenCalledWith(
      expect.objectContaining({
        validateData: expect.any(Function),
      })
    )
  })

  it("should pass acceptedExtensions to hook", () => {
    setupMockHookState()

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(mockUseBulkImportState).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptedExtensions: ".xlsx, .xls, .csv",
      })
    )
  })
})

describe("Multiple Equipment Import", () => {
  it("should handle multiple equipment records", async () => {
    const equipment1 = createMockEquipment({ ma_thiet_bi: "EQ001" })
    const equipment2 = createMockEquipment({ ma_thiet_bi: "EQ002" })
    const equipment3 = createMockEquipment({ ma_thiet_bi: "EQ003" })

    setupMockHookState({
      status: "parsed",
      selectedFile: createMockFile(),
      parsedData: [equipment1, equipment2, equipment3],
      parseError: null,
      validationErrors: [],
    })

    mockCallRpc.mockResolvedValue({
      success: true,
      inserted: 3,
      failed: 0,
      total: 3,
      details: [],
    })

    render(<ImportEquipmentDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)

    expect(screen.getByText("Nhap 3 thiet bi")).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("submit-button"))

    await waitFor(() => {
      const callArgs = mockCallRpc.mock.calls[0][0]
      expect(callArgs.args.p_items).toHaveLength(3)
    })
  })
})
