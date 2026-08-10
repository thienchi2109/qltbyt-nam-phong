import type { Worksheet } from "exceljs"

import { BASELINE_WORKBOOK_COLUMNS } from "@/lib/technical-configuration-baseline-excel-contract"
import { normalizeBaselineWorkbookText } from "@/lib/technical-configuration-baseline-excel-validation"

function getBaselineWorkbookRowNumbers(
  worksheet: Worksheet,
  hasValue: (value: unknown) => boolean
): number[] {
  const rowNumbers: number[] = []

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < 2) return

    const hasData = BASELINE_WORKBOOK_COLUMNS.some((_, index) =>
      hasValue(row.getCell(index + 1).value)
    )
    if (hasData) rowNumbers.push(rowNumber)
  })

  return rowNumbers
}

/** Returns physical rows aligned with worksheetToJson's raw non-empty records. */
export function getBaselineWorkbookJsonRowNumbers(worksheet: Worksheet): number[] {
  return getBaselineWorkbookRowNumbers(
    worksheet,
    (value) => value !== null && value !== undefined && value !== ""
  )
}

/** Returns physical rows that contain normalized Baseline data. */
export function getBaselineWorkbookDataRowNumbers(worksheet: Worksheet): number[] {
  return getBaselineWorkbookRowNumbers(
    worksheet,
    (value) => normalizeBaselineWorkbookText(value).length > 0
  )
}
