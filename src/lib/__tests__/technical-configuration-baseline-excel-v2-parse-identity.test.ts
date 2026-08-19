import { describe, expect, it, vi } from "vitest"

import * as parseContract from "@/lib/technical-configuration-baseline-excel-v2-parse-contract"
import {
  CURRENT_DATA_GROUPS,
  createWorkbookSheet,
  EXISTING_HIERARCHY,
  expectWorkbookV2Result,
  expectWorkbookIssue,
  METADATA,
  parseWorkbook,
} from "@/lib/__tests__/technical-configuration-baseline-excel-v2-parse-fixtures"
import { createTechnicalConfigurationBaselineWorkbookV2Model } from "@/lib/technical-configuration-baseline-excel-v2-contract"
import { createTechnicalConfigurationBaselineWorkbookV2 } from "@/lib/technical-configuration-baseline-excel-v2-export"
import { parseTechnicalConfigurationBaselineWorkbookV2Rows } from "@/lib/technical-configuration-baseline-excel-v2-parse-rows"

describe("technical configuration baseline XLSX v2 parser identity", () => {
  it("preserves authoritative titles when optional hidden parent hints are missing or tampered", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )
    const configuration = workbook.getWorksheet("Nhập cấu hình")!
    configuration.getCell("C3").value = null
    configuration.getCell("G3").value = "Tiêu đề đã bị sửa"
    configuration.getCell("C5").value = null
    configuration.getCell("D5").value = null
    configuration.getCell("G5").value = null

    const result = await parseWorkbook(workbook)
    expectWorkbookV2Result(result)

    expect(result.rows.filter((row) => row.row_type === "CRITERION")).toEqual([
      expect.objectContaining({
        criterion_id: "criterion-direct",
        criterion_code: "TC-001",
        criterion_title: "Tiêu đề trực tiếp",
      }),
      expect.objectContaining({
        criterion_id: "criterion-subgroup",
        criterion_code: "TC-002",
        criterion_title: "Tiêu đề nhóm con",
      }),
    ])
  })

  it("treats fully missing criterion identity as a new criterion with no title", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )
    const configuration = workbook.getWorksheet("Nhập cấu hình")!
    for (let column = 3; column <= 6; column += 1) {
      configuration.getRow(3).getCell(column).value = null
    }
    configuration.getCell("G3").value = "Không được dùng cho tiêu chí mới"

    const result = await parseWorkbook(workbook)
    expectWorkbookV2Result(result)
    const criterion = result.rows.find((row) => row.row === 3)

    expect(criterion).toMatchObject({
      row_type: "CRITERION",
      criterion_id: null,
      criterion_code: null,
      criterion_title: null,
      requirement_text: "Tiêu chí trực tiếp",
    })
  })

  it("normalizes reordered sections from physical row order", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )
    const configuration = workbook.getWorksheet("Nhập cấu hình")!
    const movedSection = Array.from(
      { length: 7 },
      (_, index) => configuration.getRow(6).getCell(index + 1).value
    )
    configuration.spliceRows(6, 1)
    configuration.spliceRows(2, 0, movedSection)

    const result = await parseWorkbook(workbook)
    expectWorkbookV2Result(result)

    expect(result.rows.filter((row) => row.row_type === "GROUP")).toEqual([
      expect.objectContaining({
        row: 2,
        group_order: 1,
        group_id: "section-2",
      }),
      expect.objectContaining({
        row: 3,
        group_order: 2,
        group_id: "section-1",
      }),
    ])
  })

  it("keeps inserted rows, omits deleted rows, and regenerates criterion order", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )
    const configuration = workbook.getWorksheet("Nhập cấu hình")!
    configuration.spliceRows(4, 0, [
      null,
      "Tiêu chí được chèn",
      null,
      null,
      null,
      null,
      "Title ẩn không được dùng",
    ])
    configuration.spliceRows(6, 1)

    const result = await parseWorkbook(workbook)
    expectWorkbookV2Result(result)
    const criteria = result.rows.filter((row) => row.row_type === "CRITERION")

    expect(criteria).toEqual([
      expect.objectContaining({
        row: 3,
        criterion_order: 1,
        criterion_id: "criterion-direct",
      }),
      expect.objectContaining({
        row: 4,
        criterion_order: 2,
        criterion_id: null,
        criterion_title: null,
        requirement_text: "Tiêu chí được chèn",
      }),
    ])
    expect(criteria.some((row) => row.criterion_id === "criterion-subgroup")).toBe(false)
  })

  it("preserves criterion identity and title when the row moves to another section", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )
    const configuration = workbook.getWorksheet("Nhập cấu hình")!
    const movedCriterion = Array.from(
      { length: 7 },
      (_, index) => configuration.getRow(3).getCell(index + 1).value
    )
    configuration.spliceRows(3, 1)
    configuration.spliceRows(6, 0, movedCriterion)

    const result = await parseWorkbook(workbook)
    expectWorkbookV2Result(result)
    const moved = result.rows.find(
      (row) => row.row_type === "CRITERION" && row.criterion_id === "criterion-direct"
    )

    expect(moved).toMatchObject({
      row: 6,
      group_order: 2,
      subgroup_order: null,
      criterion_order: 1,
      criterion_title: "Tiêu đề trực tiếp",
    })
  })

  it("normalizes direct-to-subgroup, subgroup-to-direct, and subgroup-to-subgroup moves", async () => {
    const cases = [
      {
        expected: {
          criterion_id: "criterion-direct",
          group_order: 1,
          subgroup_order: 1,
          criterion_order: 2,
          criterion_title: "Tiêu đề trực tiếp",
        },
        move: (configuration: ReturnType<typeof createWorkbookSheet>) => {
          const directCriterion = Array.from(
            { length: 7 },
            (_, index) => configuration.getRow(3).getCell(index + 1).value
          )
          configuration.spliceRows(3, 1)
          configuration.spliceRows(5, 0, directCriterion)
        },
      },
      {
        expected: {
          criterion_id: "criterion-subgroup",
          group_order: 2,
          subgroup_order: null,
          criterion_order: 1,
          criterion_title: "Tiêu đề nhóm con",
        },
        move: (configuration: ReturnType<typeof createWorkbookSheet>) => {
          const subgroupCriterion = Array.from(
            { length: 7 },
            (_, index) => configuration.getRow(5).getCell(index + 1).value
          )
          configuration.spliceRows(5, 1)
          configuration.spliceRows(6, 0, subgroupCriterion)
        },
      },
      {
        expected: {
          criterion_id: "criterion-subgroup",
          group_order: 2,
          subgroup_order: 1,
          criterion_order: 1,
          criterion_title: "Tiêu đề nhóm con",
        },
        move: (configuration: ReturnType<typeof createWorkbookSheet>) => {
          const subgroupCriterion = Array.from(
            { length: 7 },
            (_, index) => configuration.getRow(5).getCell(index + 1).value
          )
          configuration.spliceRows(5, 1)
          configuration.spliceRows(6, 0, [1, "Nhóm con mới"], subgroupCriterion)
        },
      },
    ] as const

    for (const testCase of cases) {
      const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
        createTechnicalConfigurationBaselineWorkbookV2Model({
          intent: "current-data",
          metadata: METADATA,
          groups: CURRENT_DATA_GROUPS,
        })
      )
      const configuration = createWorkbookSheet(workbook)
      testCase.move(configuration)
      const result = await parseWorkbook(workbook)
      expectWorkbookV2Result(result)

      expect(
        result.rows.find(
          (row) =>
            row.row_type === "CRITERION" && row.criterion_id === testCase.expected.criterion_id
        )
      ).toMatchObject(testCase.expected)
    }
  })

  it("rejects partial, duplicate, and wrong-kind hidden identity", async () => {
    const cases = [
      {
        expected: { code: "partial_identity", row: 3 },
        mutate: (configuration: ReturnType<typeof createWorkbookSheet>) => {
          configuration.getCell("F3").value = null
        },
      },
      {
        expected: { code: "wrong_identity_kind", row: 2 },
        mutate: (configuration: ReturnType<typeof createWorkbookSheet>) => {
          configuration.getCell("E2").value = "criterion-direct"
        },
      },
      {
        expected: { code: "duplicate_identity", row: 6, column: "criterion_id" },
        mutate: (configuration: ReturnType<typeof createWorkbookSheet>) => {
          const duplicate = Array.from(
            { length: 7 },
            (_, index) => configuration.getRow(3).getCell(index + 1).value
          )
          configuration.spliceRows(6, 0, duplicate)
        },
      },
    ] as const

    for (const testCase of cases) {
      const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
        createTechnicalConfigurationBaselineWorkbookV2Model({
          intent: "current-data",
          metadata: METADATA,
          groups: CURRENT_DATA_GROUPS,
        })
      )
      const configuration = createWorkbookSheet(workbook)
      testCase.mutate(configuration)
      await expectWorkbookIssue(workbook, testCase.expected)
    }
  })

  it("defers hidden identity membership and criterion-code ownership to server preview", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )
    const configuration = createWorkbookSheet(workbook)
    configuration.getCell("C2").value = "foreign-section"
    configuration.getCell("E3").value = "foreign-criterion"
    configuration.getCell("F3").value = "TC-999"

    const result = await parseWorkbook(workbook)
    expectWorkbookV2Result(result)

    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          row_type: "GROUP",
          group_id: "foreign-section",
        }),
        expect.objectContaining({
          row: 3,
          row_type: "CRITERION",
          criterion_id: "foreign-criterion",
          criterion_code: "TC-999",
        }),
      ])
    )
  })

  it("does not attach criteria after an invalid subgroup to the previous valid subgroup", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )
    const configuration = createWorkbookSheet(workbook)
    const invalidSubgroup = Array.from(
      { length: 7 },
      (_, index) => configuration.getRow(4).getCell(index + 1).value
    )
    invalidSubgroup[4] = "criterion-direct"
    invalidSubgroup[5] = "TC-001"
    configuration.spliceRows(5, 0, invalidSubgroup)
    const throwIssues = vi
      .spyOn(parseContract, "throwIfTechnicalConfigurationBaselineWorkbookV2Issues")
      .mockImplementation(() => undefined)

    try {
      const rows = parseTechnicalConfigurationBaselineWorkbookV2Rows(
        configuration,
        EXISTING_HIERARCHY
      )

      expect(rows).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            row: 6,
            criterion_id: "criterion-subgroup",
            subgroup_order: 1,
          }),
        ])
      )
    } finally {
      throwIssues.mockRestore()
    }
  })
})
