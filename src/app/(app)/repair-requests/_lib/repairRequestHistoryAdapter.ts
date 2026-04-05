import type { ChangeHistoryEntry } from "@/components/change-history/ChangeHistoryTypes"

import type { RepairRequestChangeHistory } from "../types"

const REPAIR_HISTORY_ACTION_LABELS: Record<string, string> = {
  repair_request_create: "Tạo yêu cầu sửa chữa",
  repair_request_update: "Cập nhật yêu cầu sửa chữa",
  repair_request_approve: "Phê duyệt sửa chữa",
  repair_request_complete: "Hoàn thành sửa chữa",
  repair_request_delete: "Xóa yêu cầu sửa chữa",
}

const REPAIR_HISTORY_DETAILS_LABELS: Record<string, string> = {
  trang_thai: "Trạng thái",
  mo_ta_su_co: "Mô tả sự cố",
  hang_muc_sua_chua: "Hạng mục sửa chữa",
  ngay_mong_muon_hoan_thanh: "Ngày mong muốn hoàn thành",
  don_vi_thuc_hien: "Đơn vị thực hiện",
  ten_don_vi_thue: "Tên đơn vị thuê",
  ket_qua_sua_chua: "Kết quả sửa chữa",
  ly_do_khong_hoan_thanh: "Lý do không hoàn thành",
  nguoi_duyet: "Người duyệt",
  nguoi_yeu_cau: "Người yêu cầu",
}

const REPAIR_HISTORY_HIDDEN_KEYS = new Set<string>([
  "id",
  "thiet_bi_id",
  "yeu_cau_id",
])

function formatRepairHistoryDetailValue(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(formatRepairHistoryDetailValue).join(", ")
  }
  return "—"
}

function getRepairHistoryDetails(
  actionDetails: Record<string, unknown> | null,
): ChangeHistoryEntry["details"] {
  if (!actionDetails) return []

  return Object.entries(actionDetails)
    .filter(
      ([key, value]) =>
        !REPAIR_HISTORY_HIDDEN_KEYS.has(key) &&
        value !== null &&
        value !== "",
    )
    .map(([key, value]) => ({
      label: REPAIR_HISTORY_DETAILS_LABELS[key] ?? key.replaceAll("_", " "),
      value: formatRepairHistoryDetailValue(value),
    }))
}

export function mapRepairRequestHistoryEntries(
  history: RepairRequestChangeHistory[],
): ChangeHistoryEntry[] {
  return history.map((item) => ({
    id: String(item.id),
    occurredAt: item.created_at,
    actionLabel: REPAIR_HISTORY_ACTION_LABELS[item.action_type] ?? item.action_type,
    actorName: item.admin_full_name || null,
    details: getRepairHistoryDetails(item.action_details),
  }))
}
