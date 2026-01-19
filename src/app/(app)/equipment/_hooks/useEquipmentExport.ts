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
import type { Equipment } from "../types"
import type { TenantBranding } from "@/hooks/use-tenant-branding"

export interface UseEquipmentExportParams {
  data: Equipment[]
  tenantBranding: TenantBranding | undefined
  userRole: string | undefined
}

export interface UseEquipmentExportReturn {
  handleDownloadTemplate: () => Promise<void>
  handleExportData: () => Promise<void>
  handleGenerateProfileSheet: (equipment: Equipment) => Promise<void>
  handleGenerateDeviceLabel: (equipment: Equipment) => Promise<void>
}

export function useEquipmentExport(params: UseEquipmentExportParams): UseEquipmentExportReturn {
  const { data, tenantBranding, userRole } = params
  const { toast } = useToast()

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

  const handleExportData = React.useCallback(async () => {
    const dataToExport = data
    if (dataToExport.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Không có dữ liệu phù hợp để xuất.",
      })
      return
    }

    try {
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
        description: `Đã tạo file ${fileName}`,
      })
    } catch (error) {
      console.error("Error exporting data:", error)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể xuất dữ liệu. Vui lòng thử lại.",
      })
    }
  }, [data, toast])

  return React.useMemo(
    () => ({
      handleDownloadTemplate,
      handleExportData,
      handleGenerateProfileSheet,
      handleGenerateDeviceLabel,
    }),
    [handleDownloadTemplate, handleExportData, handleGenerateProfileSheet, handleGenerateDeviceLabel]
  )
}
