import { describe, expect, it } from "vitest"

import {
  createAddEquipmentFormSchema,
  DEFAULT_ADD_EQUIPMENT_FORM_VALUES,
} from "../add-equipment-dialog.schema"
import { createEquipmentFormSchema } from "../equipment-edit/EquipmentEditTypes"
import { equipmentToFormValues } from "../equipment-edit/EquipmentEditFormDefaults"
import { validateEquipmentData } from "../import-equipment-dialog"
import { getActiveEquipmentStatusValues, type EquipmentStatusRow } from "@/lib/equipment-status"
import type { Equipment } from "@/types/database"

const labels = [
  "Hoạt động",
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng",
  "Thanh lý nội bộ",
  "Đang đánh giá kỹ thuật",
]
const catalog: EquipmentStatusRow[] = labels.map((status_value, index) => ({
  status_value,
  display_order: index + 1,
  is_active: true,
  is_terminal: false,
  requires_end_date: false,
  blocks_operational_actions: false,
  is_liquidation: index === 6,
}))
catalog.push({
  ...catalog[0],
  status_value: "Trạng thái đã ngừng cấp",
  display_order: 9,
  is_active: false,
})
const activeValues = getActiveEquipmentStatusValues(catalog)
const values = {
  ...DEFAULT_ADD_EQUIPMENT_FORM_VALUES,
  ma_thiet_bi: "EQ-001",
  ten_thiet_bi: "Monitor",
  khoa_phong_quan_ly: "Khoa Nội",
  vi_tri_lap_dat: "Phòng 101",
  nguoi_dang_truc_tiep_quan_ly: "Nguyễn Văn A",
}

describe("equipment status catalog admission", () => {
  it.each(labels)("admits the exact active catalog label %s in add and edit forms", (label) => {
    const payload = { ...values, tinh_trang_hien_tai: label }
    const add = createAddEquipmentFormSchema(activeValues).safeParse(payload)
    const edit = createEquipmentFormSchema(catalog, "Hoạt động").safeParse(payload)
    expect(add.success).toBe(true)
    expect(edit.success).toBe(true)
    if (add.success) expect(add.data.tinh_trang_hien_tai).toBe(label)
    if (edit.success) expect(edit.data.tinh_trang_hien_tai).toBe(label)
  })

  it("rejects a legacy label absent from the current catalog rather than using a fallback", () => {
    const withoutActive = catalog.filter((row) => row.status_value !== "Hoạt động")
    const payload = { ...values, tinh_trang_hien_tai: "Hoạt động" }
    expect(
      createAddEquipmentFormSchema(getActiveEquipmentStatusValues(withoutActive)).safeParse(payload)
        .success
    ).toBe(false)
    expect(createEquipmentFormSchema(withoutActive, "Chờ bảo trì").safeParse(payload).success).toBe(
      false
    )
  })

  it("rejects status admission while no active catalog values are ready", () => {
    expect(
      createAddEquipmentFormSchema([]).safeParse({ ...values, tinh_trang_hien_tai: "Hoạt động" })
        .success
    ).toBe(false)
    expect(
      createEquipmentFormSchema([], "Hoạt động").safeParse({
        ...values,
        tinh_trang_hien_tai: "Hoạt động",
      }).success
    ).toBe(false)
  })

  it("preserves a known inactive current label for metadata editing but rejects entry into it", () => {
    const label = "Trạng thái đã ngừng cấp"
    const payload = { ...values, tinh_trang_hien_tai: label, ghi_chu: "Metadata cập nhật" }
    expect(createEquipmentFormSchema(catalog, label).safeParse(payload).success).toBe(true)
    expect(createEquipmentFormSchema(catalog, "Hoạt động").safeParse(payload).success).toBe(false)
    expect(createAddEquipmentFormSchema(activeValues).safeParse(payload).success).toBe(false)
  })

  it("rejects entry into an inactive legacy label even though the old enum accepted it", () => {
    const inactive = catalog.map((row) =>
      row.status_value === "Chờ bảo trì" ? { ...row, is_active: false } : row
    )
    const payload = { ...values, tinh_trang_hien_tai: "Chờ bảo trì" }
    expect(
      createAddEquipmentFormSchema(getActiveEquipmentStatusValues(inactive)).safeParse(payload)
        .success
    ).toBe(false)
    expect(createEquipmentFormSchema(inactive, "Hoạt động").safeParse(payload).success).toBe(false)
  })

  it("retains raw unknown history for display but rejects explicit unknown writes", () => {
    const historical = "  Giá trị lịch sử chưa biết  "
    const formValues = equipmentToFormValues({
      ...values,
      tinh_trang_hien_tai: historical,
    } as Equipment)
    expect(formValues.tinh_trang_hien_tai).toBe(historical)
    expect(createEquipmentFormSchema(catalog, historical).safeParse(formValues).success).toBe(false)
  })

  it.each(labels)("imports the catalog label %s without losing the stored value", (label) => {
    const result = Reflect.apply(validateEquipmentData, undefined, [
      [{ ...values, tinh_trang_hien_tai: label }],
      activeValues,
    ]) as ReturnType<typeof validateEquipmentData>
    expect(result.isValid).toBe(true)
    expect(result.validRecords[0]?.tinh_trang_hien_tai).toBe(label)
  })

  it("preserves existing import whitespace trimming before exact catalog admission", () => {
    const result = Reflect.apply(validateEquipmentData, undefined, [
      [{ ...values, tinh_trang_hien_tai: "  Đang đánh giá kỹ thuật  " }],
      activeValues,
    ]) as ReturnType<typeof validateEquipmentData>
    expect(result.isValid).toBe(true)
    expect(result.validRecords[0]?.tinh_trang_hien_tai).toBe("Đang đánh giá kỹ thuật")
  })

  it("rejects missing, inactive, and unknown import values using only the supplied catalog", () => {
    for (const [label, allowed] of [
      ["Hoạt động", []],
      ["Chờ bảo trì", ["Hoạt động"]],
      ["Trạng thái đã ngừng cấp", activeValues],
      ["Giá trị lịch sử", activeValues],
    ] as const) {
      const result = Reflect.apply(validateEquipmentData, undefined, [
        [{ ...values, tinh_trang_hien_tai: label }],
        allowed,
      ]) as ReturnType<typeof validateEquipmentData>
      expect(result.isValid, label).toBe(false)
    }
  })
})
