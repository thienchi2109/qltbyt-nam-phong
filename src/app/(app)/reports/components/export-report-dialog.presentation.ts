import { format } from "date-fns"
import type { ExportSheet } from "./export-report-dialog.utils"

/** Report scope already selected by the Reports page and its data hooks. */
export interface ExportReportScope {
  facility: string
  dataset: string
  searchTerm: string
  usageDays?: number
  allFacilities?: boolean
}

interface ReportPresentationArgs {
  dateRange: { from: Date; to: Date }
  department: string
  detailRowCount: number
  reportScope?: ExportReportScope
  maintenanceStatsUnavailable?: boolean
}

const DETAIL_HEADERS = [
  "Ngày",
  "Mã thiết bị",
  "Tên thiết bị",
  "Model",
  "Serial",
  "Khoa/Phòng",
  "Loại giao dịch",
  "Nguồn/Hình thức",
  "Lý do/Đích đến",
  "Giá trị",
]

const EMPTY_SCOPE: ExportReportScope = {
  facility: "Phạm vi theo quyền tài khoản",
  dataset: "Thiết bị thường",
  searchTerm: "",
}

/** Adds truthful scope metadata and empty states without changing report rows. */
export function addReportPresentation(
  sheets: ExportSheet[],
  args: ReportPresentationArgs
): ExportSheet[] {
  const scope = args.reportScope ?? EMPTY_SCOPE
  const period = `${format(args.dateRange.from, "dd/MM/yyyy")} - ${format(args.dateRange.to, "dd/MM/yyyy")}`
  const department = args.department === "all" ? "Tất cả" : args.department
  const searchTerm = scope.searchTerm.trim() || "Không áp dụng"

  const presented = sheets.map((sheet): ExportSheet => {
    const metadata = metadataFor(sheet.name, {
      period,
      department,
      detailRowCount: args.detailRowCount,
      scope,
      searchTerm,
    })
    const headers = headersFor(sheet.name)
    return {
      ...sheet,
      ...(headers ? { headers } : {}),
      presentation: {
        ...(sheet.name === "Tổng quan" ? { layout: "overview" as const } : {}),
        metadata,
        ...(sheet.name === "Chi tiết giao dịch"
          ? {
              emptyMessage: scope.allFacilities
                ? "Bảng chi tiết giao dịch không khả dụng khi xem tất cả cơ sở. Chọn một cơ sở cụ thể để xem chi tiết."
                : "Không có dòng chi tiết được cung cấp cho tệp này.",
              freezeColumns: 2,
            }
          : { emptyMessage: "Không có dòng dữ liệu để hiển thị.", freezeColumns: 1 }),
      },
    }
  })

  if (
    args.maintenanceStatsUnavailable &&
    !sheets.some((sheet) => sheet.name.startsWith("Sửa chữa"))
  ) {
    const index = presented.findIndex((sheet) => sheet.name.startsWith("Sử dụng"))
    const note: ExportSheet = {
      name: "Sửa chữa - Tổng quan",
      data: [
        {
          "Thông tin":
            "Không có số liệu sửa chữa và bảo trì khả dụng tại thời điểm xuất; các chỉ số được lược khỏi tệp.",
        },
      ],
      type: "json",
      headers: ["Thông tin"],
      columnWidths: [68],
      presentation: {
        metadata: [
          `Kỳ: ${period} · Khoa/Phòng: ${department}`,
          `Đơn vị: ${scope.facility} · Tập dữ liệu: ${scope.dataset}`,
        ],
        emptyMessage: "Không có dòng dữ liệu để hiển thị.",
      },
    }
    presented.splice(index < 0 ? presented.length : index, 0, note)
  }

  return presented
}

function headersFor(sheetName: string) {
  if (sheetName === "Chi tiết giao dịch") return DETAIL_HEADERS
  if (sheetName === "Thống kê giao dịch") return ["Khoa/Phòng", "Nhập", "Xuất", "Tổng"]
  if (sheetName === "Phân bố trạng thái") return ["Trạng thái", "Số lượng", "Tỷ lệ (%)"]
  if (sheetName === "Sử dụng TB - Theo ngày") {
    return ["Ngày", "Phiên", "Thời gian (phút)", "Người dùng", "Thiết bị"]
  }
  return undefined
}

function metadataFor(
  sheetName: string,
  args: {
    period: string
    department: string
    detailRowCount: number
    scope: ExportReportScope
    searchTerm: string
  }
) {
  const scopeLine = `Đơn vị: ${args.scope.facility} · Tập dữ liệu: ${args.scope.dataset}`
  if (sheetName === "Tổng quan") {
    return [
      `Thời gian: ${args.period} · Khoa/Phòng: ${args.department}`,
      scopeLine,
      `Ngày xuất báo cáo: ${format(new Date(), "dd/MM/yyyy HH:mm")} · Dòng chi tiết trong file: ${args.detailRowCount}`,
      `Từ khóa chi tiết: ${args.searchTerm} · KPI và chi tiết có phạm vi tổng hợp khác nhau; không đối chiếu trực tiếp với số dòng chi tiết.`,
    ]
  }
  if (sheetName === "Chi tiết giao dịch") {
    return [
      `Kỳ giao dịch: ${args.period} · Khoa/Phòng: ${args.department}`,
      `${scopeLine} · Từ khóa: ${args.searchTerm}`,
    ]
  }
  if (sheetName === "Thống kê giao dịch") {
    return [`Tổng hợp từ ${args.detailRowCount} dòng chi tiết trong tệp.`, scopeLine]
  }
  if (sheetName.startsWith("Trạng thái") || sheetName === "Phân bố trạng thái") {
    return ["Trạng thái thiết bị tại thời điểm hiện tại; không theo kỳ giao dịch.", scopeLine]
  }
  if (sheetName.startsWith("Sửa chữa") || sheetName.startsWith("Bảo trì")) {
    return [`Kỳ: ${args.period} · Khoa/Phòng: ${args.department}`, scopeLine]
  }
  if (sheetName === "Sử dụng TB - Tổng quan") {
    return ["Tổng quan toàn thời gian; không lọc theo ngày/khoa phòng.", scopeLine]
  }
  if (sheetName === "Sử dụng TB - Theo ngày") {
    const days = args.scope.usageDays
      ? `${args.scope.usageDays} ngày`
      : "độ dài khoảng thời gian đã chọn"
    return [
      `Cửa sổ lăn từ ngày hiện tại trừ ${days} trở đi; truy vấn không đặt mốc kết thúc/khoa phòng.`,
      scopeLine,
    ]
  }
  return [scopeLine]
}
