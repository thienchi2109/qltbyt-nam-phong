import { describe, expect, it } from "vitest"

import {
  DEFAULT_EQUIPMENT_DATASET,
  EQUIPMENT_DATASET_LABELS,
  EQUIPMENT_DATASETS,
  isPlacedEquipment,
  normalizeEquipmentDataset,
} from "../equipmentDataset"

describe("equipment dataset contract", () => {
  it("supports regular and placed datasets and defaults unknown values to regular", () => {
    expect(EQUIPMENT_DATASETS).toEqual(["regular", "placed"])
    expect(DEFAULT_EQUIPMENT_DATASET).toBe("regular")
    expect(normalizeEquipmentDataset(undefined)).toBe("regular")
    expect(normalizeEquipmentDataset("unknown")).toBe("regular")
    expect(normalizeEquipmentDataset(" placed ")).toBe("placed")
  })

  it("keeps user-facing labels attached to each dataset", () => {
    expect(EQUIPMENT_DATASET_LABELS).toEqual({
      regular: "Thiết bị thường",
      placed: "Thiết bị đặt",
    })
  })

  it("classifies borrowed funding values after trimming surrounding whitespace", () => {
    expect(isPlacedEquipment("Mượn")).toBe(true)
    expect(isPlacedEquipment("  Mượn ")).toBe(true)
    expect(isPlacedEquipment(null)).toBe(false)
    expect(isPlacedEquipment("Mua sắm")).toBe(false)
  })
})
