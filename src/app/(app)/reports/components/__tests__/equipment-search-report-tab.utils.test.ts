import { describe, expect, it } from "vitest"

import type {
  EquipmentAggregateSearchQuotaStatus,
  EquipmentAggregateSearchRow,
} from "../../hooks/use-equipment-aggregate-search.types"
import {
  getEquipmentSearchMaxCount,
  getEquipmentSearchQuotaContext,
} from "../equipment-search-report-tab.utils"

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

function createFacilityRow(
  quotaStatus: EquipmentAggregateSearchQuotaStatus | null,
  overrides: Partial<EquipmentAggregateSearchRow> = {}
): EquipmentAggregateSearchRow {
  return {
    groupType: "facility",
    groupId: 100,
    groupName: "Bệnh viện kiểm thử",
    parentRegionId: 10,
    parentRegionName: "Miền Bắc",
    equipmentCount: 100,
    facilityCount: null,
    quotaCurrentCount: 100,
    quotaMinCount: null,
    quotaMaxCount: 150,
    quotaStatus,
    ...overrides,
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

  it("formats quota ratios from available current, minimum, and maximum counts", () => {
    expect(getEquipmentSearchQuotaContext(createFacilityRow("within_limit")).quotaDisplay).toBe(
      "100/150"
    )
    expect(
      getEquipmentSearchQuotaContext(
        createFacilityRow("within_limit", { quotaCurrentCount: 5, quotaMinCount: 10 })
      ).quotaDisplay
    ).toBe("5/10-150")
    expect(
      getEquipmentSearchQuotaContext(
        createFacilityRow("below_minimum", {
          quotaCurrentCount: 3,
          quotaMinCount: 5,
          quotaMaxCount: null,
        })
      ).quotaDisplay
    ).toBe("3/5")
  })

  it("uses a dash when quota ratio counts are not available", () => {
    expect(
      getEquipmentSearchQuotaContext(
        createFacilityRow("no_active_quota", {
          quotaCurrentCount: null,
          quotaMinCount: null,
          quotaMaxCount: null,
        })
      ).quotaDisplay
    ).toBe("-")
  })

  it.each([
    ["within_limit", "Trong giới hạn định mức"],
    ["below_minimum", "Dưới mức tối thiểu"],
    ["over_limit", "Vượt giới hạn định mức"],
    ["no_active_quota", "Chưa có định mức"],
    ["unassigned_category", "Chưa gán danh mục định mức"],
    ["not_in_unit_quota", "Chưa được gán vào định mức của đơn vị"],
  ] as const)("maps %s to the exact quota status label", (quotaStatus, statusLabel) => {
    expect(getEquipmentSearchQuotaContext(createFacilityRow(quotaStatus)).statusLabel).toBe(
      statusLabel
    )
  })

  it("prepends the mixed quota-group note and chooses a primary translated status", () => {
    expect(
      getEquipmentSearchQuotaContext(
        createFacilityRow("mixed", {
          quotaNotes: ["within_limit", "over_limit", "unassigned_category"],
        })
      )
    ).toMatchObject({
      statusLabel: "Chưa gán danh mục định mức",
      notesText:
        "Gồm nhiều nhóm định mức; Trong giới hạn định mức; Vượt giới hạn định mức; Chưa gán danh mục định mức",
    })
  })

  it("leaves inherited object keys as neutral quota notes", () => {
    expect(
      getEquipmentSearchQuotaContext(
        createFacilityRow("mixed", {
          quotaNotes: ["toString"],
        })
      )
    ).toMatchObject({
      statusLabel: "-",
      notesText: "Gồm nhiều nhóm định mức; toString",
    })
  })
})
