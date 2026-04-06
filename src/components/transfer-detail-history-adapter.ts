import type { ChangeHistoryEntry } from "@/components/change-history/ChangeHistoryTypes"
import {
  TRANSFER_STATUSES,
  type TransferChangeHistory,
  type TransferRequest,
} from "@/types/database"

const TRANSFER_HISTORY_ACTION_LABELS: Record<string, string> = {
  transfer_request_create: "Tạo yêu cầu luân chuyển",
  transfer_request_update: "Cập nhật yêu cầu luân chuyển",
  transfer_request_update_status: "Cập nhật trạng thái yêu cầu luân chuyển",
  transfer_request_complete: "Hoàn thành luân chuyển",
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
  ngay_duyet: "Ngày duyệt",
  ngay_ban_giao: "Ngày bàn giao",
  ngay_hoan_thanh: "Ngày hoàn thành",
  ngay_hoan_tra: "Ngày hoàn trả",
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

function normalizeNonEmptyString(value: string | null | undefined): string | null {
  if (!value) return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getHistoryActorName(entry: Pick<TransferChangeHistory, "admin_full_name" | "admin_username">) {
  return normalizeNonEmptyString(entry.admin_full_name) ??
    normalizeNonEmptyString(entry.admin_username)
}

function getHistoryStatus(actionDetails: Record<string, unknown> | null): string | null {
  const status = actionDetails?.trang_thai
  return typeof status === "string" ? normalizeNonEmptyString(status) : null
}

function findHistoryActor(
  history: TransferChangeHistory[],
  predicate: (entry: TransferChangeHistory) => boolean,
) {
  for (const entry of history) {
    if (!predicate(entry)) {
      continue
    }

    const actorName = getHistoryActorName(entry)
    if (actorName) {
      return actorName
    }
  }

  return null
}

function hasMatchingRequesterAndApproverIds(
  transfer: Pick<TransferRequest, "nguoi_yeu_cau_id" | "nguoi_duyet_id">,
) {
  return transfer.nguoi_yeu_cau_id != null &&
    transfer.nguoi_duyet_id != null &&
    transfer.nguoi_yeu_cau_id === transfer.nguoi_duyet_id
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

export function resolveTransferRelatedPeople(
  history: TransferChangeHistory[],
  transfer:
    | Pick<
        TransferRequest,
        "nguoi_yeu_cau_id" | "nguoi_duyet_id" | "nguoi_yeu_cau" | "nguoi_duyet"
      >
    | null,
) {
  if (!transfer) {
    return {
      requesterName: null,
      approverName: null,
    }
  }

  let requesterName =
    findHistoryActor(history, (entry) => entry.action_type === "transfer_request_create") ??
    normalizeNonEmptyString(transfer.nguoi_yeu_cau?.full_name)

  let approverName =
    findHistoryActor(history, (entry) => {
      if (
        entry.action_type !== "transfer_request_update" &&
        entry.action_type !== "transfer_request_update_status"
      ) {
        return false
      }

      return getHistoryStatus(entry.action_details) === "da_duyet"
    }) ?? normalizeNonEmptyString(transfer.nguoi_duyet?.full_name)

  if (hasMatchingRequesterAndApproverIds(transfer)) {
    requesterName ??= approverName
    approverName ??= requesterName
  }

  return {
    requesterName,
    approverName,
  }
}
