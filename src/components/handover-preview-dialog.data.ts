import type { TransferRequest } from "@/types/database"

import type { HandoverData, HandoverField } from "./handover-preview-dialog.types"

export type { HandoverData, HandoverField } from "./handover-preview-dialog.types"

function formatValue(value: string | number | null | undefined): string {
  return String(value ?? "")
}

function resolveRepresentative(department: string | null | undefined): string {
  return department === "Tổ QLTB" ? "Đại diện Tổ QLTB" : `Đại diện ${department}`
}

export function buildHandoverData(
  transfer: TransferRequest,
  handoverDate = new Date().toLocaleDateString("vi-VN"),
): HandoverData {
  return {
    department: formatValue(transfer.khoa_phong_hien_tai || "Tổ QLTB"),
    handoverDate,
    reason: formatValue(transfer.ly_do_luan_chuyen),
    requestCode: formatValue(transfer.ma_yeu_cau),
    giverName: resolveRepresentative(transfer.khoa_phong_hien_tai),
    directorName: "",
    receiverName: resolveRepresentative(transfer.khoa_phong_nhan),
    device: {
      code: formatValue(transfer.thiet_bi?.ma_thiet_bi),
      name: formatValue(transfer.thiet_bi?.ten_thiet_bi),
      model: formatValue(transfer.thiet_bi?.model),
      serial: formatValue(transfer.thiet_bi?.serial_number),
      condition: formatValue(transfer.thiet_bi?.tinh_trang),
      accessories: "",
      note: "",
    },
  }
}

export function updateHandoverField(
  data: HandoverData,
  field: HandoverField,
  value: string,
): HandoverData {
  if (field.startsWith("device.")) {
    const deviceField = field.replace("device.", "") as keyof HandoverData["device"]

    return {
      ...data,
      device: {
        ...data.device,
        [deviceField]: value,
      },
    }
  }

  return {
    ...data,
    [field]: value,
  }
}

export function validateHandoverData(
  data: HandoverData,
): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = []

  if (!data.department.trim()) missingFields.push("Khoa/Phòng lập")
  if (!data.reason.trim()) missingFields.push("Lý do bàn giao")
  if (!data.giverName.trim()) missingFields.push("Đại diện bên giao")
  if (!data.receiverName.trim()) missingFields.push("Đại diện bên nhận")

  return {
    isValid: missingFields.length === 0,
    missingFields,
  }
}
