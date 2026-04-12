import { format } from "date-fns"
import { vi } from "date-fns/locale"
import type { EquipmentDistributionData } from "@/hooks/use-equipment-distribution"
import type { MaintenanceStats } from "../hooks/use-maintenance-stats"
import type { UsageOverview, DailyUsageItem } from "../hooks/use-usage-analytics"
import type { InventoryItem, InventorySummary } from "../hooks/use-inventory-data"

export interface ExportReportDateRange {
  from: Date
  to: Date
}

type ExportArrayCell = string | number
type ExportArrayRow = ExportArrayCell[]
type ExportJsonValue = string | number | null
type ExportJsonRow = Record<string, ExportJsonValue>

type ExportJsonSheet = {
  name: string
  data: ExportJsonRow[]
  type: "json"
  columnWidths?: number[]
}

type ExportArraySheet = {
  name: string
  data: ExportArrayRow[]
  type: "array"
  columnWidths?: number[]
}

export type ExportSheet = ExportJsonSheet | ExportArraySheet

type StatisticsRow = Record<string, ExportJsonValue> & {
  "Khoa/Phòng": string
  "Nhập": number
  "Xuất": number
  "Tổng": number
}

type BuildExportSheetsArgs = {
  data: InventoryItem[]
  summary: InventorySummary
  dateRange: ExportReportDateRange
  department: string
  distribution?: EquipmentDistributionData
  maintenanceStats?: MaintenanceStats
  usageAnalytics?: { overview: UsageOverview; daily: DailyUsageItem[] }
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Thêm thủ công",
  excel: "Import Excel",
  transfer_internal: "Luân chuyển nội bộ",
  transfer_external: "Luân chuyển bên ngoài",
  liquidation: "Thanh lý",
}

const STATUS_LABELS: Record<string, string> = {
  hoat_dong: 'Hoạt động',
  cho_sua_chua: 'Chờ sửa chữa',
  cho_bao_tri: 'Chờ bảo trì',
  cho_hieu_chuan: 'Chờ HC/KĐ',
  ngung_su_dung: 'Ngừng sử dụng',
  chua_co_nhu_cau: 'Chưa có nhu cầu',
  khac: 'Khác',
}

function getSourceLabel(source: string) {
  return SOURCE_LABELS[source] || source
}

function mapStatusLabel(key: string) {
  return STATUS_LABELS[key] || key
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value * 1000) / total) / 10 : 0
}

function generateStatistics(rows: InventoryItem[]): StatisticsRow[] {
  const deptStats = new Map<string, { nhap: number; xuat: number; tong: number }>()

  rows.forEach((item) => {
    const dept = item.khoa_phong_quan_ly || "Chưa phân loại"
    if (!deptStats.has(dept)) {
      deptStats.set(dept, { nhap: 0, xuat: 0, tong: 0 })
    }

    const stats = deptStats.get(dept)
    if (!stats) {
      return
    }

    if (item.type === "import") stats.nhap += 1
    else stats.xuat += 1
    stats.tong = stats.nhap + stats.xuat
  })

  return Array.from(deptStats.entries())
    .map(([dept, stats]) => ({
      "Khoa/Phòng": dept,
      "Nhập": stats.nhap,
      "Xuất": stats.xuat,
      "Tổng": stats.tong,
    }))
    .sort((a, b) => b["Tổng"] - a["Tổng"])
}

function buildSummarySheet(
  summary: InventorySummary,
  dateRange: ExportReportDateRange,
  department: string
): ExportArraySheet {
  return {
    name: "Tổng quan",
    data: [
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
    ],
    type: "array",
    columnWidths: [25, 30],
  }
}

function buildDetailedTransactionsSheet(data: InventoryItem[]): ExportJsonSheet {
  return {
    name: "Chi tiết giao dịch",
    data: data.map((item) => ({
      "Ngày": format(new Date(item.ngay_nhap), "dd/MM/yyyy"),
      "Mã thiết bị": item.ma_thiet_bi,
      "Tên thiết bị": item.ten_thiet_bi,
      "Model": item.model || "",
      "Serial": item.serial || "",
      "Khoa/Phòng": item.khoa_phong_quan_ly || "Chưa phân loại",
      "Loại giao dịch": item.type === "import" ? "Nhập" : "Xuất",
      "Nguồn/Hình thức": getSourceLabel(item.source),
      "Lý do/Đích đến": item.reason || item.destination || "",
      "Giá trị": item.value ?? "",
    })),
    type: "json",
    columnWidths: [12, 15, 30, 15, 15, 20, 15, 20, 25, 15],
  }
}

function buildStatisticsSheet(data: InventoryItem[]): ExportJsonSheet {
  return {
    name: "Thống kê giao dịch",
    data: generateStatistics(data),
    type: "json",
    columnWidths: [25, 15, 15, 15],
  }
}

function buildDistributionSheets(distribution?: EquipmentDistributionData): ExportSheet[] {
  if (!distribution) {
    return []
  }

  const sheets: ExportSheet[] = []
  const total = distribution.totalEquipment || 0
  const totals = distribution.byDepartment.reduce(
    (acc, department) => {
      acc.hoat_dong += department.hoat_dong || 0
      acc.cho_sua_chua += department.cho_sua_chua || 0
      acc.cho_bao_tri += department.cho_bao_tri || 0
      acc.cho_hieu_chuan += department.cho_hieu_chuan || 0
      acc.ngung_su_dung += department.ngung_su_dung || 0
      acc.chua_co_nhu_cau += department.chua_co_nhu_cau || 0
      acc.khac += department.khac || 0
      return acc
    },
    { hoat_dong: 0, cho_sua_chua: 0, cho_bao_tri: 0, cho_hieu_chuan: 0, ngung_su_dung: 0, chua_co_nhu_cau: 0, khac: 0 },
  )

  sheets.push({
    name: "Phân bố trạng thái",
    data: [
      { "Trạng thái": mapStatusLabel("hoat_dong"), "Số lượng": totals.hoat_dong, "Tỷ lệ (%)": pct(totals.hoat_dong, total) },
      { "Trạng thái": mapStatusLabel("cho_sua_chua"), "Số lượng": totals.cho_sua_chua, "Tỷ lệ (%)": pct(totals.cho_sua_chua, total) },
      { "Trạng thái": mapStatusLabel("cho_bao_tri"), "Số lượng": totals.cho_bao_tri, "Tỷ lệ (%)": pct(totals.cho_bao_tri, total) },
      { "Trạng thái": mapStatusLabel("cho_hieu_chuan"), "Số lượng": totals.cho_hieu_chuan, "Tỷ lệ (%)": pct(totals.cho_hieu_chuan, total) },
      { "Trạng thái": mapStatusLabel("ngung_su_dung"), "Số lượng": totals.ngung_su_dung, "Tỷ lệ (%)": pct(totals.ngung_su_dung, total) },
      { "Trạng thái": mapStatusLabel("chua_co_nhu_cau"), "Số lượng": totals.chua_co_nhu_cau, "Tỷ lệ (%)": pct(totals.chua_co_nhu_cau, total) },
      { "Trạng thái": mapStatusLabel("khac"), "Số lượng": totals.khac, "Tỷ lệ (%)": pct(totals.khac, total) },
    ],
    type: "json",
    columnWidths: [28, 12, 12],
  })

  if (distribution.byDepartment.length > 0) {
    sheets.push({
      name: "Trạng thái theo khoa",
      data: distribution.byDepartment.map((department) => ({
        "Khoa/Phòng": department.name,
        "Hoạt động": department.hoat_dong,
        "Chờ sửa chữa": department.cho_sua_chua,
        "Chờ bảo trì": department.cho_bao_tri,
        "Chờ HC/KĐ": department.cho_hieu_chuan,
        "Ngừng sử dụng": department.ngung_su_dung,
        "Chưa có nhu cầu": department.chua_co_nhu_cau,
        "Khác": department.khac || 0,
        "Tổng": department.total,
      })),
      type: "json",
      columnWidths: [28, 12, 14, 12, 12, 14, 16, 10, 10],
    })
  }

  if (distribution.byLocation.length > 0) {
    sheets.push({
      name: "Trạng thái theo vị trí",
      data: distribution.byLocation.map((location) => ({
        "Vị trí": location.name,
        "Hoạt động": location.hoat_dong,
        "Chờ sửa chữa": location.cho_sua_chua,
        "Chờ bảo trì": location.cho_bao_tri,
        "Chờ HC/KĐ": location.cho_hieu_chuan,
        "Ngừng sử dụng": location.ngung_su_dung,
        "Chưa có nhu cầu": location.chua_co_nhu_cau,
        "Khác": location.khac || 0,
        "Tổng": location.total,
      })),
      type: "json",
      columnWidths: [24, 12, 14, 12, 12, 14, 16, 10, 10],
    })
  }

  return sheets
}

function buildMaintenanceSheets(maintenanceStats?: MaintenanceStats): ExportSheet[] {
  if (!maintenanceStats) {
    return []
  }

  return [
    {
      name: "Sửa chữa - Tổng quan",
      data: [
        { "Chỉ số": "Tổng YC sửa chữa", "Giá trị": maintenanceStats.repair_summary.total_requests },
        { "Chỉ số": "Hoàn thành", "Giá trị": maintenanceStats.repair_summary.completed },
        { "Chỉ số": "Đang xử lý", "Giá trị": maintenanceStats.repair_summary.in_progress },
        { "Chỉ số": "Chờ duyệt", "Giá trị": maintenanceStats.repair_summary.pending },
        { "Chỉ số": "Tổng chi phí sửa chữa", "Giá trị": maintenanceStats.repair_summary.total_cost },
        { "Chỉ số": "Chi phí TB ca hoàn thành", "Giá trị": maintenanceStats.repair_summary.average_completed_cost },
        { "Chỉ số": "Có ghi nhận chi phí", "Giá trị": maintenanceStats.repair_summary.cost_recorded_count },
        { "Chỉ số": "Thiếu chi phí", "Giá trị": maintenanceStats.repair_summary.cost_missing_count },
      ],
      type: "json",
      columnWidths: [30, 14],
    },
    {
      name: "Bảo trì - Tổng quan",
      data: [
        { "Chỉ số": "Kế hoạch bảo trì", "Giá trị": maintenanceStats.maintenance_summary.total_plans },
        { "Chỉ số": "Tổng công việc", "Giá trị": maintenanceStats.maintenance_summary.total_tasks },
        { "Chỉ số": "Hoàn thành", "Giá trị": maintenanceStats.maintenance_summary.completed_tasks },
      ],
      type: "json",
      columnWidths: [30, 14],
    },
  ]
}

function buildUsageSheets(
  usageAnalytics?: { overview: UsageOverview; daily: DailyUsageItem[] }
): ExportSheet[] {
  if (!usageAnalytics) {
    return []
  }

  return [
    {
      name: "Sử dụng TB - Tổng quan",
      data: [
        { "Chỉ số": "Phiên sử dụng (tổng)", "Giá trị": usageAnalytics.overview.total_sessions },
        { "Chỉ số": "Phiên đang hoạt động", "Giá trị": usageAnalytics.overview.active_sessions },
        { "Chỉ số": "Thời gian sử dụng (phút)", "Giá trị": usageAnalytics.overview.total_usage_time },
      ],
      type: "json",
      columnWidths: [36, 18],
    },
    {
      name: "Sử dụng TB - Theo ngày",
      data: (usageAnalytics.daily || []).map((item) => ({
        "Ngày": item.date,
        "Phiên": item.session_count,
        "Thời gian (phút)": item.total_usage_time,
        "Người dùng": item.unique_users,
        "Thiết bị": item.unique_equipment,
      })),
      type: "json",
      columnWidths: [14, 10, 16, 12, 12],
    },
  ]
}

export function buildExportSheets(args: BuildExportSheetsArgs): ExportSheet[] {
  const {
    data,
    summary,
    dateRange,
    department,
    distribution,
    maintenanceStats,
    usageAnalytics,
  } = args

  return [
    buildSummarySheet(summary, dateRange, department),
    buildDetailedTransactionsSheet(data),
    buildStatisticsSheet(data),
    ...buildDistributionSheets(distribution),
    ...buildMaintenanceSheets(maintenanceStats),
    ...buildUsageSheets(usageAnalytics),
  ]
}
