import { describe, expect, it } from "vitest"

import {
  addEquipmentFormSchema,
  DEFAULT_ADD_EQUIPMENT_FORM_VALUES,
} from "../add-equipment-dialog.schema"

describe("add-equipment-dialog schema", () => {
  it("keeps the expected default empty state for required fields", () => {
    expect(DEFAULT_ADD_EQUIPMENT_FORM_VALUES.ma_thiet_bi).toBe("")
    expect(DEFAULT_ADD_EQUIPMENT_FORM_VALUES.ten_thiet_bi).toBe("")
    expect(DEFAULT_ADD_EQUIPMENT_FORM_VALUES.khoa_phong_quan_ly).toBe("")
    expect(DEFAULT_ADD_EQUIPMENT_FORM_VALUES.tinh_trang_hien_tai).toBe("")
  })

  it("normalizes date inputs on valid parse", () => {
    const result = addEquipmentFormSchema.parse({
      ...DEFAULT_ADD_EQUIPMENT_FORM_VALUES,
      ma_thiet_bi: "EQ-001",
      ten_thiet_bi: "Máy siêu âm",
      vi_tri_lap_dat: "Phòng 101",
      khoa_phong_quan_ly: "Khoa Nội",
      nguoi_dang_truc_tiep_quan_ly: "Nguyễn Văn A",
      tinh_trang_hien_tai: "Ngưng sử dụng",
      ngay_nhap: "10/2024",
      ngay_ngung_su_dung: "25/03/2026",
    })

    expect(result.ngay_nhap).toBe("2024-10")
    expect(result.ngay_ngung_su_dung).toBe("2026-03-25")
  })
})
