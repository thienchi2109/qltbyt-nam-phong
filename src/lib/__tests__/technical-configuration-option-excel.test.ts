import type { CellValue, Workbook, Worksheet } from "exceljs"
import { describe, expect, it } from "vitest"

import type { BulkImportWorkbookParser } from "@/components/bulk-import/bulk-import-types"
import {
  OPTION_WORKBOOK_COLUMNS,
  OPTION_WORKBOOK_META_KEYS,
  TechnicalConfigurationOptionWorkbookError,
  type TechnicalConfigurationOptionWorkbookIssueCode,
  type TechnicalConfigurationOptionWorkbookMetadata,
  type TechnicalConfigurationOptionWorkbookParseOptions,
  type TechnicalConfigurationOptionWorkbookRow,
} from "@/lib/technical-configuration-option-excel-contract"
import { createTechnicalConfigurationOptionWorkbook } from "@/lib/technical-configuration-option-excel-export"
import {
  createTechnicalConfigurationOptionWorkbookParser,
  parseTechnicalConfigurationOptionWorkbook,
} from "@/lib/technical-configuration-option-excel-parse"
import { readExcelFile, type ExcelWorkbook } from "@/lib/excel-workbook"

const METADATA: TechnicalConfigurationOptionWorkbookMetadata = {
  template_kind: "technical_configuration_option",
  template_version: 1,
  dossier_id: "dossier-1",
  option_id: "option-1",
  baseline_version_id: "baseline-1",
  dossier_revision: 7,
  generated_at: "2026-07-24T14:00:00.000Z",
}

const ROWS: TechnicalConfigurationOptionWorkbookRow[] = [
  {
    group_order: 1,
    group_name: "Yêu cầu kỹ thuật",
    criterion_order: 1,
    criterion_id: "criterion-1",
    criterion_code: "TC-0001",
    criterion_title: "Nguồn điện",
    requirement_text: "Điện áp 220 V\nTần số 50 Hz",
    response_text: "Đáp ứng đầy đủ\nKhông cần bộ chuyển đổi",
    supplementary_information: "Tài liệu kỹ thuật trang 12",
  },
  {
    group_order: 1,
    group_name: "Yêu cầu kỹ thuật",
    criterion_order: 2,
    criterion_id: "criterion-2",
    criterion_code: "TC-0002",
    criterion_title: null,
    requirement_text: "Hoạt động ổn định trong môi trường nhiệt đới",
    response_text: "Có",
    supplementary_information: "",
  },
]

const PARSE_OPTIONS: TechnicalConfigurationOptionWorkbookParseOptions = {
  expectedMetadata: {
    dossier_id: METADATA.dossier_id,
    option_id: METADATA.option_id,
    baseline_version_id: METADATA.baseline_version_id,
    dossier_revision: METADATA.dossier_revision,
  },
  expectedCriteria: ROWS.map(
    ({ response_text: _responseText, supplementary_information: _supplementary, ...criterion }) =>
      criterion
  ),
}

function toExcelWorkbookAdapter(workbook: Workbook): ExcelWorkbook {
  return {
    SheetNames: workbook.worksheets.map((worksheet) => worksheet.name),
    Sheets: Object.fromEntries(workbook.worksheets.map((worksheet) => [worksheet.name, worksheet])),
    _workbook: workbook,
  }
}

function getRowValues(worksheet: Worksheet, rowNumber: number, columnCount: number): unknown[] {
  return Array.from({ length: columnCount }, (_, index) => {
    const value = worksheet.getRow(rowNumber).getCell(index + 1).value
    return value === undefined ? null : value
  })
}

async function createWorkbook(): Promise<Workbook> {
  return createTechnicalConfigurationOptionWorkbook({
    metadata: METADATA,
    rows: ROWS,
  })
}

async function expectWorkbookIssue(
  workbook: Workbook,
  code: TechnicalConfigurationOptionWorkbookIssueCode
): Promise<TechnicalConfigurationOptionWorkbookError> {
  try {
    await parseTechnicalConfigurationOptionWorkbook(toExcelWorkbookAdapter(workbook), PARSE_OPTIONS)
  } catch (error) {
    expect(error).toBeInstanceOf(TechnicalConfigurationOptionWorkbookError)
    const workbookError = error as TechnicalConfigurationOptionWorkbookError
    expect(workbookError.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })])
    )
    return workbookError
  }

  throw new Error(`Expected workbook issue: ${code}`)
}

describe("technical configuration supplier-option workbook codec", () => {
  it("generates the exact OptionResponses and hidden _meta contract", async () => {
    const rowWithExcludedFields = {
      ...ROWS[0],
      document_url: "https://example.com/spec.pdf",
      citation: "Trang 12",
      assessment: "Đạt",
      supplier_id: "supplier-1",
      option_name: "Phương án A",
    }
    const workbook = await createTechnicalConfigurationOptionWorkbook({
      metadata: METADATA,
      rows: [rowWithExcludedFields, ROWS[1]],
    })

    expect(
      workbook.worksheets.map((worksheet) => ({
        name: worksheet.name,
        state: worksheet.state,
      }))
    ).toEqual([
      { name: "OptionResponses", state: "visible" },
      { name: "_meta", state: "hidden" },
    ])

    const responseSheet = workbook.getWorksheet("OptionResponses")
    const metaSheet = workbook.getWorksheet("_meta")
    expect(responseSheet).toBeDefined()
    expect(metaSheet).toBeDefined()
    expect(getRowValues(responseSheet!, 1, OPTION_WORKBOOK_COLUMNS.length)).toEqual(
      OPTION_WORKBOOK_COLUMNS
    )
    expect(getRowValues(responseSheet!, 2, OPTION_WORKBOOK_COLUMNS.length)).toEqual(
      OPTION_WORKBOOK_COLUMNS.map((column) => ROWS[0][column])
    )
    expect(getRowValues(metaSheet!, 1, 2)).toEqual(["key", "value"])
    expect(
      metaSheet!
        .getRows(2, OPTION_WORKBOOK_META_KEYS.length)
        ?.map((row) => getRowValues(metaSheet!, row.number, 2))
    ).toEqual(OPTION_WORKBOOK_META_KEYS.map((key) => [key, METADATA[key]]))
    expect(metaSheet!.actualRowCount).toBe(OPTION_WORKBOOK_META_KEYS.length + 1)
    expect(responseSheet!.columnCount).toBe(OPTION_WORKBOOK_COLUMNS.length)
    expect(getRowValues(responseSheet!, 2, responseSheet!.columnCount)).toEqual(
      OPTION_WORKBOOK_COLUMNS.map((column) => ROWS[0][column])
    )
  })

  it("round-trips Unicode and multiline text through the shared P5A loader and parser seam", async () => {
    const workbook = await createWorkbook()
    const buffer = await workbook.xlsx.writeBuffer()
    const file = {
      arrayBuffer: async () => buffer,
    } as File
    const loadedWorkbook = await readExcelFile(file)
    const parser: BulkImportWorkbookParser<
      Awaited<ReturnType<typeof parseTechnicalConfigurationOptionWorkbook>>
    > = createTechnicalConfigurationOptionWorkbookParser(PARSE_OPTIONS)

    await expect(parser(loadedWorkbook)).resolves.toEqual([
      {
        metadata: METADATA,
        rows: ROWS,
      },
    ])
  })

  it("canonicalizes blank response cells to empty strings", async () => {
    const workbook = await createWorkbook()
    const responseSheet = workbook.getWorksheet("OptionResponses")!
    responseSheet.getRow(2).getCell(8).value = null
    responseSheet.getRow(2).getCell(9).value = undefined

    await expect(
      parseTechnicalConfigurationOptionWorkbook(toExcelWorkbookAdapter(workbook), PARSE_OPTIONS)
    ).resolves.toMatchObject({
      rows: [
        {
          criterion_id: "criterion-1",
          response_text: "",
          supplementary_information: "",
        },
        ROWS[1],
      ],
    })
  })

  it("requires every expected criterion exactly once", async () => {
    const missingWorkbook = await createWorkbook()
    missingWorkbook.getWorksheet("OptionResponses")!.spliceRows(3, 1)
    await expectWorkbookIssue(missingWorkbook, "missing_criterion")

    const unknownWorkbook = await createWorkbook()
    unknownWorkbook.getWorksheet("OptionResponses")!.getRow(3).getCell(4).value =
      "criterion-unknown"
    await expectWorkbookIssue(unknownWorkbook, "unknown_criterion")

    const duplicateWorkbook = await createWorkbook()
    duplicateWorkbook.getWorksheet("OptionResponses")!.getRow(3).getCell(4).value = "criterion-1"
    await expectWorkbookIssue(duplicateWorkbook, "duplicate_criterion")
  })

  it.each([
    ["group_order", 2],
    ["group_name", "Yêu cầu khác"],
    ["criterion_order", 9],
    ["criterion_code", "TC-9999"],
    ["criterion_title", "Tiêu đề đã sửa"],
    ["requirement_text", "Yêu cầu đã sửa"],
  ] satisfies ReadonlyArray<[keyof TechnicalConfigurationOptionWorkbookRow, CellValue]>)(
    "rejects altered read-only context field %s",
    async (column, value) => {
      const workbook = await createWorkbook()
      const columnNumber = OPTION_WORKBOOK_COLUMNS.indexOf(column) + 1
      workbook.getWorksheet("OptionResponses")!.getRow(2).getCell(columnNumber).value = value

      const error = await expectWorkbookIssue(workbook, "changed_context")
      expect(error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "changed_context",
            row: 2,
            column,
          }),
        ])
      )
    }
  )

  it.each([
    ["dossier_id", "dossier-other"],
    ["option_id", "option-other"],
    ["baseline_version_id", "baseline-other"],
    ["dossier_revision", 8],
  ] as const)("rejects mismatched target metadata %s", async (key, value) => {
    const workbook = await createWorkbook()
    const metaRow = OPTION_WORKBOOK_META_KEYS.indexOf(key) + 2
    workbook.getWorksheet("_meta")!.getRow(metaRow).getCell(2).value = value

    await expectWorkbookIssue(workbook, "target_mismatch")
  })

  it("rejects missing, malformed and unsupported workbook metadata", async () => {
    const missingMetadataSheet = await createWorkbook()
    missingMetadataSheet.removeWorksheet(missingMetadataSheet.getWorksheet("_meta")!.id)
    await expectWorkbookIssue(missingMetadataSheet, "missing_sheet")

    const missingMetadata = await createWorkbook()
    missingMetadata.getWorksheet("_meta")!.spliceRows(4, 1)
    await expectWorkbookIssue(missingMetadata, "invalid_metadata")

    const wrongTemplateKind = await createWorkbook()
    const templateKindRow = OPTION_WORKBOOK_META_KEYS.indexOf("template_kind") + 2
    wrongTemplateKind.getWorksheet("_meta")!.getRow(templateKindRow).getCell(2).value =
      "technical_configuration_baseline"
    await expectWorkbookIssue(wrongTemplateKind, "invalid_metadata")

    const wrongVersion = await createWorkbook()
    const versionRow = OPTION_WORKBOOK_META_KEYS.indexOf("template_version") + 2
    wrongVersion.getWorksheet("_meta")!.getRow(versionRow).getCell(2).value = 2
    await expectWorkbookIssue(wrongVersion, "version_mismatch")

    const stringVersion = await createWorkbook()
    stringVersion.getWorksheet("_meta")!.getRow(versionRow).getCell(2).value = "1"
    await expectWorkbookIssue(stringVersion, "version_mismatch")

    const stringRevision = await createWorkbook()
    const revisionRow = OPTION_WORKBOOK_META_KEYS.indexOf("dossier_revision") + 2
    stringRevision.getWorksheet("_meta")!.getRow(revisionRow).getCell(2).value = "7"
    await expectWorkbookIssue(stringRevision, "invalid_metadata")

    const invalidTimestamp = await createWorkbook()
    const generatedAtRow = OPTION_WORKBOOK_META_KEYS.indexOf("generated_at") + 2
    invalidTimestamp.getWorksheet("_meta")!.getRow(generatedAtRow).getCell(2).value = "not-a-date"
    await expectWorkbookIssue(invalidTimestamp, "invalid_metadata")

    const numericTimestamp = await createWorkbook()
    numericTimestamp.getWorksheet("_meta")!.getRow(generatedAtRow).getCell(2).value = 0
    await expectWorkbookIssue(numericTimestamp, "invalid_metadata")
  })

  it("rejects extra sheets, columns and invalid sheet visibility", async () => {
    const extraSheet = await createWorkbook()
    extraSheet.addWorksheet("Other")
    await expectWorkbookIssue(extraSheet, "unexpected_sheet")

    const extraColumn = await createWorkbook()
    extraColumn.getWorksheet("OptionResponses")!.getRow(1).getCell(10).value = "extra"
    await expectWorkbookIssue(extraColumn, "invalid_columns")

    const extraMetadataColumn = await createWorkbook()
    extraMetadataColumn.getWorksheet("_meta")!.getRow(2).getCell(3).value = "extra"
    await expectWorkbookIssue(extraMetadataColumn, "invalid_metadata")

    const visibleMetadata = await createWorkbook()
    visibleMetadata.getWorksheet("_meta")!.state = "visible"
    await expectWorkbookIssue(visibleMetadata, "invalid_sheet_visibility")

    const hiddenResponses = await createWorkbook()
    hiddenResponses.getWorksheet("OptionResponses")!.state = "hidden"
    await expectWorkbookIssue(hiddenResponses, "invalid_sheet_visibility")
  })

  it("rejects unsupported cell values and malformed rows", async () => {
    const unsupportedValue = await createWorkbook()
    unsupportedValue.getWorksheet("OptionResponses")!.getRow(2).getCell(8).value = {
      formula: "1+1",
      result: 2,
    }
    await expectWorkbookIssue(unsupportedValue, "invalid_cell_value")

    const malformedRow = await createWorkbook()
    malformedRow.getWorksheet("OptionResponses")!.getRow(2).getCell(1).value = 0
    await expectWorkbookIssue(malformedRow, "invalid_row")
  })
})
