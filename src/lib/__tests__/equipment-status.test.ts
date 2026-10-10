import { describe, expect, it } from "vitest"
import {
  getActiveEquipmentStatusValues,
  getEquipmentStatusMetadata,
  type EquipmentStatusRow,
} from "@/lib/equipment-status"

const base = {
  is_active: true,
  is_terminal: false,
  requires_end_date: false,
  blocks_operational_actions: false,
  is_liquidation: false,
}

describe("equipment status metadata", () => {
  const rows: readonly EquipmentStatusRow[] = Object.freeze([
    Object.freeze({ ...base, status_value: "Trạng thái tương lai", display_order: 20 }),
    Object.freeze({ ...base, status_value: "Hoạt động", display_order: 1 }),
    Object.freeze({
      ...base,
      status_value: "Lịch sử",
      display_order: 8,
      is_active: false,
      is_terminal: true,
      requires_end_date: true,
      blocks_operational_actions: true,
      is_liquidation: true,
    }),
  ])

  it("orders exact active labels without mutating the input or restricting future labels", () => {
    expect(getActiveEquipmentStatusValues(rows)).toEqual(["Hoạt động", "Trạng thái tương lai"])
    expect(rows.map((row) => row.display_order)).toEqual([20, 1, 8])
  })

  it("retains inactive historical metadata and each policy flag for display lookup", () => {
    expect(getEquipmentStatusMetadata(rows, "Lịch sử")).toBe(rows[2])
    expect(getEquipmentStatusMetadata(rows, "Lịch sử")).toMatchObject({
      is_active: false,
      is_terminal: true,
      requires_end_date: true,
      blocks_operational_actions: true,
      is_liquidation: true,
    })
  })

  it("recognizes a future label dynamically without assigning terminal policies", () => {
    expect(getEquipmentStatusMetadata(rows, "Trạng thái tương lai")).toBe(rows[0])
  })

  it("returns no metadata for unknown labels so the consumer preserves the raw label", () => {
    const label = "Nhãn chưa có trong danh mục"
    expect(getEquipmentStatusMetadata(rows, label)).toBeUndefined()
    expect(getEquipmentStatusMetadata(rows, "hoạt động")).toBeUndefined()
    expect(getEquipmentStatusMetadata(rows, " Hoạt động ")).toBeUndefined()
  })

  it("returns no write options for empty or entirely inactive catalogs", () => {
    expect(getActiveEquipmentStatusValues([])).toEqual([])
    expect(getActiveEquipmentStatusValues([rows[2]])).toEqual([])
  })
})
