import { describe, expect, it } from "vitest"

import {
  BASELINE_WORKBOOK_COLUMNS,
  BASELINE_WORKBOOK_META_KEYS,
  BASELINE_WORKBOOK_SUGGESTED_GROUPS,
  type TechnicalConfigurationBaselineWorkbookParseResult,
} from "@/lib/technical-configuration-baseline-excel-contract"
import {
  createCsvDerivedWorkbook,
  CSV_DERIVED_ROWS,
  expectWorkbookIssue,
  getRowValues,
  METADATA,
  toExcelWorkbookAdapter,
} from "@/lib/__tests__/technical-configuration-baseline-excel-fixtures"
import { createTechnicalConfigurationBaselineWorkbook } from "@/lib/technical-configuration-baseline-excel-export"
import {
  createTechnicalConfigurationBaselineWorkbookParser,
  parseTechnicalConfigurationBaselineWorkbook,
} from "@/lib/technical-configuration-baseline-excel-parse"
import type { BulkImportWorkbookParser } from "@/components/bulk-import/bulk-import-types"
import { readExcelFile } from "@/lib/excel-workbook"

describe("technical configuration baseline workbook codec", () => {
  it("generates the exact Baseline and hidden _meta workbook contract", async () => {
    expect(BASELINE_WORKBOOK_SUGGESTED_GROUPS).toEqual([
      "Yêu cầu chung",
      "Yêu cầu cấu hình cung cấp",
      "Yêu cầu kỹ thuật",
      "Yêu cầu khác",
    ])

    const workbook = await createTechnicalConfigurationBaselineWorkbook({
      metadata: METADATA,
    })

    expect(
      workbook.worksheets.map((worksheet) => ({
        name: worksheet.name,
        state: worksheet.state,
      }))
    ).toEqual([
      { name: "Baseline", state: "visible" },
      { name: "_meta", state: "hidden" },
    ])

    const baseline = workbook.getWorksheet("Baseline")
    const meta = workbook.getWorksheet("_meta")

    expect(baseline).toBeDefined()
    expect(meta).toBeDefined()
    expect(getRowValues(baseline!.getRow(1), BASELINE_WORKBOOK_COLUMNS.length)).toEqual(
      BASELINE_WORKBOOK_COLUMNS
    )
    expect(
      baseline!
        .getRows(2, BASELINE_WORKBOOK_SUGGESTED_GROUPS.length)
        ?.map((row) => getRowValues(row, BASELINE_WORKBOOK_COLUMNS.length))
    ).toEqual(
      BASELINE_WORKBOOK_SUGGESTED_GROUPS.map((groupName, index) => [
        "GROUP",
        index + 1,
        groupName,
        null,
        null,
        null,
        null,
      ])
    )

    expect(getRowValues(meta!.getRow(1), 2)).toEqual(["key", "value"])
    expect(
      meta!.getRows(2, BASELINE_WORKBOOK_META_KEYS.length)?.map((row) => getRowValues(row, 2))
    ).toEqual(BASELINE_WORKBOOK_META_KEYS.map((key) => [key, METADATA[key]]))
    expect(meta!.actualRowCount).toBe(BASELINE_WORKBOOK_META_KEYS.length + 1)
  })

  it("round-trips custom canonical rows with Unicode and multiline text", async () => {
    const workbook = await createCsvDerivedWorkbook()

    const result = await parseTechnicalConfigurationBaselineWorkbook(
      toExcelWorkbookAdapter(workbook),
      {
        existingCriterionCodes: new Set(["TC-0007"]),
      }
    )

    expect(result).toEqual({
      metadata: METADATA,
      rows: CSV_DERIVED_ROWS,
    })
  })

  it("round-trips through the shared P5A file loader", async () => {
    const workbook = await createCsvDerivedWorkbook()
    const buffer = await workbook.xlsx.writeBuffer()
    const file = {
      arrayBuffer: async () => buffer,
    } as File

    const loadedWorkbook = await readExcelFile(file)
    const result = await parseTechnicalConfigurationBaselineWorkbook(loadedWorkbook, {
      existingCriterionCodes: new Set(["TC-0007"]),
    })

    expect(loadedWorkbook._workbook.getWorksheet("_meta")?.state).toBe("hidden")
    expect(result).toEqual({
      metadata: METADATA,
      rows: CSV_DERIVED_ROWS,
    })
  })

  it("exposes a parser assignable to the P5A custom-workbook seam", async () => {
    const workbook = await createCsvDerivedWorkbook()
    const parser: BulkImportWorkbookParser<TechnicalConfigurationBaselineWorkbookParseResult> =
      createTechnicalConfigurationBaselineWorkbookParser({
        existingCriterionCodes: new Set(["TC-0007"]),
      })

    const payloads = await parser(toExcelWorkbookAdapter(workbook))

    expect(payloads).toEqual([
      {
        metadata: METADATA,
        rows: CSV_DERIVED_ROWS,
      },
    ])
  })

  it("normalizes edge whitespace, CRLF, and numeric-string ordering", async () => {
    const workbook = await createCsvDerivedWorkbook()
    const baseline = workbook.getWorksheet("Baseline")!
    baseline.getCell(2, 2).value = " 1 "
    baseline.getCell(2, 3).value = "\u200BYêu cầu kỹ thuật\u2060"
    baseline.getCell(3, 2).value = "1"
    baseline.getCell(3, 4).value = "1"
    baseline.getCell(3, 6).value = "\u200BMôi trường hoạt động\u2060"
    baseline.getCell(3, 7).value = "\u200BDòng một\r\nDòng hai\u2060"

    const result = await parseTechnicalConfigurationBaselineWorkbook(
      toExcelWorkbookAdapter(workbook),
      {
        existingCriterionCodes: new Set(["TC-0007"]),
      }
    )

    expect(result.rows.slice(0, 2)).toEqual([
      CSV_DERIVED_ROWS[0],
      {
        ...CSV_DERIVED_ROWS[1],
        requirement_text: "Dòng một\nDòng hai",
      },
    ])
  })

  it("ignores whitespace-only rows without shifting source row mapping", async () => {
    const workbook = await createCsvDerivedWorkbook()
    const baseline = workbook.getWorksheet("Baseline")!
    baseline.spliceRows(3, 0, ["   ", null, null, null, null, null, null])

    const result = await parseTechnicalConfigurationBaselineWorkbook(
      toExcelWorkbookAdapter(workbook),
      {
        existingCriterionCodes: new Set(["TC-0007"]),
      }
    )

    expect(result.rows).toEqual(CSV_DERIVED_ROWS)

    baseline.getCell(4, 7).value = " "
    await expectWorkbookIssue(workbook, { code: "required_text", row: 4 })
  })

  it("rejects extra sheets and incorrect sheet visibility", async () => {
    const extraSheetWorkbook = await createCsvDerivedWorkbook()
    extraSheetWorkbook.addWorksheet("Notes")
    await expectWorkbookIssue(extraSheetWorkbook, { code: "unexpected_sheet" })

    const visibleMetaWorkbook = await createCsvDerivedWorkbook()
    visibleMetaWorkbook.getWorksheet("_meta")!.state = "visible"
    await expectWorkbookIssue(visibleMetaWorkbook, { code: "invalid_sheet_visibility" })

    const missingMetaWorkbook = await createCsvDerivedWorkbook()
    missingMetaWorkbook.removeWorksheet(missingMetaWorkbook.getWorksheet("_meta")!.id)
    await expectWorkbookIssue(missingMetaWorkbook, { code: "missing_sheet" })

    const extraHiddenSheetWorkbook = await createCsvDerivedWorkbook()
    extraHiddenSheetWorkbook.addWorksheet("Hidden Notes").state = "hidden"
    await expectWorkbookIssue(extraHiddenSheetWorkbook, { code: "unexpected_sheet" })
  })

  it("rejects changed, reordered, or extra Baseline columns", async () => {
    const renamedColumnWorkbook = await createCsvDerivedWorkbook()
    renamedColumnWorkbook.getWorksheet("Baseline")!.getCell(1, 7).value = "requirement"
    await expectWorkbookIssue(renamedColumnWorkbook, { code: "invalid_columns", row: 1 })

    const reorderedColumnWorkbook = await createCsvDerivedWorkbook()
    const reorderedHeader = reorderedColumnWorkbook.getWorksheet("Baseline")!.getRow(1)
    reorderedHeader.getCell(2).value = "group_name"
    reorderedHeader.getCell(3).value = "group_order"
    await expectWorkbookIssue(reorderedColumnWorkbook, { code: "invalid_columns", row: 1 })

    const extraColumnWorkbook = await createCsvDerivedWorkbook()
    extraColumnWorkbook.getWorksheet("Baseline")!.getCell(1, 8).value = "unexpected"
    await expectWorkbookIssue(extraColumnWorkbook, { code: "invalid_columns", row: 1 })

    const paddedColumnWorkbook = await createCsvDerivedWorkbook()
    paddedColumnWorkbook.getWorksheet("Baseline")!.getCell(1, 5).value = "criterion_code "
    await expectWorkbookIssue(paddedColumnWorkbook, { code: "invalid_columns", row: 1 })
  })

  it("rejects missing, duplicate, extra, or version-mismatched metadata", async () => {
    const missingMetadataWorkbook = await createCsvDerivedWorkbook()
    missingMetadataWorkbook.getWorksheet("_meta")!.spliceRows(7, 1)
    await expectWorkbookIssue(missingMetadataWorkbook, { code: "invalid_metadata" })

    const duplicateMetadataWorkbook = await createCsvDerivedWorkbook()
    duplicateMetadataWorkbook.getWorksheet("_meta")!.addRow(["dossier_id", METADATA.dossier_id])
    await expectWorkbookIssue(duplicateMetadataWorkbook, { code: "invalid_metadata", row: 8 })

    const extraMetadataWorkbook = await createCsvDerivedWorkbook()
    extraMetadataWorkbook.getWorksheet("_meta")!.addRow(["unexpected", "value"])
    await expectWorkbookIssue(extraMetadataWorkbook, { code: "invalid_metadata", row: 8 })

    const extraMetadataColumnWorkbook = await createCsvDerivedWorkbook()
    extraMetadataColumnWorkbook.getWorksheet("_meta")!.getCell(2, 3).value = "unexpected"
    await expectWorkbookIssue(extraMetadataColumnWorkbook, {
      code: "invalid_metadata",
      row: 2,
    })

    const paddedMetadataHeaderWorkbook = await createCsvDerivedWorkbook()
    paddedMetadataHeaderWorkbook.getWorksheet("_meta")!.getCell(1, 1).value = "key "
    await expectWorkbookIssue(paddedMetadataHeaderWorkbook, {
      code: "invalid_metadata",
      row: 1,
    })

    const paddedMetadataKeyWorkbook = await createCsvDerivedWorkbook()
    paddedMetadataKeyWorkbook.getWorksheet("_meta")!.getCell(2, 1).value = "template_kind "
    await expectWorkbookIssue(paddedMetadataKeyWorkbook, {
      code: "invalid_metadata",
      row: 2,
    })

    const blankRevisionWorkbook = await createCsvDerivedWorkbook()
    blankRevisionWorkbook.getWorksheet("_meta")!.getCell(6, 2).value = null
    await expectWorkbookIssue(blankRevisionWorkbook, { code: "invalid_metadata", row: 6 })

    const booleanVersionWorkbook = await createCsvDerivedWorkbook()
    booleanVersionWorkbook.getWorksheet("_meta")!.getCell(3, 2).value = true
    await expectWorkbookIssue(booleanVersionWorkbook, {
      code: "invalid_cell_value",
      row: 3,
    })

    const wrongVersionWorkbook = await createCsvDerivedWorkbook()
    wrongVersionWorkbook.getWorksheet("_meta")!.getCell(3, 2).value = 2
    await expectWorkbookIssue(wrongVersionWorkbook, { code: "version_mismatch", row: 3 })
  })

  it("rejects malformed row types, ordering, and required text", async () => {
    const rowTypeWorkbook = await createCsvDerivedWorkbook()
    rowTypeWorkbook.getWorksheet("Baseline")!.getCell(3, 1).value = "ITEM"
    await expectWorkbookIssue(rowTypeWorkbook, { code: "invalid_row_type", row: 3 })

    const criterionBeforeGroupWorkbook = await createCsvDerivedWorkbook()
    criterionBeforeGroupWorkbook.getWorksheet("Baseline")!.spliceRows(2, 1)
    await expectWorkbookIssue(criterionBeforeGroupWorkbook, {
      code: "invalid_group_order",
      row: 2,
    })

    const blankGroupWorkbook = await createCsvDerivedWorkbook()
    blankGroupWorkbook.getWorksheet("Baseline")!.getCell(2, 3).value = " "
    await expectWorkbookIssue(blankGroupWorkbook, { code: "required_text", row: 2 })

    const blankRequirementWorkbook = await createCsvDerivedWorkbook()
    blankRequirementWorkbook.getWorksheet("Baseline")!.getCell(3, 7).value = "\n"
    await expectWorkbookIssue(blankRequirementWorkbook, { code: "required_text", row: 3 })

    const groupShapeWorkbook = await createCsvDerivedWorkbook()
    groupShapeWorkbook.getWorksheet("Baseline")!.getCell(2, 4).value = 1
    await expectWorkbookIssue(groupShapeWorkbook, { code: "invalid_row_shape", row: 2 })

    const criterionShapeWorkbook = await createCsvDerivedWorkbook()
    criterionShapeWorkbook.getWorksheet("Baseline")!.getCell(3, 3).value = "Yêu cầu kỹ thuật"
    await expectWorkbookIssue(criterionShapeWorkbook, {
      code: "invalid_row_shape",
      row: 3,
    })

    const invalidCodeWorkbook = await createCsvDerivedWorkbook()
    invalidCodeWorkbook.getWorksheet("Baseline")!.getCell(3, 5).value = "TC-7"
    await expectWorkbookIssue(invalidCodeWorkbook, {
      code: "invalid_criterion_code",
      row: 3,
    })
  })

  it("rejects Excel error and hyperlink cells before canonicalization", async () => {
    const errorCodeWorkbook = await createCsvDerivedWorkbook()
    errorCodeWorkbook.getWorksheet("Baseline")!.getCell(3, 5).value = { error: "#N/A" }
    await expectWorkbookIssue(errorCodeWorkbook, {
      code: "invalid_cell_value",
      row: 3,
    })

    const hyperlinkWorkbook = await createCsvDerivedWorkbook()
    hyperlinkWorkbook.getWorksheet("Baseline")!.getCell(3, 7).value = {
      text: "Nội dung yêu cầu",
      hyperlink: "https://example.com",
    }
    await expectWorkbookIssue(hyperlinkWorkbook, {
      code: "invalid_cell_value",
      row: 3,
    })
  })

  it("rejects duplicate ordering and duplicate criterion codes", async () => {
    const duplicateGroupOrderWorkbook = await createCsvDerivedWorkbook()
    duplicateGroupOrderWorkbook.getWorksheet("Baseline")!.getCell(4, 2).value = 1
    await expectWorkbookIssue(duplicateGroupOrderWorkbook, {
      code: "duplicate_group_order",
      row: 4,
    })

    const duplicateCriterionOrderWorkbook = await createCsvDerivedWorkbook()
    duplicateCriterionOrderWorkbook
      .getWorksheet("Baseline")!
      .addRow(["CRITERION", 2, null, 1, null, null, "Tiêu chí trùng thứ tự"])
    await expectWorkbookIssue(duplicateCriterionOrderWorkbook, {
      code: "duplicate_criterion_order",
      row: 6,
    })

    const duplicateCodeWorkbook = await createCsvDerivedWorkbook()
    duplicateCodeWorkbook.getWorksheet("Baseline")!.getCell(5, 5).value = "TC-0007"
    await expectWorkbookIssue(duplicateCodeWorkbook, {
      code: "duplicate_criterion_code",
      row: 5,
    })
  })

  it("rejects a nonblank criterion code that does not belong to the target version", async () => {
    const workbook = await createCsvDerivedWorkbook()
    workbook.getWorksheet("Baseline")!.getCell(3, 5).value = "TC-9999"

    await expectWorkbookIssue(workbook, {
      code: "changed_criterion_code",
      row: 3,
    })
  })
})
