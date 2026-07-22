import { describe, expect, it } from "vitest"

import {
  DECOMMISSIONED_EQUIPMENT_STATUS,
  didEnterLiquidationEndState,
  isLiquidationEndState,
  LIQUIDATION_DEPARTMENT_NAME,
} from "../EquipmentEditTransitions"

const activeEquipment = {
  khoa_phong_quan_ly: "Khoa Hồi sức",
  tinh_trang_hien_tai: "Hoạt động",
}

const liquidationEquipment = {
  khoa_phong_quan_ly: LIQUIDATION_DEPARTMENT_NAME,
  tinh_trang_hien_tai: DECOMMISSIONED_EQUIPMENT_STATUS,
}

describe("equipment liquidation transition", () => {
  it.each([
    {
      name: "only department changes because status already matches",
      before: {
        khoa_phong_quan_ly: activeEquipment.khoa_phong_quan_ly,
        tinh_trang_hien_tai: DECOMMISSIONED_EQUIPMENT_STATUS,
      },
    },
    {
      name: "only status changes because department already matches",
      before: {
        khoa_phong_quan_ly: LIQUIDATION_DEPARTMENT_NAME,
        tinh_trang_hien_tai: activeEquipment.tinh_trang_hien_tai,
      },
    },
    {
      name: "both required values change",
      before: activeEquipment,
    },
  ])("detects entering the end state when $name", ({ before }) => {
    expect(didEnterLiquidationEndState(before, liquidationEquipment)).toBe(true)
  })

  it.each([
    {
      name: "only status matches",
      after: {
        khoa_phong_quan_ly: activeEquipment.khoa_phong_quan_ly,
        tinh_trang_hien_tai: DECOMMISSIONED_EQUIPMENT_STATUS,
      },
    },
    {
      name: "only department matches",
      after: {
        khoa_phong_quan_ly: LIQUIDATION_DEPARTMENT_NAME,
        tinh_trang_hien_tai: activeEquipment.tinh_trang_hien_tai,
      },
    },
    {
      name: "department is only a partial match",
      after: {
        khoa_phong_quan_ly: `${LIQUIDATION_DEPARTMENT_NAME} PHỤ`,
        tinh_trang_hien_tai: DECOMMISSIONED_EQUIPMENT_STATUS,
      },
    },
  ])("returns false when $name", ({ after }) => {
    expect(didEnterLiquidationEndState(activeEquipment, after)).toBe(false)
  })

  it("does not report a transition for an unrelated edit to an already matching device", () => {
    expect(didEnterLiquidationEndState(liquidationEquipment, liquidationEquipment)).toBe(false)
  })

  it("normalizes the department while accepting the trimmed canonical status", () => {
    const equivalentValues = {
      khoa_phong_quan_ly: ` ${LIQUIDATION_DEPARTMENT_NAME.normalize("NFD").toLocaleLowerCase(
        "vi-VN"
      )} `,
      tinh_trang_hien_tai: ` ${DECOMMISSIONED_EQUIPMENT_STATUS} `,
    }

    expect(isLiquidationEndState(equivalentValues)).toBe(true)
    expect(didEnterLiquidationEndState(activeEquipment, equivalentValues)).toBe(true)
  })

  it.each([
    {
      name: "case variant",
      status: DECOMMISSIONED_EQUIPMENT_STATUS.toLocaleUpperCase("vi-VN"),
    },
    {
      name: "Unicode decomposition variant",
      status: DECOMMISSIONED_EQUIPMENT_STATUS.normalize("NFD"),
    },
  ])("rejects a non-canonical status $name", ({ status }) => {
    const nonCanonicalValues = {
      khoa_phong_quan_ly: LIQUIDATION_DEPARTMENT_NAME,
      tinh_trang_hien_tai: status,
    }

    expect(isLiquidationEndState(nonCanonicalValues)).toBe(false)
    expect(didEnterLiquidationEndState(activeEquipment, nonCanonicalValues)).toBe(false)
  })

  it("matches the server department normalization for hyphens and internal whitespace", () => {
    const serverEquivalentValues = {
      khoa_phong_quan_ly: "\u00a0VT---TBYT\tKHO   THANH LÍ\n",
      tinh_trang_hien_tai: DECOMMISSIONED_EQUIPMENT_STATUS,
    }

    expect(isLiquidationEndState(serverEquivalentValues)).toBe(true)
    expect(didEnterLiquidationEndState(activeEquipment, serverEquivalentValues)).toBe(true)
  })
})
