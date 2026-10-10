import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import {
  createDefaultParams,
  createDefaultFilterParams,
  mockEquipmentList,
  mockGenerateEquipmentImportTemplate,
  mockDownloadBlob,
  mockExportToExcel,
  mockCallRpc,
  mockToast,
} from "./useEquipmentExport.fixtures"
import { useEquipmentExport } from "../_hooks/useEquipmentExport"

describe("handleDownloadTemplate", () => {
  it("should download template successfully", async () => {
    const mockBlob = new Blob(["test"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    mockGenerateEquipmentImportTemplate.mockResolvedValueOnce(mockBlob)

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

    await act(async () => {
      await result.current.handleDownloadTemplate()
    })

    expect(mockGenerateEquipmentImportTemplate).toHaveBeenCalled()
    expect(mockDownloadBlob).toHaveBeenCalledWith(mockBlob, "Mau_Nhap_Thiet_Bi.xlsx")
  })

  it("should handle template download error", async () => {
    mockGenerateEquipmentImportTemplate.mockRejectedValueOnce(
      new Error("Template generation failed")
    )

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

    await act(async () => {
      await result.current.handleDownloadTemplate()
    })

    expect(mockToast).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Lỗi",
      description: "Không thể tải template. Vui lòng thử lại.",
    })
  })
})

describe("handleExportData", () => {
  it("should fetch all data and export to Excel successfully", async () => {
    mockExportToExcel.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

    await act(async () => {
      await result.current.handleExportData()
    })

    // Should call RPC with p_page_size = 10000 (MAX_EXPORT_PAGE_SIZE)
    expect(mockCallRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "equipment_list_enhanced",
        args: expect.objectContaining({
          p_page_size: 10000,
          p_page: 1,
        }),
      })
    )
    expect(mockExportToExcel).toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Xuất dữ liệu thành công",
      })
    )
  })

  it("should show error when total is 0", async () => {
    const { result } = renderHook(() => useEquipmentExport(createDefaultParams({ total: 0 })))

    await act(async () => {
      await result.current.handleExportData()
    })

    expect(mockCallRpc).not.toHaveBeenCalled()
    expect(mockExportToExcel).not.toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Không có dữ liệu",
      description: "Không có dữ liệu phù hợp để xuất.",
    })
  })

  it("should handle export error", async () => {
    mockExportToExcel.mockRejectedValueOnce(new Error("Export failed"))

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

    await act(async () => {
      await result.current.handleExportData()
    })

    expect(mockToast).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Lỗi",
      description: "Không thể xuất dữ liệu. Vui lòng thử lại.",
    })
  })

  it("should generate correct filename with date", async () => {
    mockExportToExcel.mockResolvedValueOnce(undefined)
    const today = new Date().toISOString().slice(0, 10)

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

    await act(async () => {
      await result.current.handleExportData()
    })

    expect(mockExportToExcel).toHaveBeenCalledWith(
      expect.any(Array),
      `Danh_sach_thiet_bi_${today}.xlsx`,
      "Danh sách thiết bị",
      expect.any(Array)
    )
  })

  it("should format data correctly for export", async () => {
    mockExportToExcel.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

    await act(async () => {
      await result.current.handleExportData()
    })

    const exportCall = mockExportToExcel.mock.calls[0]
    const formattedData = exportCall[0]

    // Should have same number of rows as data
    expect(formattedData).toHaveLength(2)

    // Each row should have column labels as keys
    expect(formattedData[0]).toHaveProperty("Mã thiết bị")
    expect(formattedData[0]).toHaveProperty("Tên thiết bị")
  })

  it("should include Ngày ngừng sử dụng in the exported column set", async () => {
    mockExportToExcel.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

    await act(async () => {
      await result.current.handleExportData()
    })

    const exportCall = mockExportToExcel.mock.calls[0]
    const formattedData = exportCall[0]

    expect(formattedData[0]).toHaveProperty("Ngày ngừng sử dụng")
    expect(formattedData[1]).toHaveProperty("Ngày ngừng sử dụng")
    expect(formattedData[1]["Ngày ngừng sử dụng"]).toBe("2024-12-31")
  })
})

describe("Memoization", () => {
  it("should maintain stable handler references", () => {
    const { result, rerender } = renderHook(() => useEquipmentExport(createDefaultParams()))

    const initialHandlers = {
      handleDownloadTemplate: result.current.handleDownloadTemplate,
      handleExportData: result.current.handleExportData,
      handleGenerateProfileSheet: result.current.handleGenerateProfileSheet,
      handleGenerateDeviceLabel: result.current.handleGenerateDeviceLabel,
    }

    rerender()

    // Handlers should be stable (memoized) when params don't change
    expect(result.current.handleDownloadTemplate).toBe(initialHandlers.handleDownloadTemplate)
    expect(result.current.handleGenerateProfileSheet).toBe(
      initialHandlers.handleGenerateProfileSheet
    )
    expect(result.current.handleGenerateDeviceLabel).toBe(initialHandlers.handleGenerateDeviceLabel)
  })

  it("should update handlers when filterParams change", () => {
    const initialFilterParams = createDefaultFilterParams()
    const { result, rerender } = renderHook(
      ({ filterParams }: { filterParams: ExportFilterParams }) =>
        useEquipmentExport(createDefaultParams({ filterParams })),
      { initialProps: { filterParams: initialFilterParams } }
    )

    const initialExportHandler = result.current.handleExportData

    // Change filterParams
    rerender({ filterParams: createDefaultFilterParams({ debouncedSearch: "máy thở" }) })

    // handleExportData should change when filterParams changes
    expect(result.current.handleExportData).not.toBe(initialExportHandler)
  })
})

describe("Edge Cases", () => {
  it("should handle equipment with null/undefined fields from RPC", async () => {
    const equipmentWithNulls = [
      {
        id: 1,
        ma_thiet_bi: "EQ-001",
        ten_thiet_bi: "Test",
        model: null,
        serial: undefined,
        don_vi: 5,
      },
    ]
    mockCallRpc.mockResolvedValueOnce({ data: equipmentWithNulls, total: 1 })
    mockExportToExcel.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams({ total: 1 })))

    await act(async () => {
      await result.current.handleExportData()
    })

    expect(mockExportToExcel).toHaveBeenCalled()
    // Should not throw error with null/undefined fields
  })

  it("should handle large dataset export with warning toast", async () => {
    const largeDataset = Array.from({ length: 6000 }, (_, i) => ({
      id: i + 1,
      ma_thiet_bi: `EQ-${String(i + 1).padStart(4, "0")}`,
      ten_thiet_bi: `Equipment ${i + 1}`,
      don_vi: 5,
    }))
    mockCallRpc.mockResolvedValueOnce({ data: largeDataset, total: 6000 })
    mockExportToExcel.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams({ total: 6000 })))

    await act(async () => {
      await result.current.handleExportData()
    })

    // Should show warning toast for large dataset (>5000)
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "⚠️ Danh sách lớn",
      })
    )
    expect(mockExportToExcel).toHaveBeenCalled()
  })
})
