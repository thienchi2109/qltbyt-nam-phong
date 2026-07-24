import type { CellValue, Worksheet } from "exceljs"

import type { ExcelWorkbook } from "@/lib/excel-workbook"

/** Visible worksheet containing one exact-baseline supplier-option response snapshot. */
export const OPTION_WORKBOOK_SHEET_NAME = "OptionResponses"

/** Hidden worksheet containing the workbook ownership metadata. */
export const OPTION_WORKBOOK_META_SHEET_NAME = "_meta"

/** Stable discriminator for supplier-option response workbooks. */
export const OPTION_WORKBOOK_TEMPLATE_KIND = "technical_configuration_option"

/** Supported supplier-option workbook contract version. */
export const OPTION_WORKBOOK_TEMPLATE_VERSION = 1

/** Exact ordered columns accepted on the OptionResponses worksheet. */
export const OPTION_WORKBOOK_COLUMNS = [
  "group_order",
  "group_name",
  "criterion_order",
  "criterion_id",
  "criterion_code",
  "criterion_title",
  "requirement_text",
  "response_text",
  "supplementary_information",
] as const

/** Exact ordered metadata keys accepted on the hidden worksheet. */
export const OPTION_WORKBOOK_META_KEYS = [
  "template_kind",
  "template_version",
  "dossier_id",
  "option_id",
  "baseline_version_id",
  "dossier_revision",
  "generated_at",
] as const

export interface TechnicalConfigurationOptionWorkbookMetadata {
  template_kind: typeof OPTION_WORKBOOK_TEMPLATE_KIND
  template_version: typeof OPTION_WORKBOOK_TEMPLATE_VERSION
  dossier_id: string
  option_id: string
  baseline_version_id: string
  dossier_revision: number
  generated_at: string
}

export type TechnicalConfigurationOptionWorkbookTargetMetadata = Pick<
  TechnicalConfigurationOptionWorkbookMetadata,
  "dossier_id" | "option_id" | "baseline_version_id" | "dossier_revision"
>

export interface TechnicalConfigurationOptionWorkbookCriterion {
  group_order: number
  group_name: string
  criterion_order: number
  criterion_id: string
  criterion_code: string
  criterion_title: string | null
  requirement_text: string
}

export interface TechnicalConfigurationOptionWorkbookRow extends TechnicalConfigurationOptionWorkbookCriterion {
  response_text: string
  supplementary_information: string
}

export interface TechnicalConfigurationOptionWorkbookParseOptions {
  expectedMetadata: TechnicalConfigurationOptionWorkbookTargetMetadata
  expectedCriteria: readonly TechnicalConfigurationOptionWorkbookCriterion[]
}

export interface TechnicalConfigurationOptionWorkbookParseResult {
  metadata: TechnicalConfigurationOptionWorkbookMetadata
  rows: TechnicalConfigurationOptionWorkbookRow[]
}

export type TechnicalConfigurationOptionWorkbookIssueCode =
  | "unexpected_sheet"
  | "missing_sheet"
  | "invalid_sheet_visibility"
  | "invalid_columns"
  | "invalid_cell_value"
  | "invalid_metadata"
  | "version_mismatch"
  | "target_mismatch"
  | "invalid_row"
  | "missing_criterion"
  | "unknown_criterion"
  | "duplicate_criterion"
  | "changed_context"

export interface TechnicalConfigurationOptionWorkbookIssue {
  code: TechnicalConfigurationOptionWorkbookIssueCode
  message: string
  row?: number
  column?: string
}

/** Aggregate parse error containing every supplier-option workbook contract issue found. */
export class TechnicalConfigurationOptionWorkbookError extends Error {
  readonly issues: TechnicalConfigurationOptionWorkbookIssue[]

  constructor(issues: TechnicalConfigurationOptionWorkbookIssue[]) {
    super(
      issues.map((issue) => `${issue.row ? `Dòng ${issue.row}: ` : ""}${issue.message}`).join("\n")
    )
    this.name = "TechnicalConfigurationOptionWorkbookError"
    this.issues = issues
  }
}

/** Throws one aggregate error when supplier-option workbook issues are present. */
export function throwIfOptionWorkbookIssues(
  issues: TechnicalConfigurationOptionWorkbookIssue[]
): void {
  if (issues.length > 0) {
    throw new TechnicalConfigurationOptionWorkbookError(issues)
  }
}

/** Returns whether a cell contains contract-visible content. */
export function hasOptionWorkbookCellValue(value: CellValue): boolean {
  return value !== null && value !== undefined && value !== ""
}

/** Restricts workbook cells to empty, string or numeric primitive values. */
export function isSupportedOptionWorkbookCellValue(value: CellValue): boolean {
  return (
    value === null || value === undefined || typeof value === "string" || typeof value === "number"
  )
}

/** Converts a supported cell value to text without trimming or newline normalization. */
export function toOptionWorkbookCellText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value)
}

/** Converts an empty supported cell to null for nullable read-only context. */
export function toNullableOptionWorkbookCellText(value: unknown): string | null {
  const text = toOptionWorkbookCellText(value)
  return text === "" ? null : text
}

/** Parses a supported order cell as a positive integer. */
export function toPositiveOptionWorkbookInteger(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null
  if (typeof value === "string" && value.trim() === "") return null

  const number = typeof value === "number" ? value : Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

/** Validates exact sheet names and visibility states. */
export function collectOptionWorkbookStructureIssues(
  workbook: ExcelWorkbook
): TechnicalConfigurationOptionWorkbookIssue[] {
  const issues: TechnicalConfigurationOptionWorkbookIssue[] = []
  const expectedSheetNames = new Set([OPTION_WORKBOOK_SHEET_NAME, OPTION_WORKBOOK_META_SHEET_NAME])

  for (const worksheet of workbook._workbook.worksheets) {
    if (!expectedSheetNames.has(worksheet.name)) {
      issues.push({
        code: "unexpected_sheet",
        message: `Sheet "${worksheet.name}" không thuộc contract.`,
      })
    }
  }

  for (const sheetName of expectedSheetNames) {
    if (!workbook._workbook.getWorksheet(sheetName)) {
      issues.push({
        code: "missing_sheet",
        message: `Thiếu sheet bắt buộc "${sheetName}".`,
      })
    }
  }

  const responseSheet = workbook._workbook.getWorksheet(OPTION_WORKBOOK_SHEET_NAME)
  const metaSheet = workbook._workbook.getWorksheet(OPTION_WORKBOOK_META_SHEET_NAME)
  if (responseSheet && responseSheet.state !== "visible") {
    issues.push({
      code: "invalid_sheet_visibility",
      message: `Sheet "${OPTION_WORKBOOK_SHEET_NAME}" phải hiển thị.`,
    })
  }
  if (metaSheet && metaSheet.state !== "hidden") {
    issues.push({
      code: "invalid_sheet_visibility",
      message: `Sheet "${OPTION_WORKBOOK_META_SHEET_NAME}" phải ở trạng thái hidden.`,
    })
  }

  return issues
}

/** Validates the exact ordered response header and rejects extra content columns. */
export function collectOptionWorkbookColumnIssues(
  worksheet: Worksheet
): TechnicalConfigurationOptionWorkbookIssue[] {
  const headers = OPTION_WORKBOOK_COLUMNS.map((_, index) =>
    toOptionWorkbookCellText(worksheet.getRow(1).getCell(index + 1).value)
  )
  const hasWrongHeader = headers.some((header, index) => header !== OPTION_WORKBOOK_COLUMNS[index])
  let hasExtraContent = false

  worksheet.eachRow((row) => {
    row.eachCell((cell, columnNumber) => {
      if (columnNumber > OPTION_WORKBOOK_COLUMNS.length && hasOptionWorkbookCellValue(cell.value)) {
        hasExtraContent = true
      }
    })
  })

  return hasWrongHeader || hasExtraContent
    ? [
        {
          code: "invalid_columns",
          message: "Sheet OptionResponses phải có đúng chín cột theo contract.",
        },
      ]
    : []
}

/** Rejects unsupported Excel cell value shapes before shared worksheet conversion. */
export function collectOptionWorkbookCellValueIssues(
  worksheet: Worksheet
): TechnicalConfigurationOptionWorkbookIssue[] {
  const issues: TechnicalConfigurationOptionWorkbookIssue[] = []

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, columnNumber) => {
      if (
        columnNumber <= OPTION_WORKBOOK_COLUMNS.length &&
        !isSupportedOptionWorkbookCellValue(cell.value)
      ) {
        issues.push({
          code: "invalid_cell_value",
          row: rowNumber,
          column: OPTION_WORKBOOK_COLUMNS[columnNumber - 1],
          message: "Workbook chỉ chấp nhận ô text, số hoặc để trống.",
        })
      }
    })
  })

  return issues
}
