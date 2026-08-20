import { describe, expect, it, vi } from "vitest"

import { createTechnicalConfigurationBaselineWorkbookV2 } from "@/lib/technical-configuration-baseline-excel-v2-export"
import {
  parseTechnicalConfigurationBaselineWorkbookFile,
  parseTechnicalConfigurationBaselineWorkbookV2,
  TechnicalConfigurationBaselineWorkbookV2Error,
} from "@/lib/technical-configuration-baseline-excel-v2-parse"
import {
  createTechnicalConfigurationBaselineWorkbookV2Model,
  toTechnicalConfigurationBaselineRomanOrdinal,
} from "@/lib/technical-configuration-baseline-excel-v2-contract"
import {
  CURRENT_DATA_GROUPS,
  EXISTING_HIERARCHY,
  expectWorkbookV2Result,
  METADATA,
  toUploadedFile,
  toXlsxFile,
} from "@/lib/__tests__/technical-configuration-baseline-excel-v2-parse-fixtures"

function expectInMemoryWorkbookIssue(
  workbook: Awaited<ReturnType<typeof createTechnicalConfigurationBaselineWorkbookV2>>,
  expected: { code: string; row?: number; column?: string }
) {
  try {
    parseTechnicalConfigurationBaselineWorkbookV2(workbook, {
      existingHierarchy: { groups: [], subgroups: [], criteria: [] },
    })
    throw new Error("Expected workbook parsing to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(TechnicalConfigurationBaselineWorkbookV2Error)
    expect((error as TechnicalConfigurationBaselineWorkbookV2Error).issues).toEqual(
      expect.arrayContaining([expect.objectContaining(expected)])
    )
  }
}

describe("technical configuration baseline XLSX v2 parser", () => {
  it("round-trips P3A output while inferring row kinds and normalizing numbering", async () => {
    const model = createTechnicalConfigurationBaselineWorkbookV2Model({
      intent: "current-data",
      metadata: METADATA,
      groups: CURRENT_DATA_GROUPS,
    })
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(model)
    const configuration = workbook.getWorksheet("Nhập cấu hình")
    expect(configuration).toBeDefined()
    if (!configuration) return

    expect(configuration.getCell("A3").value).toBe("Tiêu đề trực tiếp")
    expect(configuration.getCell("A5").value).toBe("Tiêu đề nhóm con")
    configuration.getCell("A2").value = "V"
    configuration.getCell("A4").value = 9
    const bytes = await workbook.xlsx.writeBuffer()
    const file = toUploadedFile(bytes, "baseline.xlsx")

    const result = await parseTechnicalConfigurationBaselineWorkbookFile(file, {
      existingHierarchy: EXISTING_HIERARCHY,
    })

    expect(result).toEqual({
      format: "v2",
      metadata: {
        template_kind: "technical_configuration_baseline",
        template_version: 2,
        ...METADATA,
      },
      rows: [
        {
          row: 2,
          row_type: "GROUP",
          group_order: 1,
          group_id: "section-1",
          group_name: "Yêu cầu chung",
        },
        {
          row: 3,
          row_type: "CRITERION",
          group_order: 1,
          subgroup_order: null,
          criterion_order: 1,
          criterion_id: "criterion-direct",
          criterion_code: "TC-001",
          criterion_title: "Tiêu đề trực tiếp",
          requirement_text: "Tiêu chí trực tiếp",
        },
        {
          row: 4,
          row_type: "SUBGROUP",
          group_order: 1,
          subgroup_order: 1,
          subgroup_id: "subgroup-1",
          subgroup_name: "Điều kiện vận hành",
        },
        {
          row: 5,
          row_type: "CRITERION",
          group_order: 1,
          subgroup_order: 1,
          criterion_order: 2,
          criterion_id: "criterion-subgroup",
          criterion_code: "TC-002",
          criterion_title: "Tiêu đề nhóm con",
          requirement_text: "Hoạt động ổn định ở 40 °C",
        },
        {
          row: 6,
          row_type: "GROUP",
          group_order: 2,
          group_id: "section-2",
          group_name: "Yêu cầu khác",
        },
      ],
    })
  })

  it("parses populated rows after blank physical row gaps", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "blank-template",
        metadata: METADATA,
      })
    )
    const configuration = workbook.getWorksheet("Nhập cấu hình")!
    configuration.getRow(2).values = ["I", "Mục chính"]
    configuration.getRow(10).values = [null, "Tiêu chí sau khoảng trống"]
    const bytes = await workbook.xlsx.writeBuffer()

    const result = await parseTechnicalConfigurationBaselineWorkbookFile(
      toUploadedFile(bytes, "baseline.xlsx"),
      { existingHierarchy: { groups: [], subgroups: [], criteria: [] } }
    )
    expectWorkbookV2Result(result)

    expect(result.rows).toEqual([
      expect.objectContaining({ row: 2, row_type: "GROUP", group_order: 1 }),
      expect.objectContaining({
        row: 10,
        row_type: "CRITERION",
        criterion_order: 1,
        requirement_text: "Tiêu chí sau khoảng trống",
      }),
    ])
  })

  it("accepts the Roman marker generated for section 4,000", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "blank-template",
        metadata: METADATA,
      })
    )
    const configuration = workbook.getWorksheet("Nhập cấu hình")!
    configuration.addRow([toTechnicalConfigurationBaselineRomanOrdinal(4_000), "Mục chính"])
    const bytes = await workbook.xlsx.writeBuffer()

    const result = await parseTechnicalConfigurationBaselineWorkbookFile(
      toUploadedFile(bytes, "baseline.xlsx"),
      { existingHierarchy: { groups: [], subgroups: [], criteria: [] } }
    )
    expectWorkbookV2Result(result)

    expect(result.rows).toEqual([
      expect.objectContaining({ row_type: "GROUP", group_order: 1, group_name: "Mục chính" }),
    ])
  })

  it("rejects non-scalar values in columns outside the exact contract", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "blank-template",
        metadata: METADATA,
      })
    )
    const configuration = workbook.getWorksheet("Nhập cấu hình")!
    configuration.addRow(["I", "Mục chính"])
    configuration.getCell("H2").value = {
      text: "Liên kết ngoài contract",
      hyperlink: "https://example.com",
    }

    expectInMemoryWorkbookIssue(workbook, { code: "invalid_columns", row: 1 })
  })

  it("rejects extreme sparse coordinates without dense row traversal", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "blank-template",
        metadata: METADATA,
      })
    )
    const configuration = workbook.getWorksheet("Nhập cấu hình")!
    configuration.getCell("XFD1048576").value = "Ngoài contract"
    const originalGetRow = configuration.getRow.bind(configuration)
    const getRow = vi.spyOn(configuration, "getRow").mockImplementation((rowNumber) => {
      if (rowNumber !== 1 && rowNumber !== 1_048_576) {
        throw new Error(`Dense row traversal reached row ${rowNumber}`)
      }
      return originalGetRow(rowNumber)
    })

    expectInMemoryWorkbookIssue(workbook, { code: "invalid_columns", row: 1 })
    expect(getRow.mock.calls.every(([rowNumber]) => rowNumber === 1)).toBe(true)
  })

  it("rejects unsupported STT markers with the physical worksheet row", async () => {
    const model = createTechnicalConfigurationBaselineWorkbookV2Model({
      intent: "current-data",
      metadata: METADATA,
      groups: CURRENT_DATA_GROUPS,
    })
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(model)
    workbook.getWorksheet("Nhập cấu hình")!.getCell("A4").value = "1.1"
    const bytes = await workbook.xlsx.writeBuffer()
    const file = toUploadedFile(bytes, "baseline.xlsx")

    await expect(
      parseTechnicalConfigurationBaselineWorkbookFile(file, {
        existingHierarchy: EXISTING_HIERARCHY,
      })
    ).rejects.toMatchObject<TechnicalConfigurationBaselineWorkbookV2Error>({
      issues: [
        expect.objectContaining({
          code: "unsupported_marker",
          row: 4,
          column: "stt",
        }),
      ],
    })
  })

  it("accepts a serialized workbook produced by the P3A codec", async () => {
    const file = await toXlsxFile(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )

    const result = await parseTechnicalConfigurationBaselineWorkbookFile(file, {
      existingHierarchy: EXISTING_HIERARCHY,
    })

    expect(result.format).toBe("v2")
  })

  it("rejects changed headers instead of normalizing the column contract", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )
    workbook.getWorksheet("Nhập cấu hình")!.getCell("A1").value = "STT "
    const bytes = await workbook.xlsx.writeBuffer()

    await expect(
      parseTechnicalConfigurationBaselineWorkbookFile(toUploadedFile(bytes, "baseline.xlsx"), {
        existingHierarchy: EXISTING_HIERARCHY,
      })
    ).rejects.toMatchObject<TechnicalConfigurationBaselineWorkbookV2Error>({
      issues: [expect.objectContaining({ code: "invalid_columns", row: 1 })],
    })
  })

  it("rejects the removed visible criterion title header", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )
    workbook.getWorksheet("Nhập cấu hình")!.getCell("G1").value = "TIÊU ĐỀ (THAM CHIẾU)"
    const bytes = await workbook.xlsx.writeBuffer()

    await expect(
      parseTechnicalConfigurationBaselineWorkbookFile(toUploadedFile(bytes, "baseline.xlsx"), {
        existingHierarchy: EXISTING_HIERARCHY,
      })
    ).rejects.toMatchObject<TechnicalConfigurationBaselineWorkbookV2Error>({
      issues: [expect.objectContaining({ code: "invalid_columns", row: 1 })],
    })
  })

  it("rejects unsupported cell objects with the physical worksheet row", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )
    workbook.getWorksheet("Nhập cấu hình")!.getCell("B3").value = {
      text: "Tiêu chí trực tiếp",
      hyperlink: "https://example.com",
    }
    const bytes = await workbook.xlsx.writeBuffer()

    await expect(
      parseTechnicalConfigurationBaselineWorkbookFile(toUploadedFile(bytes, "baseline.xlsx"), {
        existingHierarchy: EXISTING_HIERARCHY,
      })
    ).rejects.toMatchObject<TechnicalConfigurationBaselineWorkbookV2Error>({
      issues: [
        expect.objectContaining({
          code: "invalid_cell_value",
          row: 3,
          column: "content",
        }),
      ],
    })
  })

  it("rejects metadata rows outside the exact versioned contract", async () => {
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
      createTechnicalConfigurationBaselineWorkbookV2Model({
        intent: "current-data",
        metadata: METADATA,
        groups: CURRENT_DATA_GROUPS,
      })
    )
    workbook.getWorksheet("_meta")!.addRow(["unexpected", "value"])
    const bytes = await workbook.xlsx.writeBuffer()

    await expect(
      parseTechnicalConfigurationBaselineWorkbookFile(toUploadedFile(bytes, "baseline.xlsx"), {
        existingHierarchy: EXISTING_HIERARCHY,
      })
    ).rejects.toMatchObject<TechnicalConfigurationBaselineWorkbookV2Error>({
      issues: [expect.objectContaining({ code: "invalid_metadata", row: 8 })],
    })
  })
})
