import type { Workbook } from "exceljs"

import {
  OPTION_WORKBOOK_COLUMNS,
  OPTION_WORKBOOK_META_KEYS,
  OPTION_WORKBOOK_META_SHEET_NAME,
  OPTION_WORKBOOK_SHEET_NAME,
  type TechnicalConfigurationOptionWorkbookMetadata,
  type TechnicalConfigurationOptionWorkbookRow,
} from "@/lib/technical-configuration-option-excel-contract"
import { createExcelWorkbook } from "@/lib/excel-workbook"

export interface CreateTechnicalConfigurationOptionWorkbookOptions {
  metadata: TechnicalConfigurationOptionWorkbookMetadata
  rows: readonly TechnicalConfigurationOptionWorkbookRow[]
}

/** Builds one versioned supplier-option snapshot on the shared P5A workbook primitive. */
export async function createTechnicalConfigurationOptionWorkbook({
  metadata,
  rows,
}: CreateTechnicalConfigurationOptionWorkbookOptions): Promise<Workbook> {
  const workbook = await createExcelWorkbook()
  const responseSheet = workbook.addWorksheet(OPTION_WORKBOOK_SHEET_NAME)

  responseSheet.addRow([...OPTION_WORKBOOK_COLUMNS])
  rows.forEach((row) => {
    responseSheet.addRow(OPTION_WORKBOOK_COLUMNS.map((column) => row[column]))
  })

  const metaSheet = workbook.addWorksheet(OPTION_WORKBOOK_META_SHEET_NAME)
  metaSheet.state = "hidden"
  metaSheet.addRow(["key", "value"])
  OPTION_WORKBOOK_META_KEYS.forEach((key) => {
    metaSheet.addRow([key, metadata[key]])
  })

  return workbook
}
