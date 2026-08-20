import type { CellValue, Workbook, Worksheet } from "exceljs"

import {
  BASELINE_WORKBOOK_V2_COLUMNS,
  BASELINE_WORKBOOK_V2_CONFIGURATION_SHEET_NAME,
  BASELINE_WORKBOOK_V2_CRITERION_TITLE_HEADER,
  BASELINE_WORKBOOK_V2_INSTRUCTIONS_SHEET_NAME,
  BASELINE_WORKBOOK_V2_META_KEYS,
  BASELINE_WORKBOOK_V2_META_SHEET_NAME,
  BASELINE_WORKBOOK_V2_TEMPLATE_KIND,
  BASELINE_WORKBOOK_V2_TEMPLATE_VERSION,
} from "@/lib/technical-configuration-baseline-excel-v2-contract"
import {
  collectUnsupportedTechnicalConfigurationBaselineWorkbookV2CellIssues,
  getExactTechnicalConfigurationBaselineWorkbookCellText,
  isTechnicalConfigurationBaselineWorkbookMeaningfulCellValue,
  toNullableTechnicalConfigurationBaselineWorkbookV2Text,
  toTechnicalConfigurationBaselineWorkbookV2CellScalar,
} from "@/lib/technical-configuration-baseline-excel-v2-parse-cells"
import {
  TechnicalConfigurationBaselineWorkbookV2Error,
  throwIfTechnicalConfigurationBaselineWorkbookV2Issues,
  type ParseTechnicalConfigurationBaselineWorkbookV2Options,
  type TechnicalConfigurationBaselineWorkbookV2Issue,
  type TechnicalConfigurationBaselineWorkbookV2ParseResult,
} from "@/lib/technical-configuration-baseline-excel-v2-parse-contract"
import { parseTechnicalConfigurationBaselineWorkbookV2Rows } from "@/lib/technical-configuration-baseline-excel-v2-parse-rows"

/** Maximum number of nonblank rows accepted from the import worksheet. */
export const BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS = 5_000

function validateWorkbookStructure(workbook: Workbook): void {
  const issues: TechnicalConfigurationBaselineWorkbookV2Issue[] = []
  const expectedSheets = new Map([
    [BASELINE_WORKBOOK_V2_CONFIGURATION_SHEET_NAME, "visible"],
    [BASELINE_WORKBOOK_V2_INSTRUCTIONS_SHEET_NAME, "visible"],
    [BASELINE_WORKBOOK_V2_META_SHEET_NAME, "hidden"],
  ])

  for (const worksheet of workbook.worksheets) {
    if (!expectedSheets.has(worksheet.name)) {
      issues.push({
        code: "unexpected_sheet",
        message: `Sheet "${worksheet.name}" không thuộc contract XLSX v2.`,
      })
    }
  }

  for (const [sheetName, expectedState] of expectedSheets) {
    const worksheet = workbook.getWorksheet(sheetName)
    if (!worksheet) {
      issues.push({
        code: "missing_sheet",
        message: `Thiếu sheet bắt buộc "${sheetName}".`,
      })
    } else if (worksheet.state !== expectedState) {
      issues.push({
        code: "invalid_sheet_visibility",
        message: `Sheet "${sheetName}" phải ở trạng thái ${expectedState}.`,
      })
    }
  }

  throwIfTechnicalConfigurationBaselineWorkbookV2Issues(issues)
}

function validateConfigurationColumns(worksheet: Worksheet): void {
  const issues: TechnicalConfigurationBaselineWorkbookV2Issue[] = []
  const headers = BASELINE_WORKBOOK_V2_COLUMNS.map((_, index) =>
    getExactTechnicalConfigurationBaselineWorkbookCellText(
      worksheet.getRow(1).getCell(index + 1).value
    )
  )
  const invalidHeader = headers.some((header, index) => {
    const column = BASELINE_WORKBOOK_V2_COLUMNS[index]

    return (
      header !== column.header &&
      !(column.key === "criterion_title" && header === BASELINE_WORKBOOK_V2_CRITERION_TITLE_HEADER)
    )
  })
  let hasExtraValue = false

  worksheet.eachRow((worksheetRow) => {
    worksheetRow.eachCell((cell, columnNumber) => {
      if (
        columnNumber > BASELINE_WORKBOOK_V2_COLUMNS.length &&
        isTechnicalConfigurationBaselineWorkbookMeaningfulCellValue(cell.value)
      ) {
        hasExtraValue = true
      }
    })
  })

  if (invalidHeader || hasExtraValue) {
    issues.push({
      code: "invalid_columns",
      row: 1,
      message: "Các cột XLSX v2 phải khớp chính xác contract và đúng thứ tự.",
    })
  }

  throwIfTechnicalConfigurationBaselineWorkbookV2Issues(issues)
}

/** Rejects workbooks whose populated data rows exceed the configured limit. */
export function enforceTechnicalConfigurationBaselineWorkbookMeaningfulRowLimit(
  worksheet: Worksheet
): void {
  let meaningfulRows = 0

  worksheet.eachRow((worksheetRow, rowNumber) => {
    if (rowNumber === 1) return
    let meaningful = false
    worksheetRow.eachCell((cell) => {
      if (isTechnicalConfigurationBaselineWorkbookMeaningfulCellValue(cell.value)) {
        meaningful = true
      }
    })
    if (meaningful) meaningfulRows += 1
  })

  if (meaningfulRows > BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS) {
    throw new TechnicalConfigurationBaselineWorkbookV2Error([
      {
        code: "meaningful_row_limit_exceeded",
        message: `Workbook có ${meaningfulRows} dòng có nội dung, vượt giới hạn ${BASELINE_WORKBOOK_MAX_MEANINGFUL_ROWS}.`,
      },
    ])
  }
}

function parseMetadata(
  worksheet: Worksheet
): TechnicalConfigurationBaselineWorkbookV2ParseResult["metadata"] {
  const issues = collectUnsupportedTechnicalConfigurationBaselineWorkbookV2CellIssues(worksheet, [
    "key",
    "value",
  ])
  const values: Record<string, CellValue> = {}
  const headers = [1, 2].map((column) =>
    getExactTechnicalConfigurationBaselineWorkbookCellText(
      worksheet.getRow(1).getCell(column).value
    )
  )

  if (headers[0] !== "key" || headers[1] !== "value") {
    issues.push({
      code: "invalid_metadata",
      row: 1,
      message: "Sheet _meta phải có đúng hai cột key và value.",
    })
  }

  BASELINE_WORKBOOK_V2_META_KEYS.forEach((expectedKey, index) => {
    const rowNumber = index + 2
    const key = getExactTechnicalConfigurationBaselineWorkbookCellText(
      worksheet.getRow(rowNumber).getCell(1).value
    )
    if (key !== expectedKey) {
      issues.push({
        code: "invalid_metadata",
        row: rowNumber,
        message: `Metadata key phải là "${expectedKey}" tại vị trí này.`,
      })
    }
    values[expectedKey] = worksheet.getRow(rowNumber).getCell(2).value
  })

  worksheet.eachRow((worksheetRow, rowNumber) => {
    let hasExtraMetadataColumn = false
    worksheetRow.eachCell((cell, columnNumber) => {
      if (
        columnNumber > 2 &&
        isTechnicalConfigurationBaselineWorkbookMeaningfulCellValue(cell.value)
      ) {
        hasExtraMetadataColumn = true
      }
    })
    if (hasExtraMetadataColumn) {
      issues.push({
        code: "invalid_metadata",
        row: rowNumber,
        message: "Sheet _meta chỉ được có hai cột key và value.",
      })
    }
    if (
      rowNumber >= BASELINE_WORKBOOK_V2_META_KEYS.length + 2 &&
      (isTechnicalConfigurationBaselineWorkbookMeaningfulCellValue(worksheetRow.getCell(1).value) ||
        isTechnicalConfigurationBaselineWorkbookMeaningfulCellValue(worksheetRow.getCell(2).value))
    ) {
      issues.push({
        code: "invalid_metadata",
        row: rowNumber,
        message: "Sheet _meta có metadata ngoài contract.",
      })
    }
  })

  const templateKind = toNullableTechnicalConfigurationBaselineWorkbookV2Text(values.template_kind)
  const templateVersion = toTechnicalConfigurationBaselineWorkbookV2CellScalar(
    values.template_version
  )
  const dossierId = toNullableTechnicalConfigurationBaselineWorkbookV2Text(values.dossier_id)
  const baselineVersionId = toNullableTechnicalConfigurationBaselineWorkbookV2Text(
    values.baseline_version_id
  )
  const baselineRevision = toTechnicalConfigurationBaselineWorkbookV2CellScalar(
    values.baseline_revision
  )
  const generatedAt = toNullableTechnicalConfigurationBaselineWorkbookV2Text(values.generated_at)

  if (templateKind !== BASELINE_WORKBOOK_V2_TEMPLATE_KIND) {
    issues.push({
      code: "invalid_metadata",
      row: 2,
      message: "template_kind không khớp baseline workbook.",
    })
  }
  if (templateVersion !== BASELINE_WORKBOOK_V2_TEMPLATE_VERSION) {
    issues.push({
      code: "version_mismatch",
      row: 3,
      message: `Chỉ hỗ trợ template_version=${BASELINE_WORKBOOK_V2_TEMPLATE_VERSION}.`,
    })
  }
  if (!dossierId) {
    issues.push({ code: "invalid_metadata", row: 4, message: "dossier_id là bắt buộc." })
  }
  if (!baselineVersionId) {
    issues.push({
      code: "invalid_metadata",
      row: 5,
      message: "baseline_version_id là bắt buộc.",
    })
  }
  if (
    typeof baselineRevision !== "number" ||
    !Number.isInteger(baselineRevision) ||
    baselineRevision < 0
  ) {
    issues.push({
      code: "invalid_metadata",
      row: 6,
      message: "baseline_revision phải là số nguyên không âm.",
    })
  }
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    issues.push({
      code: "invalid_metadata",
      row: 7,
      message: "generated_at phải là timestamp hợp lệ.",
    })
  }

  throwIfTechnicalConfigurationBaselineWorkbookV2Issues(issues)
  return {
    template_kind: BASELINE_WORKBOOK_V2_TEMPLATE_KIND,
    template_version: BASELINE_WORKBOOK_V2_TEMPLATE_VERSION,
    dossier_id: dossierId!,
    baseline_version_id: baselineVersionId!,
    baseline_revision: baselineRevision as number,
    generated_at: generatedAt!,
  }
}

/** Parses the in-memory XLSX v2 workbook into canonical hierarchy rows. */
export function parseTechnicalConfigurationBaselineWorkbookV2(
  workbook: Workbook,
  options: ParseTechnicalConfigurationBaselineWorkbookV2Options
): TechnicalConfigurationBaselineWorkbookV2ParseResult {
  validateWorkbookStructure(workbook)
  const configuration = workbook.getWorksheet(BASELINE_WORKBOOK_V2_CONFIGURATION_SHEET_NAME)!
  const meta = workbook.getWorksheet(BASELINE_WORKBOOK_V2_META_SHEET_NAME)!
  enforceTechnicalConfigurationBaselineWorkbookMeaningfulRowLimit(configuration)
  throwIfTechnicalConfigurationBaselineWorkbookV2Issues(
    collectUnsupportedTechnicalConfigurationBaselineWorkbookV2CellIssues(
      configuration,
      BASELINE_WORKBOOK_V2_COLUMNS.map((column) => column.key)
    )
  )
  validateConfigurationColumns(configuration)

  return {
    format: "v2",
    metadata: parseMetadata(meta),
    rows: parseTechnicalConfigurationBaselineWorkbookV2Rows(
      configuration,
      options.existingHierarchy
    ),
  }
}
