import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import {
  createDefaultParams,
  createDefaultFilterParams,
  mockEquipmentList,
  mockExportToExcel,
  mockCallRpc,
  mockToast,
} from "./useEquipmentExport.fixtures"
import { useEquipmentExport } from "../_hooks/useEquipmentExport"

describe("Full Export Flow (Issue #170)", () => {
  it("requests department ordering when exporting all equipment without a department filter", async () => {
    mockExportToExcel.mockResolvedValueOnce(undefined)
    const filterParams = createDefaultFilterParams({ selectedDepartments: [] })

    const { result } = renderHook(() =>
      useEquipmentExport(createDefaultParams({ total: 1948, filterParams }))
    )

    await act(async () => {
      await result.current.handleExportData()
    })

    expect(mockCallRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "equipment_list_enhanced",
        args: expect.objectContaining({
          p_don_vi: 5,
          p_khoa_phong_array: null,
          p_sort: "khoa_phong_quan_ly.asc",
        }),
      })
    )
  })

  it("requests department ordering when exporting multiple selected departments", async () => {
    mockExportToExcel.mockResolvedValueOnce(undefined)
    const filterParams = createDefaultFilterParams({
      selectedDepartments: ["ICU", "Gây Mê Hồi Sức"],
    })

    const { result } = renderHook(() =>
      useEquipmentExport(createDefaultParams({ total: 468, filterParams }))
    )

    await act(async () => {
      await result.current.handleExportData()
    })

    expect(mockCallRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "equipment_list_enhanced",
        args: expect.objectContaining({
          p_khoa_phong_array: ["ICU", "Gây Mê Hồi Sức"],
          p_sort: "khoa_phong_quan_ly.asc",
        }),
      })
    )
  })

  it("should fetch ALL equipment with filters, not just current page", async () => {
    mockExportToExcel.mockResolvedValueOnce(undefined)
    const filterParams = createDefaultFilterParams({
      debouncedSearch: "máy thở",
      selectedDepartments: ["Khoa Nội"],
      selectedStatuses: ["Hoạt động"],
    })

    const { result } = renderHook(() =>
      useEquipmentExport(createDefaultParams({ total: 156, filterParams }))
    )

    await act(async () => {
      await result.current.handleExportData()
    })

    // Should call RPC with same filters but large page size
    expect(mockCallRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "equipment_list_enhanced",
        args: expect.objectContaining({
          p_q: "máy thở",
          p_khoa_phong_array: ["Khoa Nội"],
          p_tinh_trang_array: ["Hoạt động"],
          p_page_size: 10000,
          p_page: 1,
        }),
      })
    )
  })

  it("should show confirmation toast with count before export", async () => {
    mockExportToExcel.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams({ total: 156 })))

    await act(async () => {
      await result.current.handleExportData()
    })

    // First toast should be confirmation with count
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "📥 Chuẩn bị tải xuống",
        description: expect.stringContaining("156"),
      })
    )
  })

  it("should show active filters in confirmation toast", async () => {
    mockExportToExcel.mockResolvedValueOnce(undefined)
    const filterParams = createDefaultFilterParams({
      debouncedSearch: "máy thở",
      selectedDepartments: ["Khoa Nội"],
    })

    const { result } = renderHook(() =>
      useEquipmentExport(createDefaultParams({ total: 50, filterParams }))
    )

    await act(async () => {
      await result.current.handleExportData()
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringMatching(/máy thở.*Khoa Nội|Khoa Nội.*máy thở/s),
      })
    )
  })

  it("should set isExporting state during export", async () => {
    // Make the export take some time
    mockCallRpc.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: mockEquipmentList, total: 2 }), 50)
        )
    )
    mockExportToExcel.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

    expect(result.current.isExporting).toBe(false)

    let exportPromise: Promise<void>
    act(() => {
      exportPromise = result.current.handleExportData()
    })

    // isExporting should be true during fetch
    expect(result.current.isExporting).toBe(true)

    await act(async () => {
      await exportPromise
    })

    // isExporting should be false after completion
    expect(result.current.isExporting).toBe(false)
  })

  it("should handle RPC fetch error gracefully", async () => {
    mockCallRpc.mockRejectedValueOnce(new Error("Network error"))

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams()))

    await act(async () => {
      await result.current.handleExportData()
    })

    expect(mockToast).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Lỗi",
      description: "Không thể xuất dữ liệu. Vui lòng thử lại.",
    })
    expect(result.current.isExporting).toBe(false)
  })

  it("should handle empty RPC response", async () => {
    mockCallRpc.mockResolvedValueOnce({ data: [], total: 0 })

    const { result } = renderHook(() => useEquipmentExport(createDefaultParams({ total: 5 })))

    await act(async () => {
      await result.current.handleExportData()
    })

    expect(mockToast).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Không có dữ liệu",
      description: "Không thể lấy dữ liệu để xuất. Vui lòng thử lại.",
    })
  })
})
