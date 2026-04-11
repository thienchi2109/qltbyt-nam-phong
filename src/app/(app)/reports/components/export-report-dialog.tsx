"use client"

import * as React from "react"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { createMultiSheetExcel } from "@/lib/excel-utils"
import { getUnknownErrorMessage } from "@/lib/error-utils"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { InventoryItem, InventorySummary } from "../hooks/use-inventory-data"
import type { EquipmentDistributionData } from "@/hooks/use-equipment-distribution"
import type { MaintenanceStats } from "../hooks/use-maintenance-stats"
import type { UsageOverview, DailyUsageItem } from "../hooks/use-usage-analytics"
import { buildExportSheets, type ExportReportDateRange } from "./export-report-dialog.utils"

interface ExportReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: InventoryItem[]
  summary: InventorySummary
  dateRange: ExportReportDateRange
  department: string
  distribution?: EquipmentDistributionData
  maintenanceStats?: MaintenanceStats
  usageAnalytics?: { overview: UsageOverview; daily: DailyUsageItem[] }
}

export function ExportReportDialog({
  open,
  onOpenChange,
  data,
  summary,
  dateRange,
  department,
  distribution,
  maintenanceStats,
  usageAnalytics,
}: ExportReportDialogProps) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = React.useState(false)
  const [fileName, setFileName] = React.useState("")

  // Generate default filename
  React.useEffect(() => {
    if (open) {
      const fromDate = format(dateRange.from, "dd-MM-yyyy")
      const toDate = format(dateRange.to, "dd-MM-yyyy")
      const defaultName = `BaoCao_TongHop_ThietBi_${fromDate}_${toDate}`
      setFileName(defaultName)
    }
  }, [open, dateRange])

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await createMultiSheetExcel(
        buildExportSheets({
          data,
          summary,
          dateRange,
          department,
          distribution,
          maintenanceStats,
          usageAnalytics,
        }),
        fileName
      )

      toast({
        title: "Xuất báo cáo thành công",
        description: `Đã tạo file ${fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`}`,
      })

      onOpenChange(false)
    } catch (error: unknown) {
      console.error('Export error:', error)
      toast({
        variant: "destructive",
        title: "Lỗi xuất báo cáo",
        description: getUnknownErrorMessage(error, "Không thể xuất báo cáo"),
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Xuất báo cáo Excel
          </DialogTitle>
          <DialogDescription>
            Xuất báo cáo tổng hợp thiết bị ra file Excel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Khoảng thời gian:</span>
              <Badge variant="outline">
                {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Khoa/Phòng:</span>
              <Badge variant="outline">{department === "all" ? "Tất cả" : department}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Số bản ghi:</span>
              <Badge>{data.length} giao dịch</Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{summary.totalImported}</div>
              <div className="text-sm text-muted-foreground">Thiết bị nhập</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">{summary.totalExported}</div>
              <div className="text-sm text-muted-foreground">Thiết bị xuất</div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="filename">Tên file</Label>
            <Input
              id="filename"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Nhập tên file..."
            />
            <p className="text-xs text-muted-foreground">File sẽ được lưu với định dạng .xlsx</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Hủy
          </Button>
          <Button onClick={handleExport} disabled={isExporting || !fileName.trim()}>
            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Đang xuất..." : "Xuất Excel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
