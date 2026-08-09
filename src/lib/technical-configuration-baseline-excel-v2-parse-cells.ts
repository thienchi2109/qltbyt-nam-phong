import type { CellValue, Worksheet } from "exceljs"

import { normalizeBaselineWorkbookText } from "@/lib/technical-configuration-baseline-excel-validation"
import type { TechnicalConfigurationBaselineWorkbookV2Issue } from "@/lib/technical-configuration-baseline-excel-v2-parse-contract"

/** Returns the exact scalar text used for strict workbook contract checks. */
export function getExactTechnicalConfigurationBaselineWorkbookCellText(value: CellValue): string {
  return value === null || value === undefined ? "" : String(value)
}

/** Narrows an ExcelJS value to the scalar values supported by XLSX v2. */
export function toTechnicalConfigurationBaselineWorkbookV2CellScalar(
  value: CellValue
): string | number | null {
  if (value === null || value === undefined) return null
  return typeof value === "string" || typeof value === "number" ? value : null
}

/** Normalizes a supported XLSX v2 cell value and maps blank text to null. */
export function toNullableTechnicalConfigurationBaselineWorkbookV2Text(
  value: CellValue
): string | null {
  const scalar = toTechnicalConfigurationBaselineWorkbookV2CellScalar(value)
  const normalized = normalizeBaselineWorkbookText(scalar)
  return normalized || null
}

/** Reports whether an ExcelJS cell contributes to the meaningful-row limit. */
export function isTechnicalConfigurationBaselineWorkbookMeaningfulCellValue(
  value: CellValue
): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return normalizeBaselineWorkbookText(value).length > 0
  return true
}

/** Collects physical-cell issues for values outside the XLSX v2 scalar contract. */
export function collectUnsupportedTechnicalConfigurationBaselineWorkbookV2CellIssues(
  worksheet: Worksheet,
  columnNames: readonly string[]
): TechnicalConfigurationBaselineWorkbookV2Issue[] {
  const issues: TechnicalConfigurationBaselineWorkbookV2Issue[] = []

  worksheet.eachRow((worksheetRow, rowNumber) => {
    for (let columnNumber = 1; columnNumber <= columnNames.length; columnNumber += 1) {
      const value = worksheetRow.getCell(columnNumber).value
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
  })

  return issues
}
