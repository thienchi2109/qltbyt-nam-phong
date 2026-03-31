import { describe, expect, it } from "vitest"

import type { Equipment } from "@/types/database"

import {
  DEFAULT_EQUIPMENT_FORM_VALUES,
  equipmentToFormValues,
} from "../_components/EquipmentDetailDialog/EquipmentDetailFormDefaults"

describe("EquipmentDetailFormDefaults", () => {
  it("keeps the expected empty-state defaults for the detail form", () => {
    expect(DEFAULT_EQUIPMENT_FORM_VALUES.ma_thiet_bi).toBe("")
    expect(DEFAULT_EQUIPMENT_FORM_VALUES.ten_thiet_bi).toBe("")
    expect(DEFAULT_EQUIPMENT_FORM_VALUES.tinh_trang_hien_tai).toBeNull()
    expect(DEFAULT_EQUIPMENT_FORM_VALUES.gia_goc).toBeNull()
    expect(DEFAULT_EQUIPMENT_FORM_VALUES.phan_loai_theo_nd98).toBeNull()
  })

  it("normalizes classification, formats dates, and preserves numeric zero values", () => {
    const result = equipmentToFormValues({
      id: 1,
      ma_thiet_bi: "EQ-001",
      ten_thiet_bi: "Máy siêu âm",
      tinh_trang_hien_tai: "Hoạt động",
      phan_loai_theo_nd98: "b",
      ngay_nhap: "2024-10",
      ngay_dua_vao_su_dung: "2024-10-15",
      ngay_ngung_su_dung: "2024-12-31",
      han_bao_hanh: "2026",
      nam_san_xuat: 0,
      gia_goc: 0,
      chu_ky_bt_dinh_ky: 0,
      chu_ky_hc_dinh_ky: 0,
      chu_ky_kd_dinh_ky: 0,
    } as Equipment)

    expect(result.phan_loai_theo_nd98).toBe("B")
    expect(result.ngay_nhap).toBe("10/2024")
    expect(result.ngay_dua_vao_su_dung).toBe("15/10/2024")
    expect(result.ngay_ngung_su_dung).toBe("31/12/2024")
    expect(result.han_bao_hanh).toBe("2026")
    expect(result.nam_san_xuat).toBe(0)
    expect(result.gia_goc).toBe(0)
    expect(result.chu_ky_bt_dinh_ky).toBe(0)
    expect(result.chu_ky_hc_dinh_ky).toBe(0)
    expect(result.chu_ky_kd_dinh_ky).toBe(0)
  })

  it("drops persisted status values that are outside the supported equipment status list", () => {
    const result = equipmentToFormValues({
      id: 2,
      ma_thiet_bi: "EQ-002",
      ten_thiet_bi: "Monitor",
      tinh_trang_hien_tai: "Trạng thái cũ không hợp lệ",
    } as Equipment)

    expect(result.tinh_trang_hien_tai).toBeNull()
  })
})
