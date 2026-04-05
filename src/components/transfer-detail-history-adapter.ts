import type { ChangeHistoryEntry } from "@/components/change-history/ChangeHistoryTypes"
import { TRANSFER_STATUSES, type TransferChangeHistory } from "@/types/database"

const TRANSFER_HISTORY_ACTION_LABELS: Record<string, string> = {
  transfer_request_create: "Tạo yêu cầu luân chuyển",
  transfer_request_update: "Cập nhật yêu cầu luân chuyển",
}

const TRANSFER_HISTORY_DETAILS_LABELS: Record<string, string> = {
  ma_yeu_cau: "Mã yêu cầu",
  trang_thai: "Trạng thái",
  ly_do_luan_chuyen: "Lý do luân chuyển",
  khoa_phong_hien_tai: "Khoa/phòng hiện tại",
  khoa_phong_nhan: "Khoa/phòng nhận",
  don_vi_nhan: "Đơn vị nhận",
  nguoi_lien_he: "Người liên hệ",
  so_dien_thoai: "Số điện thoại",
}

const TRANSFER_HISTORY_DETAILS_HIDDEN_KEYS = new Set<string>([
  "loai_hinh",
  "thiet_bi_id",
])

function formatHistoryDetailValue(value: unknown): string {
  if (typeof value === "string") {
    const transferStatusLabel = TRANSFER_STATUSES[value as keyof typeof TRANSFER_STATUSES]
    return transferStatusLabel ?? value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(formatHistoryDetailValue).join(", ")
  }
  return "—"
}

function getTransferHistoryDetails(
  actionDetails: Record<string, unknown> | null,
): ChangeHistoryEntry["details"] {
  if (!actionDetails) return []

  return Object.entries(actionDetails)
    .filter(
      ([key, value]) =>
        !TRANSFER_HISTORY_DETAILS_HIDDEN_KEYS.has(key) &&
        value !== null &&
        value !== "",
    )
    .map(([key, value]) => ({
      label: TRANSFER_HISTORY_DETAILS_LABELS[key] ?? key.replaceAll("_", " "),
      value: formatHistoryDetailValue(value),
    }))
}

export function mapTransferHistoryEntries(
  history: TransferChangeHistory[],
): ChangeHistoryEntry[] {
  return history.map((item) => ({
    id: String(item.id),
    occurredAt: item.created_at,
    actionLabel: TRANSFER_HISTORY_ACTION_LABELS[item.action_type] ?? item.action_type,
    actorName: item.admin_full_name || null,
    details: getTransferHistoryDetails(item.action_details),
  }))
}
