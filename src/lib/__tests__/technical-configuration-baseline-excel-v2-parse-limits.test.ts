import { describe, expect, it, vi } from "vitest"

import {
  CSV_DERIVED_ROWS,
  METADATA as LEGACY_METADATA,
  createCsvDerivedWorkbook,
} from "@/lib/__tests__/technical-configuration-baseline-excel-fixtures"
import {
  EXISTING_HIERARCHY,
  METADATA,
  toUploadedFile,
} from "@/lib/__tests__/technical-configuration-baseline-excel-v2-parse-fixtures"
import type { TechnicalConfigurationBaselineWorkbookRow } from "@/lib/technical-configuration-baseline-excel-contract"
import { createTechnicalConfigurationBaselineWorkbook } from "@/lib/technical-configuration-baseline-excel-export"
import { createTechnicalConfigurationBaselineWorkbookV2Model } from "@/lib/technical-configuration-baseline-excel-v2-contract"
import { createTechnicalConfigurationBaselineWorkbookV2 } from "@/lib/technical-configuration-baseline-excel-v2-export"
import {
  BASELINE_WORKBOOK_MAX_FILE_BYTES,
  BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS,
  parseTechnicalConfigurationBaselineWorkbookFile,
  parseTechnicalConfigurationBaselineWorkbookV2,
  TechnicalConfigurationBaselineWorkbookV2Error,
} from "@/lib/technical-configuration-baseline-excel-v2-parse"

const EMPTY_HIERARCHY = {
  groups: [],
  subgroups: [],
  criteria: [],
} as const

const LEGACY_EXISTING_HIERARCHY = {
  ...EXISTING_HIERARCHY,
  criteria: [
    ...EXISTING_HIERARCHY.criteria,
    {
      id: "legacy-criterion",
      criterion_code: "TC-0007",
      title: "Môi trường hoạt động",
      group_id: "legacy-group",
      subgroup_id: null,
    },
  ],
}

async function createMeaningfulRowsFile(rowCount: number): Promise<File> {
  const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
    createTechnicalConfigurationBaselineWorkbookV2Model({
      intent: "blank-template",
      metadata: METADATA,
    })
  )
  const configuration = workbook.getWorksheet("Nhập cấu hình")!
  configuration.addRow(["IX", "Mục chính"])
  for (let index = 1; index < rowCount; index += 1) {
    configuration.addRow([null, `Tiêu chí ${index}`])
  }
  const bytes = await workbook.xlsx.writeBuffer()
  return toUploadedFile(bytes, "baseline.xlsx")
}

async function createExtraColumnRowsWorkbook(rowCount: number) {
  const workbook = await createTechnicalConfigurationBaselineWorkbookV2(
    createTechnicalConfigurationBaselineWorkbookV2Model({
      intent: "blank-template",
      metadata: METADATA,
    })
  )
  const configuration = workbook.getWorksheet("Nhập cấu hình")!
  for (let index = 0; index < rowCount; index += 1) {
    configuration.getRow(index * 2 + 2).getCell(8).value = `Ngoài contract ${index + 1}`
  }
  return workbook
}

async function createLegacyMeaningfulRowsFile(rowCount: number): Promise<File> {
  const rows: TechnicalConfigurationBaselineWorkbookRow[] = Array.from(
    { length: rowCount },
    (_, index) =>
      index === 0
        ? {
            row_type: "GROUP",
            group_order: 1,
            group_name: "Mục chính",
            criterion_order: null,
            criterion_code: null,
            criterion_title: null,
            requirement_text: null,
          }
        : {
            row_type: "CRITERION",
            group_order: 1,
            group_name: null,
            criterion_order: index,
            criterion_code: null,
            criterion_title: null,
            requirement_text: `Tiêu chí ${index}`,
          }
  )
  const workbook = await createTechnicalConfigurationBaselineWorkbook({
    metadata: LEGACY_METADATA,
    rows,
  })
  const bytes = await workbook.xlsx.writeBuffer()
  return toUploadedFile(bytes, "legacy-baseline.xlsx")
}

async function expectFileIssue(file: File, code: string, messagePattern?: RegExp) {
  try {
    await parseTechnicalConfigurationBaselineWorkbookFile(file, {
      existingHierarchy: EMPTY_HIERARCHY,
    })
    throw new Error("Expected workbook parsing to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(TechnicalConfigurationBaselineWorkbookV2Error)
    expect((error as TechnicalConfigurationBaselineWorkbookV2Error).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code,
          ...(messagePattern ? { message: expect.stringMatching(messagePattern) } : {}),
        }),
      ])
    )
  }
}

function expectWorkbookIssue(action: () => unknown, code: string, messagePattern?: RegExp) {
  try {
    action()
    throw new Error("Expected workbook parsing to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(TechnicalConfigurationBaselineWorkbookV2Error)
    expect((error as TechnicalConfigurationBaselineWorkbookV2Error).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code,
          ...(messagePattern ? { message: expect.stringMatching(messagePattern) } : {}),
        }),
      ])
    )
  }
}

describe("technical configuration baseline XLSX parser limits and compatibility", () => {
  it.each(["baseline.csv", "baseline.xls", "baseline.json"])(
    "rejects non-XLSX file %s before reading bytes",
    async (name) => {
      const arrayBuffer = vi.fn(async () => new ArrayBuffer(0))
      const file = {
        name,
        size: 0,
        arrayBuffer,
      } as unknown as File

      await expectFileIssue(file, "invalid_file_type")
      expect(arrayBuffer).not.toHaveBeenCalled()
    }
  )

  it("rejects files above 5 MiB before reading bytes", async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0))
    const file = {
      name: "baseline.xlsx",
      size: BASELINE_WORKBOOK_MAX_FILE_BYTES + 1,
      arrayBuffer,
    } as unknown as File

    await expectFileIssue(
      file,
      "file_too_large",
      new RegExp(`${BASELINE_WORKBOOK_MAX_FILE_BYTES + 1}.*${BASELINE_WORKBOOK_MAX_FILE_BYTES}`)
    )
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it("allows a file at exactly 5 MiB to reach workbook parsing", async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0))
    const file = {
      name: "baseline.xlsx",
      size: BASELINE_WORKBOOK_MAX_FILE_BYTES,
      arrayBuffer,
    } as unknown as File

    await expectFileIssue(file, "workbook_read_error")
    expect(arrayBuffer).toHaveBeenCalledOnce()
  })

  it("accepts exactly 5,000 meaningful rows and rejects 5,001 without truncation", async () => {
    const accepted = await parseTechnicalConfigurationBaselineWorkbookFile(
      await createMeaningfulRowsFile(BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS),
      { existingHierarchy: EMPTY_HIERARCHY }
    )
    expect(accepted.format).toBe("v2")
    if (accepted.format === "v2") {
      expect(accepted.rows).toHaveLength(BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS)
    }

    const extraColumnWorkbook = await createExtraColumnRowsWorkbook(
      BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS + 1
    )
    expectWorkbookIssue(
      () =>
        parseTechnicalConfigurationBaselineWorkbookV2(extraColumnWorkbook, {
          existingHierarchy: EMPTY_HIERARCHY,
        }),
      "meaningful_row_limit_exceeded",
      new RegExp(
        `${BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS + 1}.*${BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS}`
      )
    )
  }, 30_000)

  it("enforces the 5,000 meaningful-row limit for legacy v1 workbooks", async () => {
    const accepted = await parseTechnicalConfigurationBaselineWorkbookFile(
      await createLegacyMeaningfulRowsFile(BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS),
      { existingHierarchy: EMPTY_HIERARCHY }
    )
    expect(accepted.format).toBe("legacy")
    expect(accepted.rows).toHaveLength(BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS)

    await expectFileIssue(
      await createLegacyMeaningfulRowsFile(BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS + 1),
      "meaningful_row_limit_exceeded",
      new RegExp(
        `${BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS + 1}.*${BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS}`
      )
    )
  }, 30_000)

  it("keeps the canonical v1 workbook parser read-compatible without inventing subgroups", async () => {
    const workbook = await createCsvDerivedWorkbook()
    const bytes = await workbook.xlsx.writeBuffer()

    const result = await parseTechnicalConfigurationBaselineWorkbookFile(
      toUploadedFile(bytes, "legacy-baseline.XLSX"),
      { existingHierarchy: LEGACY_EXISTING_HIERARCHY }
    )

    expect(result).toEqual({
      format: "legacy",
      row_numbers: [2, 3, 4, 5],
      metadata: LEGACY_METADATA,
      rows: CSV_DERIVED_ROWS,
    })
    expect(result.rows.every((row) => !("subgroup_order" in row))).toBe(true)
  })

  it("preserves physical row numbers for compatible legacy workbooks with gaps", async () => {
    const criterion = CSV_DERIVED_ROWS[1]
    const workbook = await createTechnicalConfigurationBaselineWorkbook({
      metadata: LEGACY_METADATA,
      rows: [CSV_DERIVED_ROWS[0], criterion, criterion],
    })
    const baseline = workbook.getWorksheet("Baseline")!
    baseline.getRow(3).eachCell({ includeEmpty: true }, (cell) => {
      cell.value = null
    })
    const bytes = await workbook.xlsx.writeBuffer()

    const result = await parseTechnicalConfigurationBaselineWorkbookFile(
      toUploadedFile(bytes, "legacy-with-gap.xlsx"),
      { existingHierarchy: LEGACY_EXISTING_HIERARCHY }
    )

    expect(result.format).toBe("legacy")
    if (result.format === "legacy") {
      expect(result.row_numbers).toEqual([2, 4])
    }
  })

  it("excludes whitespace-only legacy rows from compatible physical row numbers", async () => {
    const criterion = CSV_DERIVED_ROWS[1]
    const workbook = await createTechnicalConfigurationBaselineWorkbook({
      metadata: LEGACY_METADATA,
      rows: [CSV_DERIVED_ROWS[0], criterion, criterion],
    })
    const baseline = workbook.getWorksheet("Baseline")!
    baseline.getRow(3).eachCell({ includeEmpty: true }, (cell) => {
      cell.value = "   "
    })
    const bytes = await workbook.xlsx.writeBuffer()

    const result = await parseTechnicalConfigurationBaselineWorkbookFile(
      toUploadedFile(bytes, "legacy-with-whitespace-gap.xlsx"),
      { existingHierarchy: LEGACY_EXISTING_HIERARCHY }
    )

    expect(result.format).toBe("legacy")
    if (result.format === "legacy") {
      expect(result.row_numbers).toEqual([2, 4])
    }
  })
})
