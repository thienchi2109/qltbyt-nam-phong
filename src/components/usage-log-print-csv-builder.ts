import { differenceInMinutes, format } from "date-fns"
import { vi } from "date-fns/locale"

import {
  type BuildUsageLogCsvArgs,
  escapeCsvCell,
  getPrintableFinalStatus,
  getPrintableInitialStatus,
} from "@/components/usage-log-print-builder-utils"

export function buildUsageLogCsv({
  equipment,
  filteredLogs,
  now,
}: BuildUsageLogCsvArgs): string {
  const headers = [
    "STT",
    "Người sử dụng",
    "Khoa/Phòng",
    "Thời gian bắt đầu",
    "Thời gian kết thúc",
    "Thời lượng (phút)",
    "Tình trạng ban đầu",
    "Tình trạng kết thúc",
    "Trạng thái",
    "Ghi chú",
  ]

  const rows = filteredLogs.map((log, index) => [
    index + 1,
    log.nguoi_su_dung?.full_name || "Không xác định",
    log.nguoi_su_dung?.khoa_phong || "",
    format(new Date(log.thoi_gian_bat_dau), "dd/MM/yyyy HH:mm", { locale: vi }),
    log.thoi_gian_ket_thuc ? format(new Date(log.thoi_gian_ket_thuc), "dd/MM/yyyy HH:mm", { locale: vi }) : "",
    differenceInMinutes(log.thoi_gian_ket_thuc ? new Date(log.thoi_gian_ket_thuc) : now, new Date(log.thoi_gian_bat_dau)),
    getPrintableInitialStatus(log),
    getPrintableFinalStatus(log),
    log.trang_thai === "dang_su_dung" ? "Đang sử dụng" : "Hoàn thành",
    log.ghi_chu || "",
  ])

  const csvContent = [
    escapeCsvCell(`Nhật ký sử dụng thiết bị: ${equipment.ten_thiet_bi}`),
    escapeCsvCell(`Mã thiết bị: ${equipment.ma_thiet_bi}`),
    escapeCsvCell(`Xuất ngày: ${format(now, "dd/MM/yyyy HH:mm", { locale: vi })}`),
    "",
    headers.map((header) => escapeCsvCell(header)).join(","),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
  ].join("\n")

  return `\uFEFF${csvContent}`
}
