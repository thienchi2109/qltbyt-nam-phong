import { describe, expect, it } from "vitest"

import type { EquipmentAggregateSearchRow } from "../../hooks/use-equipment-aggregate-search.types"
import { getEquipmentSearchMaxCount } from "../equipment-search-report-tab.utils"

function createRow(equipmentCount: number): EquipmentAggregateSearchRow {
  return {
    groupType: "region",
    groupId: equipmentCount,
    groupName: `Khu vực ${equipmentCount}`,
    parentRegionId: null,
    parentRegionName: null,
    equipmentCount,
    facilityCount: 1,
    quotaCurrentCount: null,
    quotaMinCount: null,
    quotaMaxCount: null,
    quotaStatus: null,
  }
}

describe("equipment-search-report-tab.utils", () => {
  it("computes the max equipment count without spreading rows onto the call stack", () => {
    const rows = Array.from({ length: 150_000 }, (_, index) => createRow(index + 1))

    expect(getEquipmentSearchMaxCount(rows)).toBe(150_000)
  })

  it("uses one as the minimum chart scale for empty rows", () => {
    expect(getEquipmentSearchMaxCount([])).toBe(1)
  })
})
