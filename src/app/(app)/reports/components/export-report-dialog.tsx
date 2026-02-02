"use client"

import * as React from "react"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { createMultiSheetExcel } from "@/lib/excel-utils"
import { parseLocalDate } from "@/lib/date-utils"

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

interface DateRange {
  from: Date
  to: Date
}

interface ExportReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: InventoryItem[]
  summary: InventorySummary
  dateRange: DateRange
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
      // Prepare summary sheet (array of arrays)
      const summaryData: (string | number)[][] = [
        ["BÁO CÁO TỔNG HỢP THIẾT BỊ"],
        [""],
        ["Thời gian:", `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`],
        ["Khoa/Phòng:", department === "all" ? "Tất cả" : department],
        ["Ngày xuất báo cáo:", format(new Date(), "dd/MM/yyyy HH:mm", { locale: vi })],
        [""],
        ["TỔNG QUAN"],
        ["Thiết bị nhập:", summary.totalImported],
        ["Thiết bị xuất:", summary.totalExported],
        ["Tồn kho hiện tại:", summary.currentStock],
        ["Biến động thuần:", summary.netChange >= 0 ? `+${summary.netChange}` : summary.netChange],
        [""],
        ["CHI TIẾT GIAO DỊCH"],
      ]

      // Prepare detailed data (JSON rows)
      const detailedData = data.map(item => ({
        "Ngày": format(parseLocalDate(item.ngay_nhap) ?? new Date(), "dd/MM/yyyy"),
        "Mã thiết bị": item.ma_thiet_bi,
        "Tên thiết bị": item.ten_thiet_bi,
        "Model": item.model || "",
        "Serial": item.serial || "",
        "Khoa/Phòng": item.khoa_phong_quan_ly || "Chưa phân loại",
        "Loại giao dịch": item.type === "import" ? "Nhập" : "Xuất",
        "Nguồn/Hình thức": getSourceLabel(item.source),
        "Lý do/Đích đến": item.reason || item.destination || "",
        "Giá trị": item.value ?? "",
      }))

      // Transactional statistics per department
      const statsData = generateStatistics(data)

      // Status distribution sheets (optional)
      const statusSheets: Array<{ name: string; data: any[] | any[][]; type: 'json' | 'array'; columnWidths?: number[] }> = []
      const extraSheets: Array<{ name: string; data: any[] | any[][]; type: 'json' | 'array'; columnWidths?: number[] }> = []

      if (distribution) {
        const total = distribution.totalEquipment || 0

        // Build overview rows from aggregated department sums
        const totals = distribution.byDepartment.reduce(
          (acc, d) => {
            acc.hoat_dong += d.hoat_dong || 0
            acc.cho_sua_chua += d.cho_sua_chua || 0
            acc.cho_bao_tri += d.cho_bao_tri || 0
            acc.cho_hieu_chuan += d.cho_hieu_chuan || 0
            acc.ngung_su_dung += d.ngung_su_dung || 0
            acc.chua_co_nhu_cau += d.chua_co_nhu_cau || 0
            return acc
          },
          { hoat_dong: 0, cho_sua_chua: 0, cho_bao_tri: 0, cho_hieu_chuan: 0, ngung_su_dung: 0, chua_co_nhu_cau: 0 },
        )

        const statusOverview = [
          { "Trạng thái": mapStatusLabel("hoat_dong"), "Số lượng": totals.hoat_dong, "Tỷ lệ (%)": pct(totals.hoat_dong, total) },
          { "Trạng thái": mapStatusLabel("cho_sua_chua"), "Số lượng": totals.cho_sua_chua, "Tỷ lệ (%)": pct(totals.cho_sua_chua, total) },
          { "Trạng thái": mapStatusLabel("cho_bao_tri"), "Số lượng": totals.cho_bao_tri, "Tỷ lệ (%)": pct(totals.cho_bao_tri, total) },
          { "Trạng thái": mapStatusLabel("cho_hieu_chuan"), "Số lượng": totals.cho_hieu_chuan, "Tỷ lệ (%)": pct(totals.cho_hieu_chuan, total) },
          { "Trạng thái": mapStatusLabel("ngung_su_dung"), "Số lượng": totals.ngung_su_dung, "Tỷ lệ (%)": pct(totals.ngung_su_dung, total) },
          { "Trạng thái": mapStatusLabel("chua_co_nhu_cau"), "Số lượng": totals.chua_co_nhu_cau, "Tỷ lệ (%)": pct(totals.chua_co_nhu_cau, total) },
        ]

        statusSheets.push({
          name: "Phân bố trạng thái",
          data: statusOverview,
          type: "json",
          columnWidths: [28, 12, 12],
        })

        if (distribution.byDepartment.length > 0) {
          const byDept = distribution.byDepartment.map(d => ({
            "Khoa/Phòng": d.name,
            "Hoạt động": d.hoat_dong,
            "Chờ sửa chữa": d.cho_sua_chua,
            "Chờ bảo trì": d.cho_bao_tri,
            "Chờ HC/KĐ": d.cho_hieu_chuan,
            "Ngừng sử dụng": d.ngung_su_dung,
            "Chưa có nhu cầu": d.chua_co_nhu_cau,
            "Tổng": d.total,
          }))
          statusSheets.push({
            name: "Trạng thái theo khoa",
            data: byDept,
            type: "json",
            columnWidths: [28, 12, 14, 12, 12, 14, 16, 10],
          })
        }

        if (distribution.byLocation.length > 0) {
          const byLoc = distribution.byLocation.map(l => ({
            "Vị trí": l.name,
            "Hoạt động": l.hoat_dong,
            "Chờ sửa chữa": l.cho_sua_chua,
            "Chờ bảo trì": l.cho_bao_tri,
            "Chờ HC/KĐ": l.cho_hieu_chuan,
            "Ngừng sử dụng": l.ngung_su_dung,
            "Chưa có nhu cầu": l.chua_co_nhu_cau,
            "Tổng": l.total,
          }))
          statusSheets.push({
            name: "Trạng thái theo vị trí",
            data: byLoc,
            type: "json",
            columnWidths: [24, 12, 14, 12, 12, 14, 16, 10],
          })
        }
      }

      // Maintenance/Repairs summary sheets (optional)
      if (maintenanceStats) {
        const repairRows = [
          { "Chỉ số": "Tổng YC sửa chữa", "Giá trị": maintenanceStats.repair_summary.total_requests },
          { "Chỉ số": "Hoàn thành", "Giá trị": maintenanceStats.repair_summary.completed },
          { "Chỉ số": "Đang xử lý", "Giá trị": maintenanceStats.repair_summary.in_progress },
          { "Chỉ số": "Chờ duyệt", "Giá trị": maintenanceStats.repair_summary.pending },
        ]
        extraSheets.push({ name: "Sửa chữa - Tổng quan", data: repairRows, type: "json", columnWidths: [30, 14] })

        const maintenanceRows = [
          { "Chỉ số": "Kế hoạch bảo trì", "Giá trị": maintenanceStats.maintenance_summary.total_plans },
          { "Chỉ số": "Tổng công việc", "Giá trị": maintenanceStats.maintenance_summary.total_tasks },
          { "Chỉ số": "Hoàn thành", "Giá trị": maintenanceStats.maintenance_summary.completed_tasks },
        ]
        extraSheets.push({ name: "Bảo trì - Tổng quan", data: maintenanceRows, type: "json", columnWidths: [30, 14] })
      }

      // Usage analytics sheets (optional)
      if (usageAnalytics) {
        const overview = [
          { "Chỉ số": "Phiên sử dụng (tổng)", "Giá trị": usageAnalytics.overview.total_sessions },
          { "Chỉ số": "Phiên đang hoạt động", "Giá trị": usageAnalytics.overview.active_sessions },
          { "Chỉ số": "Thời gian sử dụng (phút)", "Giá trị": usageAnalytics.overview.total_usage_time },
        ]
        extraSheets.push({ name: "Sử dụng TB - Tổng quan", data: overview, type: "json", columnWidths: [36, 18] })

        const daily = (usageAnalytics.daily || []).map(item => ({
          "Ngày": item.date,
          "Phiên": item.session_count,
          "Thời gian (phút)": item.total_usage_time,
          "Người dùng": item.unique_users,
          "Thiết bị": item.unique_equipment,
        }))
        extraSheets.push({ name: "Sử dụng TB - Theo ngày", data: daily, type: "json", columnWidths: [14, 10, 16, 12, 12] })
      }

      // Create multi-sheet Excel file
      await createMultiSheetExcel([
        {
          name: "Tổng quan",
          data: summaryData,
          type: "array",
          columnWidths: [25, 30],
        },
        {
          name: "Chi tiết giao dịch",
          data: detailedData,
          type: "json",
          columnWidths: [12, 15, 30, 15, 15, 20, 15, 20, 25, 15],
        },
        {
          name: "Thống kê giao dịch",
          data: statsData,
          type: "json",
          columnWidths: [25, 15, 15, 15],
        },
        ...statusSheets,
        ...extraSheets,
      ], fileName)

      toast({
        title: "Xuất báo cáo thành công",
        description: `Đã tạo file ${fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`}`,
      })

      onOpenChange(false)
    } catch (error: any) {
      console.error('Export error:', error)
      toast({
        variant: "destructive",
        title: "Lỗi xuất báo cáo",
        description: error?.message || "Không thể xuất báo cáo",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      manual: "Thêm thủ công",
      excel: "Import Excel",
      transfer_internal: "Luân chuyển nội bộ",
      transfer_external: "Luân chuyển bên ngoài",
      liquidation: "Thanh lý",
    }
    return labels[source] || source
  }

  const mapStatusLabel = (key: string) => {
    const labels: Record<string, string> = {
      hoat_dong: 'Hoạt động',
      cho_sua_chua: 'Chờ sửa chữa',
      cho_bao_tri: 'Chờ bảo trì',
      cho_hieu_chuan: 'Chờ HC/KĐ',
      ngung_su_dung: 'Ngừng sử dụng',
      chua_co_nhu_cau: 'Chưa có nhu cầu',
      khac: 'Khác',
    }
    return labels[key] || key
  }

  const pct = (n: number, total: number) => (total > 0 ? Math.round((n * 1000) / total) / 10 : 0)

  const generateStatistics = (rows: InventoryItem[]) => {
    const deptStats = new Map<string, { nhap: number; xuat: number; tong: number }>()
    rows.forEach(item => {
      const dept = item.khoa_phong_quan_ly || "Chưa phân loại"
      if (!deptStats.has(dept)) {
        deptStats.set(dept, { nhap: 0, xuat: 0, tong: 0 })
      }
      const s = deptStats.get(dept)!
      if (item.type === "import") s.nhap += 1
      else s.xuat += 1
      s.tong = s.nhap + s.xuat
    })
    return Array.from(deptStats.entries()).map(([dept, s]) => ({
      "Khoa/Phòng": dept,
      "Nhập": s.nhap,
      "Xuất": s.xuat,
      "Tổng": s.tong,
    })).sort((a, b) => b["Tổng"] - a["Tổng"]) as any[]
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
