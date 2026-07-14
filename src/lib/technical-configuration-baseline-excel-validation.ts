import type { Worksheet } from "exceljs"

import {
  BASELINE_WORKBOOK_COLUMNS,
  BASELINE_WORKBOOK_META_KEYS,
  BASELINE_WORKBOOK_META_SHEET_NAME,
  BASELINE_WORKBOOK_SHEET_NAME,
  BASELINE_WORKBOOK_TEMPLATE_KIND,
  BASELINE_WORKBOOK_TEMPLATE_VERSION,
  type TechnicalConfigurationBaselineWorkbookMetadata,
} from "@/lib/technical-configuration-baseline-excel-contract"
import type { ExcelWorkbook } from "@/lib/excel-workbook"

export type TechnicalConfigurationBaselineWorkbookIssueCode =
  | "unexpected_sheet"
  | "missing_sheet"
  | "invalid_sheet_visibility"
  | "invalid_columns"
  | "invalid_cell_value"
  | "invalid_metadata"
  | "version_mismatch"
  | "invalid_row_type"
  | "invalid_row_shape"
  | "invalid_group_order"
  | "duplicate_group_order"
  | "invalid_criterion_order"
  | "duplicate_criterion_order"
  | "required_text"
  | "invalid_criterion_code"
  | "duplicate_criterion_code"
  | "changed_criterion_code"

export interface TechnicalConfigurationBaselineWorkbookIssue {
  code: TechnicalConfigurationBaselineWorkbookIssueCode
  message: string
  row?: number
  column?: string
}

/** Aggregate parse error containing every workbook contract issue found. */
export class TechnicalConfigurationBaselineWorkbookError extends Error {
  readonly issues: TechnicalConfigurationBaselineWorkbookIssue[]

  constructor(issues: TechnicalConfigurationBaselineWorkbookIssue[]) {
    super(
      issues.map((issue) => `${issue.row ? `Dòng ${issue.row}: ` : ""}${issue.message}`).join("\n")
    )
    this.name = "TechnicalConfigurationBaselineWorkbookError"
    this.issues = issues
  }
}

/** Throws one aggregate error when workbook issues are present. */
export function throwIfBaselineWorkbookIssues(
  issues: TechnicalConfigurationBaselineWorkbookIssue[]
): void {
  if (issues.length > 0) {
    throw new TechnicalConfigurationBaselineWorkbookError(issues)
  }
}

/** Normalizes editable cell text while preserving interior whitespace and line breaks. */
export function normalizeBaselineWorkbookText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/^[\s\u200B\u2060]+/, "")
    .replace(/[\s\u200B\u2060]+$/, "")
}

/** Converts an empty normalized cell to null. */
export function toNullableBaselineWorkbookText(value: unknown): string | null {
  const normalized = normalizeBaselineWorkbookText(value)
  return normalized || null
}

/** Parses a cell as a positive integer or returns null. */
export function toPositiveBaselineWorkbookInteger(value: unknown): number | null {
  const normalized =
    typeof value === "number" ? value : Number(normalizeBaselineWorkbookText(value))
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null
}

function getExactCellText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value)
}

function hasCellValue(worksheet: Worksheet, rowNumber: number, columnNumber: number): boolean {
  return (
    normalizeBaselineWorkbookText(worksheet.getRow(rowNumber).getCell(columnNumber).value).length >
    0
  )
}

function collectUnsupportedCellIssues(
  worksheet: Worksheet,
  columnNames: readonly string[]
): TechnicalConfigurationBaselineWorkbookIssue[] {
  const issues: TechnicalConfigurationBaselineWorkbookIssue[] = []

  for (let rowNumber = 1; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    for (let columnNumber = 1; columnNumber <= columnNames.length; columnNumber += 1) {
      const value = worksheet.getRow(rowNumber).getCell(columnNumber).value
      if (
        value !== null &&
        value !== undefined &&
        typeof value !== "string" &&
        typeof value !== "number"
      ) {
        issues.push({
          code: "invalid_cell_value",
          row: rowNumber,
          column: columnNames[columnNumber - 1],
          message: "Workbook chỉ chấp nhận ô text, số hoặc để trống.",
        })
      }
    }
  }

  return issues
}

/** Returns physical worksheet row numbers that contain Baseline data. */
export function getBaselineWorkbookDataRowNumbers(worksheet: Worksheet): number[] {
  const rowNumbers: number[] = []

  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const hasData = BASELINE_WORKBOOK_COLUMNS.some((_, index) => {
      const value = worksheet.getRow(rowNumber).getCell(index + 1).value
      return value !== null && value !== undefined && value !== ""
    })
    if (hasData) rowNumbers.push(rowNumber)
  }

  return rowNumbers
}

/** Rejects unsupported Excel cell value shapes before JSON conversion. */
export function validateBaselineWorkbookCellValues(
  worksheet: Worksheet
): TechnicalConfigurationBaselineWorkbookIssue[] {
  return collectUnsupportedCellIssues(worksheet, BASELINE_WORKBOOK_COLUMNS)
}

/** Validates exact sheet names and visibility states. */
export function validateBaselineWorkbookStructure(
  workbook: ExcelWorkbook
): TechnicalConfigurationBaselineWorkbookIssue[] {
  const issues: TechnicalConfigurationBaselineWorkbookIssue[] = []
  const worksheets = workbook._workbook.worksheets
  const expectedNames = new Set([BASELINE_WORKBOOK_SHEET_NAME, BASELINE_WORKBOOK_META_SHEET_NAME])

  for (const worksheet of worksheets) {
    if (!expectedNames.has(worksheet.name)) {
      issues.push({
        code: "unexpected_sheet",
        message: `Sheet "${worksheet.name}" không thuộc contract.`,
      })
    }
  }

  for (const sheetName of expectedNames) {
    if (!workbook._workbook.getWorksheet(sheetName)) {
      issues.push({
        code: "missing_sheet",
        message: `Thiếu sheet bắt buộc "${sheetName}".`,
      })
    }
  }

  const baselineSheet = workbook._workbook.getWorksheet(BASELINE_WORKBOOK_SHEET_NAME)
  const metaSheet = workbook._workbook.getWorksheet(BASELINE_WORKBOOK_META_SHEET_NAME)
  if (baselineSheet && baselineSheet.state !== "visible") {
    issues.push({
      code: "invalid_sheet_visibility",
      message: `Sheet "${BASELINE_WORKBOOK_SHEET_NAME}" phải hiển thị.`,
    })
  }
  if (metaSheet && metaSheet.state !== "hidden") {
    issues.push({
      code: "invalid_sheet_visibility",
      message: `Sheet "${BASELINE_WORKBOOK_META_SHEET_NAME}" phải ở trạng thái hidden.`,
    })
  }

  return issues
}

/** Validates the exact ordered Baseline header and rejects extra columns. */
export function validateBaselineWorkbookColumns(
  worksheet: Worksheet
): TechnicalConfigurationBaselineWorkbookIssue[] {
  const headers = BASELINE_WORKBOOK_COLUMNS.map((_, index) =>
    getExactCellText(worksheet.getRow(1).getCell(index + 1).value)
  )
  const hasUnexpectedHeader = headers.some(
    (header, index) => header !== BASELINE_WORKBOOK_COLUMNS[index]
  )
  const hasExtraColumn = Array.from(
    { length: worksheet.actualRowCount },
    (_, index) => index + 1
  ).some((rowNumber) => {
    for (
      let columnNumber = BASELINE_WORKBOOK_COLUMNS.length + 1;
      columnNumber <= worksheet.columnCount;
      columnNumber += 1
    ) {
      if (hasCellValue(worksheet, rowNumber, columnNumber)) return true
    }
    return false
  })

  if (!hasUnexpectedHeader && !hasExtraColumn) return []

  return [
    {
      code: "invalid_columns",
      row: 1,
      message: "Các cột Baseline phải khớp chính xác contract và đúng thứ tự.",
    },
  ]
}

/** Parses and validates the exact hidden metadata worksheet contract. */
export function parseBaselineWorkbookMetadata(worksheet: Worksheet): {
  metadata: TechnicalConfigurationBaselineWorkbookMetadata
  issues: TechnicalConfigurationBaselineWorkbookIssue[]
} {
  const issues = collectUnsupportedCellIssues(worksheet, ["key", "value"])
  const header = [1, 2].map((column) => getExactCellText(worksheet.getRow(1).getCell(column).value))
  let unexpectedColumnRow: number | undefined
  for (let rowNumber = 1; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    for (let columnNumber = 3; columnNumber <= worksheet.columnCount; columnNumber += 1) {
      if (hasCellValue(worksheet, rowNumber, columnNumber)) {
        unexpectedColumnRow = rowNumber
        break
      }
    }
    if (unexpectedColumnRow !== undefined) break
  }
  if (header[0] !== "key" || header[1] !== "value" || unexpectedColumnRow !== undefined) {
    issues.push({
      code: "invalid_metadata",
      row: unexpectedColumnRow ?? 1,
      message: "Sheet _meta phải có đúng hai cột key và value.",
    })
  }

  const values: Record<string, unknown> = {}
  const seenKeys = new Set<string>()
  for (let index = 0; index < BASELINE_WORKBOOK_META_KEYS.length; index += 1) {
    const rowNumber = index + 2
    const key = getExactCellText(worksheet.getRow(rowNumber).getCell(1).value)
    const expectedKey = BASELINE_WORKBOOK_META_KEYS[index]
    if (key !== expectedKey || seenKeys.has(key)) {
      issues.push({
        code: "invalid_metadata",
        row: rowNumber,
        message: `Metadata key phải là "${expectedKey}" tại vị trí này.`,
      })
    }
    seenKeys.add(key)
    values[key] = worksheet.getRow(rowNumber).getCell(2).value
  }

  for (
    let rowNumber = BASELINE_WORKBOOK_META_KEYS.length + 2;
    rowNumber <= worksheet.actualRowCount;
    rowNumber += 1
  ) {
    if (hasCellValue(worksheet, rowNumber, 1) || hasCellValue(worksheet, rowNumber, 2)) {
      issues.push({
        code: "invalid_metadata",
        row: rowNumber,
        message: "Sheet _meta có metadata ngoài contract.",
      })
    }
  }

  if (
    typeof values.template_kind !== "string" ||
    normalizeBaselineWorkbookText(values.template_kind) !== BASELINE_WORKBOOK_TEMPLATE_KIND
  ) {
    issues.push({
      code: "invalid_metadata",
      row: 2,
      message: "template_kind không khớp baseline workbook.",
    })
  }

  const templateVersion = values.template_version
  if (
    typeof templateVersion !== "number" ||
    !Number.isInteger(templateVersion) ||
    templateVersion !== BASELINE_WORKBOOK_TEMPLATE_VERSION
  ) {
    issues.push({
      code: "version_mismatch",
      row: 3,
      message: `Chỉ hỗ trợ template_version=${BASELINE_WORKBOOK_TEMPLATE_VERSION}.`,
    })
  }

  const dossierId =
    typeof values.dossier_id === "string" ? normalizeBaselineWorkbookText(values.dossier_id) : ""
  const baselineVersionId =
    typeof values.baseline_version_id === "string"
      ? normalizeBaselineWorkbookText(values.baseline_version_id)
      : ""
  const baselineRevision =
    typeof values.baseline_revision === "number" ? values.baseline_revision : Number.NaN
  const generatedAt =
    typeof values.generated_at === "string"
      ? normalizeBaselineWorkbookText(values.generated_at)
      : ""
  if (!dossierId) {
    issues.push({
      code: "invalid_metadata",
      row: 4,
      message: "dossier_id là bắt buộc.",
    })
  }
  if (!baselineVersionId) {
    issues.push({
      code: "invalid_metadata",
      row: 5,
      message: "baseline_version_id là bắt buộc.",
    })
  }
  if (!Number.isInteger(baselineRevision) || baselineRevision < 0) {
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

  return {
    metadata: {
      template_kind: BASELINE_WORKBOOK_TEMPLATE_KIND,
      template_version: BASELINE_WORKBOOK_TEMPLATE_VERSION,
      dossier_id: dossierId,
      baseline_version_id: baselineVersionId,
      baseline_revision: baselineRevision,
      generated_at: generatedAt,
    },
    issues,
  }
}
