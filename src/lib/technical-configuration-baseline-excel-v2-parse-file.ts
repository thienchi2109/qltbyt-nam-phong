import type { Workbook } from "exceljs"

import {
  BASELINE_WORKBOOK_META_SHEET_NAME,
  BASELINE_WORKBOOK_SHEET_NAME,
  BASELINE_WORKBOOK_TEMPLATE_KIND,
  BASELINE_WORKBOOK_TEMPLATE_VERSION,
} from "@/lib/technical-configuration-baseline-excel-contract"
import { BASELINE_WORKBOOK_V2_TEMPLATE_VERSION } from "@/lib/technical-configuration-baseline-excel-v2-contract"
import { parseTechnicalConfigurationBaselineWorkbook } from "@/lib/technical-configuration-baseline-excel-parse"
import {
  toNullableTechnicalConfigurationBaselineWorkbookV2Text,
  toTechnicalConfigurationBaselineWorkbookV2CellScalar,
} from "@/lib/technical-configuration-baseline-excel-v2-parse-cells"
import {
  TechnicalConfigurationBaselineWorkbookV2Error,
  type ParseTechnicalConfigurationBaselineWorkbookV2Options,
  type TechnicalConfigurationBaselineWorkbookCompatibleParseResult,
} from "@/lib/technical-configuration-baseline-excel-v2-parse-contract"
import {
  enforceTechnicalConfigurationBaselineWorkbookMeaningfulRowLimit,
  parseTechnicalConfigurationBaselineWorkbookV2,
} from "@/lib/technical-configuration-baseline-excel-v2-parse-workbook"
import { createExcelWorkbook, type ExcelWorkbook } from "@/lib/excel-workbook"

/** Maximum accepted baseline workbook size: 5 MiB. */
export const BASELINE_WORKBOOK_MAX_FILE_BYTES = 5 * 1024 * 1024

function toExcelWorkbookAdapter(workbook: Workbook): ExcelWorkbook {
  return {
    SheetNames: workbook.worksheets.map((worksheet) => worksheet.name),
    Sheets: Object.fromEntries(workbook.worksheets.map((worksheet) => [worksheet.name, worksheet])),
    _workbook: workbook,
  }
}

function detectWorkbookVersion(workbook: Workbook): 1 | 2 {
  const meta = workbook.getWorksheet(BASELINE_WORKBOOK_META_SHEET_NAME)
  const templateKind = meta
    ? toNullableTechnicalConfigurationBaselineWorkbookV2Text(meta.getCell(2, 2).value)
    : null
  const templateVersion = meta
    ? toTechnicalConfigurationBaselineWorkbookV2CellScalar(meta.getCell(3, 2).value)
    : null

  if (templateKind !== BASELINE_WORKBOOK_TEMPLATE_KIND) {
    throw new TechnicalConfigurationBaselineWorkbookV2Error([
      {
        code: "invalid_metadata",
        row: 2,
        message: "template_kind không khớp baseline workbook.",
      },
    ])
  }
  if (
    templateVersion !== BASELINE_WORKBOOK_TEMPLATE_VERSION &&
    templateVersion !== BASELINE_WORKBOOK_V2_TEMPLATE_VERSION
  ) {
    throw new TechnicalConfigurationBaselineWorkbookV2Error([
      {
        code: "version_mismatch",
        row: 3,
        message: "Chỉ hỗ trợ baseline workbook version 1 hoặc 2.",
      },
    ])
  }

  return templateVersion
}

/** Loads and parses a baseline XLSX file through the versioned compatibility boundary. */
export async function parseTechnicalConfigurationBaselineWorkbookFile(
  file: File,
  options: ParseTechnicalConfigurationBaselineWorkbookV2Options
): Promise<TechnicalConfigurationBaselineWorkbookCompatibleParseResult> {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new TechnicalConfigurationBaselineWorkbookV2Error([
      {
        code: "invalid_file_type",
        message: "Chỉ chấp nhận file .xlsx do hệ thống phát hành.",
      },
    ])
  }
  if (file.size > BASELINE_WORKBOOK_MAX_FILE_BYTES) {
    throw new TechnicalConfigurationBaselineWorkbookV2Error([
      {
        code: "file_too_large",
        message: `File XLSX có ${file.size} byte, vượt giới hạn ${BASELINE_WORKBOOK_MAX_FILE_BYTES} byte (5 MiB).`,
      },
    ])
  }

  const workbook = await createExcelWorkbook()
  try {
    const bytes = await file.arrayBuffer()
    await workbook.xlsx.load(bytes)
  } catch {
    throw new TechnicalConfigurationBaselineWorkbookV2Error([
      {
        code: "workbook_read_error",
        message: "Không thể đọc file XLSX. Vui lòng dùng workbook do hệ thống phát hành.",
      },
    ])
  }

  if (detectWorkbookVersion(workbook) === BASELINE_WORKBOOK_V2_TEMPLATE_VERSION) {
    return parseTechnicalConfigurationBaselineWorkbookV2(workbook, options)
  }

  const legacySheet = workbook.getWorksheet(BASELINE_WORKBOOK_SHEET_NAME)
  if (legacySheet) {
    enforceTechnicalConfigurationBaselineWorkbookMeaningfulRowLimit(legacySheet)
  }
  const existingCriterionCodes = new Set(
    options.existingHierarchy.criteria.map((criterion) => criterion.criterion_code)
  )
  const legacy = await parseTechnicalConfigurationBaselineWorkbook(
    toExcelWorkbookAdapter(workbook),
    { existingCriterionCodes }
  )
  return {
    format: "legacy",
    ...legacy,
  }
}
