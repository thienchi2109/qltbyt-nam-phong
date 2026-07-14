import type { Workbook } from "exceljs"

import { createExcelWorkbook } from "@/lib/excel-workbook"
import {
  BASELINE_WORKBOOK_COLUMNS,
  BASELINE_WORKBOOK_META_KEYS,
  BASELINE_WORKBOOK_META_SHEET_NAME,
  BASELINE_WORKBOOK_SHEET_NAME,
  BASELINE_WORKBOOK_SUGGESTED_GROUPS,
  type TechnicalConfigurationBaselineWorkbookMetadata,
  type TechnicalConfigurationBaselineWorkbookRow,
} from "@/lib/technical-configuration-baseline-excel-contract"

export interface CreateTechnicalConfigurationBaselineWorkbookOptions {
  metadata: TechnicalConfigurationBaselineWorkbookMetadata
  rows?: readonly TechnicalConfigurationBaselineWorkbookRow[]
}

/** Builds the versioned baseline template on the shared P5A workbook primitive. */
export async function createTechnicalConfigurationBaselineWorkbook({
  metadata,
  rows,
}: CreateTechnicalConfigurationBaselineWorkbookOptions): Promise<Workbook> {
  const workbook = await createExcelWorkbook()
  const baselineSheet = workbook.addWorksheet(BASELINE_WORKBOOK_SHEET_NAME)

  baselineSheet.addRow([...BASELINE_WORKBOOK_COLUMNS])
  const workbookRows =
    rows ??
    BASELINE_WORKBOOK_SUGGESTED_GROUPS.map<TechnicalConfigurationBaselineWorkbookRow>(
      (groupName, index) => ({
        row_type: "GROUP",
        group_order: index + 1,
        group_name: groupName,
        criterion_order: null,
        criterion_code: null,
        criterion_title: null,
        requirement_text: null,
      })
    )
  workbookRows.forEach((row) => {
    baselineSheet.addRow(BASELINE_WORKBOOK_COLUMNS.map((column) => row[column]))
  })

  const metaSheet = workbook.addWorksheet(BASELINE_WORKBOOK_META_SHEET_NAME)
  metaSheet.state = "hidden"
  metaSheet.addRow(["key", "value"])
  BASELINE_WORKBOOK_META_KEYS.forEach((key) => {
    metaSheet.addRow([key, metadata[key]])
  })

  return workbook
}
