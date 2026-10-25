import { format } from "date-fns"
import {
  getEquipmentDistributionStatusCounts,
  buildEquipmentDistributionStatusRows,
  getEquipmentDistributionGroupCounts,
} from "@/components/equipment-distribution-summary.utils"
import { STATUS_LABELS as LEGACY_STATUS_LABELS } from "@/hooks/use-equipment-distribution"
import type { EquipmentDistributionData } from "@/hooks/use-equipment-distribution"
import type { MaintenanceStats } from "../hooks/use-maintenance-stats"
import type { UsageOverview, DailyUsageItem } from "../hooks/use-usage-analytics"
import type { InventoryItem, InventorySummary } from "../hooks/use-inventory-data"
import type { MultiSheetExcelPresentation } from "@/lib/excel-utils"
import { addReportPresentation, type ExportReportScope } from "./export-report-dialog.presentation"

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
  headers?: string[]
  presentation?: MultiSheetExcelPresentation
}

type ExportArraySheet = {
  name: string
  data: ExportArrayRow[]
  type: "array"
  columnWidths?: number[]
  headers?: string[]
  presentation?: MultiSheetExcelPresentation
}

export type ExportSheet = ExportJsonSheet | ExportArraySheet

type StatisticsRow = Record<string, ExportJsonValue> & {
  "Khoa/Phòng": string
  Nhập: number
  Xuất: number
  Tổng: number
}

type BuildExportSheetsArgs = {
  data: InventoryItem[]
  summary: InventorySummary
  dateRange: ExportReportDateRange
  department: string
  distribution?: EquipmentDistributionData
  maintenanceStats?: MaintenanceStats
  usageAnalytics?: { overview: UsageOverview; daily: DailyUsageItem[] }
  reportScope?: ExportReportScope
  maintenanceStatsUnavailable?: boolean
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Thêm thủ công",
  excel: "Import Excel",
  transfer_internal: "Luân chuyển nội bộ",
  transfer_external: "Luân chuyển bên ngoài",
  liquidation: "Thanh lý",
}

function getSourceLabel(source: string) {
  return SOURCE_LABELS[source] || source
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
      Nhập: stats.nhap,
      Xuất: stats.xuat,
      Tổng: stats.tong,
    }))
    .sort((a, b) => b["Tổng"] - a["Tổng"])
}

function buildSummarySheet(summary: InventorySummary, detailRowCount: number): ExportArraySheet {
  return {
    name: "Tổng quan",
    data: [
      ["TỔNG QUAN"],
      ["Thiết bị nhập:", "", "Thiết bị xuất:", "", "Tồn kho hiện tại:", "", "Biến động thuần:", ""],
      [
        summary.totalImported,
        "",
        summary.totalExported,
        "",
        summary.currentStock,
        "",
        summary.netChange,
        "",
      ],
      ["CHI TIẾT GIAO DỊCH"],
      [
        `Dòng chi tiết trong file: ${detailRowCount}. Tồn kho hiện tại theo dữ liệu hiện có từ nguồn; KPI và chi tiết có phạm vi tổng hợp khác nhau, không đối chiếu trực tiếp với số dòng chi tiết.`,
      ],
    ],
    type: "array",
    columnWidths: [18, 5, 18, 5, 20, 5, 18, 5],
  }
}

function buildDetailedTransactionsSheet(data: InventoryItem[]): ExportJsonSheet {
  return {
    name: "Chi tiết giao dịch",
    data: data.map((item) => ({
      Ngày: format(new Date(item.ngay_nhap), "dd/MM/yyyy"),
      "Mã thiết bị": item.ma_thiet_bi,
      "Tên thiết bị": item.ten_thiet_bi,
      Model: item.model || "",
      Serial: item.serial || "",
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
  const catalog = distribution.statusCatalog ?? []
  const statusRows = buildEquipmentDistributionStatusRows(
    catalog,
    getEquipmentDistributionStatusCounts(distribution),
    total
  )
  const reportLabel = (row: { key: string; label: string }) =>
    LEGACY_STATUS_LABELS[row.key as keyof typeof LEGACY_STATUS_LABELS] ?? row.label
  sheets.push({
    name: "Phân bố trạng thái",
    data: statusRows.map((row) => ({
      "Trạng thái": reportLabel(row),
      "Số lượng": row.count,
      "Tỷ lệ (%)": pct(row.count, total),
    })),
    type: "json",
    columnWidths: [28, 12, 12],
  })

  for (const [name, column, groups] of [
    ["Trạng thái theo khoa", "Khoa/Phòng", distribution.byDepartment],
    ["Trạng thái theo vị trí", "Vị trí", distribution.byLocation],
  ] as const) {
    if (groups.length === 0) continue
    sheets.push({
      name,
      data: groups.map((group) => ({
        [column]: group.name,
        ...Object.fromEntries(
          buildEquipmentDistributionStatusRows(
            catalog,
            getEquipmentDistributionGroupCounts(group),
            group.total
          ).map((row) => [reportLabel(row), row.count])
        ),
        Tổng: group.total,
      })),
      type: "json",
      columnWidths: [28, ...statusRows.map(() => 14), 10],
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
        {
          "Chỉ số": "Tổng chi phí sửa chữa",
          "Giá trị": maintenanceStats.repair_summary.total_cost,
        },
        {
          "Chỉ số": "Chi phí TB ca hoàn thành có ghi nhận chi phí",
          "Giá trị": maintenanceStats.repair_summary.average_completed_cost,
        },
        {
          "Chỉ số": "Có ghi nhận chi phí",
          "Giá trị": maintenanceStats.repair_summary.cost_recorded_count,
        },
        {
          "Chỉ số": "Thiếu chi phí",
          "Giá trị": maintenanceStats.repair_summary.cost_missing_count,
        },
      ],
      type: "json",
      columnWidths: [30, 14],
    },
    {
      name: "Bảo trì - Tổng quan",
      data: [
        {
          "Chỉ số": "Kế hoạch bảo trì",
          "Giá trị": maintenanceStats.maintenance_summary.total_plans,
        },
        { "Chỉ số": "Tổng công việc", "Giá trị": maintenanceStats.maintenance_summary.total_tasks },
        { "Chỉ số": "Hoàn thành", "Giá trị": maintenanceStats.maintenance_summary.completed_tasks },
      ],
      type: "json",
      columnWidths: [30, 14],
    },
  ]
}

function buildUsageSheets(usageAnalytics?: {
  overview: UsageOverview
  daily: DailyUsageItem[]
}): ExportSheet[] {
  if (!usageAnalytics) {
    return []
  }

  return [
    {
      name: "Sử dụng TB - Tổng quan",
      data: [
        { "Chỉ số": "Phiên sử dụng (tổng)", "Giá trị": usageAnalytics.overview.total_sessions },
        { "Chỉ số": "Phiên đang hoạt động", "Giá trị": usageAnalytics.overview.active_sessions },
        {
          "Chỉ số": "Thời gian sử dụng (phút)",
          "Giá trị": usageAnalytics.overview.total_usage_time,
        },
      ],
      type: "json",
      columnWidths: [36, 18],
    },
    {
      name: "Sử dụng TB - Theo ngày",
      data: (usageAnalytics.daily || []).map((item) => ({
        Ngày: item.date,
        Phiên: item.session_count,
        "Thời gian (phút)": item.total_usage_time,
        "Người dùng": item.unique_users,
        "Thiết bị": item.unique_equipment,
      })),
      type: "json",
      columnWidths: [14, 10, 16, 12, 12],
    },
  ]
}

/** Builds report export sheets from the selected report data. */
export function buildExportSheets(args: BuildExportSheetsArgs): ExportSheet[] {
  const {
    data,
    summary,
    dateRange,
    department,
    distribution,
    maintenanceStats,
    usageAnalytics,
    reportScope,
    maintenanceStatsUnavailable,
  } = args

  return addReportPresentation(
    [
      buildSummarySheet(summary, data.length),
      buildDetailedTransactionsSheet(data),
      buildStatisticsSheet(data),
      ...buildDistributionSheets(distribution),
      ...buildMaintenanceSheets(maintenanceStats),
      ...buildUsageSheets(usageAnalytics),
    ],
    { dateRange, department, detailRowCount: data.length, reportScope, maintenanceStatsUnavailable }
  )
}
