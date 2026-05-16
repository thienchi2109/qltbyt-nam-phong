import { describe, expect, it } from "vitest"

import {
  buildHandoverData,
  updateHandoverField,
  validateHandoverData,
  type HandoverData,
} from "@/components/handover-preview-dialog.data"
import type { TransferRequest } from "@/types/database"

function makeTransfer(overrides: Partial<TransferRequest> = {}): TransferRequest {
  return {
    id: 1,
    ma_yeu_cau: "LC-0001",
    thiet_bi_id: 10,
    loai_hinh: "noi_bo",
    trang_thai: "da_duyet",
    ly_do_luan_chuyen: "Bàn giao phục vụ khám bệnh",
    khoa_phong_hien_tai: "Khoa Cấp cứu",
    khoa_phong_nhan: "Khoa Nội",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    thiet_bi: {
      id: 10,
      ma_thiet_bi: "TB-001",
      ten_thiet_bi: "Máy thở",
      model: "M-100",
      serial_number: "SN-001",
      tinh_trang: "Hoạt động",
    },
    ...overrides,
  }
}

function makeHandoverData(overrides: Partial<HandoverData> = {}): HandoverData {
  return {
    department: "Khoa Cấp cứu",
    handoverDate: "16/05/2026",
    reason: "Bàn giao phục vụ khám bệnh",
    requestCode: "LC-0001",
    giverName: "Đại diện Khoa Cấp cứu",
    directorName: "",
    receiverName: "Đại diện Khoa Nội",
    device: {
      code: "TB-001",
      name: "Máy thở",
      model: "M-100",
      serial: "SN-001",
      condition: "Hoạt động",
      accessories: "",
      note: "",
    },
    ...overrides,
  }
}

describe("handover preview data helpers", () => {
  it("builds handover defaults from a transfer request", () => {
    const data = buildHandoverData(makeTransfer(), "16/05/2026")

    expect(data).toMatchObject({
      department: "Khoa Cấp cứu",
      handoverDate: "16/05/2026",
      reason: "Bàn giao phục vụ khám bệnh",
      requestCode: "LC-0001",
      giverName: "Đại diện Khoa Cấp cứu",
      directorName: "",
      receiverName: "Đại diện Khoa Nội",
      device: {
        code: "TB-001",
        name: "Máy thở",
        model: "M-100",
        serial: "SN-001",
        condition: "Hoạt động",
        accessories: "",
        note: "",
      },
    })
  })

  it("keeps QLTB representative labels stable for QLTB transfers", () => {
    const data = buildHandoverData(
      makeTransfer({
        khoa_phong_hien_tai: "Tổ QLTB",
        khoa_phong_nhan: "Tổ QLTB",
      }),
      "16/05/2026",
    )

    expect(data.giverName).toBe("Đại diện Tổ QLTB")
    expect(data.receiverName).toBe("Đại diện Tổ QLTB")
  })

  it("requires department, reason, giver, and receiver but not director", () => {
    const validation = validateHandoverData(
      makeHandoverData({
        department: " ",
        reason: "",
        giverName: "",
        directorName: "",
        receiverName: "",
      }),
    )

    expect(validation).toEqual({
      isValid: false,
      missingFields: [
        "Khoa/Phòng lập",
        "Lý do bàn giao",
        "Đại diện bên giao",
        "Đại diện bên nhận",
      ],
    })
  })

  it("updates top-level and nested device fields immutably", () => {
    const data = makeHandoverData()

    const updatedReason = updateHandoverField(data, "reason", "Lý do mới")
    const updatedNote = updateHandoverField(data, "device.note", "Ghi chú mới")

    expect(updatedReason.reason).toBe("Lý do mới")
    expect(updatedReason.device).toBe(data.device)
    expect(updatedNote.device.note).toBe("Ghi chú mới")
    expect(updatedNote.device).not.toBe(data.device)
    expect(data.reason).toBe("Bàn giao phục vụ khám bệnh")
    expect(data.device.note).toBe("")
  })
})
