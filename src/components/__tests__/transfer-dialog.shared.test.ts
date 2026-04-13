import { describe, expect, it } from "vitest"

import {
  buildCreateTransferPayload,
  buildUpdateTransferPayload,
  getTransferDialogErrorMessage,
  mapEquipmentSearchResults,
  normalizeSessionUserId,
  type TransferDialogFormData,
} from "@/components/transfer-dialog.shared"

const baseFormData: TransferDialogFormData = {
  thiet_bi_id: 11,
  loai_hinh: "ben_ngoai",
  ly_do_luan_chuyen: "  Điều phối  ",
  khoa_phong_hien_tai: " Khoa A ",
  khoa_phong_nhan: " Khoa B ",
  muc_dich: "sua_chua",
  don_vi_nhan: " Đơn vị B ",
  dia_chi_don_vi: " 12 Nguyễn Trãi ",
  nguoi_lien_he: " Nguyễn Văn B ",
  so_dien_thoai: " 0900000000 ",
  ngay_du_kien_tra: "2026-05-01",
}

describe("transfer-dialog.shared", () => {
  it("normalizes numeric session user ids and fails closed for invalid ids", () => {
    expect(normalizeSessionUserId({ id: "42" })).toBe(42)
    expect(normalizeSessionUserId({ id: "abc" })).toBeNull()
    expect(normalizeSessionUserId({ id: undefined })).toBeNull()
  })

  it("drops stale external fields when creating an internal transfer payload", () => {
    expect(
      buildCreateTransferPayload({
        formData: {
          ...baseFormData,
          loai_hinh: "noi_bo",
        },
        currentUserId: 42,
      }),
    ).toEqual({
      thiet_bi_id: 11,
      loai_hinh: "noi_bo",
      ly_do_luan_chuyen: "Điều phối",
      nguoi_yeu_cau_id: 42,
      created_by: 42,
      updated_by: 42,
      khoa_phong_hien_tai: "Khoa A",
      khoa_phong_nhan: "Khoa B",
      muc_dich: null,
      don_vi_nhan: null,
      dia_chi_don_vi: null,
      nguoi_lien_he: null,
      so_dien_thoai: null,
      ngay_du_kien_tra: null,
    })
  })

  it("nulls external fields when updating an internal transfer payload", () => {
    expect(
      buildUpdateTransferPayload({
        formData: {
          ...baseFormData,
          loai_hinh: "noi_bo",
        },
        currentUserId: 42,
      }),
    ).toEqual({
      thiet_bi_id: 11,
      loai_hinh: "noi_bo",
      ly_do_luan_chuyen: "Điều phối",
      updated_by: 42,
      khoa_phong_hien_tai: "Khoa A",
      khoa_phong_nhan: "Khoa B",
      muc_dich: null,
      don_vi_nhan: null,
      dia_chi_don_vi: null,
      nguoi_lien_he: null,
      so_dien_thoai: null,
      ngay_du_kien_tra: null,
    })
  })

  it("maps unknown equipment rows without relying on any", () => {
    expect(
      mapEquipmentSearchResults([
        {
          id: "11",
          ma_thiet_bi: "TB-11",
          ten_thiet_bi: "Máy siêu âm",
          khoa_phong_quan_ly: "Khoa A",
        },
        {
          id: null,
          ma_thiet_bi: "bad",
          ten_thiet_bi: "bad",
        },
      ]),
    ).toEqual([
      {
        id: 11,
        ma_thiet_bi: "TB-11",
        ten_thiet_bi: "Máy siêu âm",
        khoa_phong_quan_ly: "Khoa A",
      },
    ])
  })

  it("extracts a human-readable message from unknown errors", () => {
    expect(getTransferDialogErrorMessage({ message: "Permission denied" }, "Fallback")).toBe(
      "Permission denied",
    )
    expect(getTransferDialogErrorMessage({ detail: "ignored" }, "Fallback")).toBe("Fallback")
  })
})
