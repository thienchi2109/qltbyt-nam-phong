import { describe, expect, it } from "vitest"

import {
  EQUIPMENT_ATTENTION_ACTION,
  EQUIPMENT_ATTENTION_STATUSES,
  applyAttentionStatusPresetFilters,
  getEquipmentAttentionHrefForRole,
} from "../equipment-attention-preset"

describe("equipment attention preset", () => {
  it("returns unfiltered equipment path for global/admin/regional_leader", () => {
    expect(getEquipmentAttentionHrefForRole("global")).toBe("/equipment")
    expect(getEquipmentAttentionHrefForRole("admin")).toBe("/equipment")
    expect(getEquipmentAttentionHrefForRole("regional_leader")).toBe("/equipment")
  })

  it("returns action-based preset path for non-global roles", () => {
    expect(getEquipmentAttentionHrefForRole("to_qltb")).toBe(`/equipment?action=${EQUIPMENT_ATTENTION_ACTION}`)
    expect(getEquipmentAttentionHrefForRole("qltb_khoa")).toBe(`/equipment?action=${EQUIPMENT_ATTENTION_ACTION}`)
    expect(getEquipmentAttentionHrefForRole("technician")).toBe(`/equipment?action=${EQUIPMENT_ATTENTION_ACTION}`)
    expect(getEquipmentAttentionHrefForRole("user")).toBe(`/equipment?action=${EQUIPMENT_ATTENTION_ACTION}`)
    expect(getEquipmentAttentionHrefForRole(undefined)).toBe(`/equipment?action=${EQUIPMENT_ATTENTION_ACTION}`)
  })

  it("exports exact vietnamese status values", () => {
    expect(EQUIPMENT_ATTENTION_STATUSES).toEqual([
      "Chờ sửa chữa",
      "Chờ bảo trì",
      "Chờ hiệu chuẩn/kiểm định",
    ])
  })

  it("replaces status filter and preserves non-status filters", () => {
    expect(
      applyAttentionStatusPresetFilters([
        { id: "khoa_phong_quan_ly", value: ["Khoa A"] },
        { id: "tinh_trang_hien_tai", value: ["Hoạt động"] },
      ])
    ).toEqual([
      { id: "khoa_phong_quan_ly", value: ["Khoa A"] },
      {
        id: "tinh_trang_hien_tai",
        value: ["Chờ sửa chữa", "Chờ bảo trì", "Chờ hiệu chuẩn/kiểm định"],
      },
    ])
  })
})
