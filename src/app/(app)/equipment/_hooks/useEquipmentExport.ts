"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { exportToExcel, generateEquipmentImportTemplate } from "@/lib/excel-utils"
import {
  generateProfileSheet,
  generateDeviceLabel,
  type PrintContext,
} from "@/components/equipment/equipment-print-utils"
import { columnLabels } from "@/components/equipment/equipment-table-columns"
import { callRpc } from "@/lib/rpc-client"
import type { Equipment, EquipmentListResponse } from "../types"
import type { TenantBranding } from "@/hooks/use-tenant-branding"

/** Maximum items to export in a single request */
const MAX_EXPORT_PAGE_SIZE = 10000

/** Threshold for showing large dataset warning */
const LARGE_DATASET_WARNING_THRESHOLD = 5000

export interface ExportFilterParams {
  debouncedSearch: string
  sortParam: string
  effectiveSelectedDonVi: number | null
  selectedDepartments: string[]
  selectedUsers: string[]
  selectedLocations: string[]
  selectedStatuses: string[]
  selectedClassifications: string[]
  selectedFundingSources: string[]
}

export interface UseEquipmentExportParams {
  /** Total count of items matching current filter (from useEquipmentData) */
  total: number
  /** Filter parameters for fetching full export data */
  filterParams: ExportFilterParams
  tenantBranding: TenantBranding | undefined
  userRole: string | undefined
}

export interface UseEquipmentExportReturn {
  handleDownloadTemplate: () => Promise<void>
  handleExportData: () => Promise<void>
  handleGenerateProfileSheet: (equipment: Equipment) => Promise<void>
  handleGenerateDeviceLabel: (equipment: Equipment) => Promise<void>
  /** Whether export is currently in progress */
  isExporting: boolean
}

export function useEquipmentExport(params: UseEquipmentExportParams): UseEquipmentExportReturn {
  const { total, filterParams, tenantBranding, userRole } = params
  const { toast } = useToast()
  const [isExporting, setIsExporting] = React.useState(false)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  // Cleanup on unmount: cancel any in-flight export
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleDownloadTemplate = React.useCallback(async () => {
    try {
      const blob = await generateEquipmentImportTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "Mau_Nhap_Thiet_Bi.xlsx"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading template:", error)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể tải template. Vui lòng thử lại.",
      })
    }
  }, [toast])

  const handleGenerateProfileSheet = React.useCallback(
    async (equipment: Equipment) => {
      const printContext: PrintContext = {
        tenantBranding,
        userRole,
        equipmentTenantId: equipment.don_vi ?? undefined,
      }
      await generateProfileSheet(equipment, printContext)
    },
    [tenantBranding, userRole]
  )

  const handleGenerateDeviceLabel = React.useCallback(
    async (equipment: Equipment) => {
      const printContext: PrintContext = {
        tenantBranding,
        userRole,
        equipmentTenantId: equipment.don_vi ?? undefined,
      }
      await generateDeviceLabel(equipment, printContext)
    },
    [tenantBranding, userRole]
  )

  /**
   * Format active filters for display in confirmation toast
   */
  const formatActiveFilters = React.useCallback((): string[] => {
    const activeFilters: string[] = []
    const {
      debouncedSearch,
      selectedDepartments,
      selectedUsers,
      selectedLocations,
      selectedStatuses,
      selectedClassifications,
      selectedFundingSources,
    } = filterParams

    if (debouncedSearch) {
      activeFilters.push(`Tìm kiếm: "${debouncedSearch}"`)
    }
    if (selectedDepartments.length > 0) {
      activeFilters.push(`Khoa/Phòng: ${selectedDepartments.join(", ")}`)
    }
    if (selectedStatuses.length > 0) {
      activeFilters.push(`Tình trạng: ${selectedStatuses.join(", ")}`)
    }
    if (selectedUsers.length > 0) {
      activeFilters.push(`Người sử dụng: ${selectedUsers.join(", ")}`)
    }
    if (selectedLocations.length > 0) {
      activeFilters.push(`Vị trí: ${selectedLocations.join(", ")}`)
    }
    if (selectedClassifications.length > 0) {
      activeFilters.push(`Phân loại: ${selectedClassifications.join(", ")}`)
    }
    if (selectedFundingSources.length > 0) {
      activeFilters.push(`Nguồn kinh phí: ${selectedFundingSources.join(", ")}`)
    }

    return activeFilters
  }, [filterParams])

  /**
   * Fetch all equipment matching current filters for export
   */
  const fetchAllEquipmentForExport = React.useCallback(async (signal?: AbortSignal): Promise<Equipment[]> => {
    const {
      debouncedSearch,
      sortParam,
      effectiveSelectedDonVi,
      selectedDepartments,
      selectedUsers,
      selectedLocations,
      selectedStatuses,
      selectedClassifications,
      selectedFundingSources,
    } = filterParams

    const result = await callRpc<EquipmentListResponse>({
      fn: "equipment_list_enhanced",
      args: {
        p_q: debouncedSearch || null,
        p_sort: sortParam,
        p_page: 1,
        p_page_size: MAX_EXPORT_PAGE_SIZE,
        p_don_vi: effectiveSelectedDonVi,
        p_khoa_phong_array: selectedDepartments.length > 0 ? selectedDepartments : null,
        p_nguoi_su_dung_array: selectedUsers.length > 0 ? selectedUsers : null,
        p_vi_tri_lap_dat_array: selectedLocations.length > 0 ? selectedLocations : null,
        p_tinh_trang_array: selectedStatuses.length > 0 ? selectedStatuses : null,
        p_phan_loai_array: selectedClassifications.length > 0 ? selectedClassifications : null,
        p_nguon_kinh_phi_array: selectedFundingSources.length > 0 ? selectedFundingSources : null,
      },
      signal,
    })

    return result?.data ?? []
  }, [filterParams])

  const handleExportData = React.useCallback(async () => {
    // Check if there's data to export
    if (total === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Không có dữ liệu phù hợp để xuất.",
      })
      return
    }

    // Calculate actual export count (capped at MAX_EXPORT_PAGE_SIZE)
    const exportCount = Math.min(total, MAX_EXPORT_PAGE_SIZE)
    const isCapped = total > MAX_EXPORT_PAGE_SIZE

    // Show confirmation toast with count and active filters
    const activeFilters = formatActiveFilters()
    const filterSummary = activeFilters.length > 0
      ? `\nVới bộ lọc:\n• ${activeFilters.join("\n• ")}`
      : " (không có bộ lọc)"

    // Show warning for large datasets
    if (total > LARGE_DATASET_WARNING_THRESHOLD) {
      const cappedWarning = isCapped 
        ? `\n⚠️ Giới hạn tối đa ${MAX_EXPORT_PAGE_SIZE.toLocaleString("vi-VN")} thiết bị/lần. Tổng ${total.toLocaleString("vi-VN")} thiết bị sẽ chỉ xuất ${exportCount.toLocaleString("vi-VN")} đầu tiên.`
        : ""
      toast({
        variant: "default",
        title: "⚠️ Danh sách lớn",
        description: `Sẽ tải ${exportCount.toLocaleString("vi-VN")} thiết bị. Quá trình này có thể mất vài giây.${filterSummary}${cappedWarning}`,
        duration: 5000,
      })
    } else {
      toast({
        variant: "default",
        title: "📥 Chuẩn bị tải xuống",
        description: `Sẽ tải ${exportCount.toLocaleString("vi-VN")} thiết bị${filterSummary}`,
        duration: 3000,
      })
    }

    setIsExporting(true)

    // Create AbortController for this export operation
    abortControllerRef.current = new AbortController()

    try {
      // Fetch all data matching current filters
      const dataToExport = await fetchAllEquipmentForExport(abortControllerRef.current.signal)

      if (dataToExport.length === 0) {
        toast({
          variant: "destructive",
          title: "Không có dữ liệu",
          description: "Không thể lấy dữ liệu để xuất. Vui lòng thử lại.",
        })
        return
      }

      const dbKeysInOrder = (Object.keys(columnLabels) as Array<keyof Equipment>).filter(
        (key) => key !== "id"
      )
      const headers = dbKeysInOrder.map((key) => columnLabels[key])

      const formattedData = dataToExport.map((item) => {
        const rowData: Record<string, unknown> = {}
        dbKeysInOrder.forEach((key) => {
          const header = columnLabels[key]
          const value = item[key]
          // Sanitize to prevent CSV/Excel formula injection
          const sanitizedValue =
            typeof value === "string" && /^[=+\-@]/.test(value)
              ? `'${value}`
              : value ?? ""
          rowData[header] = sanitizedValue
        })
        return rowData
      })

      const colWidths = headers.map((header) => Math.max(header.length, 20))
      const fileName = `Danh_sach_thiet_bi_${new Date().toISOString().slice(0, 10)}.xlsx`

      await exportToExcel(formattedData, fileName, "Danh sách thiết bị", colWidths)

      toast({
        title: "Xuất dữ liệu thành công",
        description: `Đã tạo file ${fileName} với ${dataToExport.length.toLocaleString("vi-VN")} thiết bị`,
      })
    } catch (error) {
      // Don't show error toast if the request was aborted (component unmounted)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("Export aborted - component unmounted")
        return
      }
      console.error("Error exporting data:", error)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể xuất dữ liệu. Vui lòng thử lại.",
      })
    } finally {
      abortControllerRef.current = null
      setIsExporting(false)
    }
  }, [total, filterParams, formatActiveFilters, fetchAllEquipmentForExport, toast])

  return React.useMemo(
    () => ({
      handleDownloadTemplate,
      handleExportData,
      handleGenerateProfileSheet,
      handleGenerateDeviceLabel,
      isExporting,
    }),
    [handleDownloadTemplate, handleExportData, handleGenerateProfileSheet, handleGenerateDeviceLabel, isExporting]
  )
}
