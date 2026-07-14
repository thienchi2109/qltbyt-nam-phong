import { expect } from "vitest"

import {
  BASELINE_WORKBOOK_TEMPLATE_KIND,
  BASELINE_WORKBOOK_TEMPLATE_VERSION,
  type TechnicalConfigurationBaselineWorkbookMetadata,
  type TechnicalConfigurationBaselineWorkbookRow,
} from "@/lib/technical-configuration-baseline-excel-contract"
import { createTechnicalConfigurationBaselineWorkbook } from "@/lib/technical-configuration-baseline-excel-export"
import {
  parseTechnicalConfigurationBaselineWorkbook,
  TechnicalConfigurationBaselineWorkbookError,
} from "@/lib/technical-configuration-baseline-excel-parse"
import type { ExcelWorkbook } from "@/lib/excel-workbook"

export const METADATA: TechnicalConfigurationBaselineWorkbookMetadata = {
  template_kind: BASELINE_WORKBOOK_TEMPLATE_KIND,
  template_version: BASELINE_WORKBOOK_TEMPLATE_VERSION,
  dossier_id: "11111111-1111-4111-8111-111111111111",
  baseline_version_id: "22222222-2222-4222-8222-222222222222",
  baseline_revision: 7,
  generated_at: "2026-07-14T15:30:00.000Z",
}

export const CSV_DERIVED_ROWS: TechnicalConfigurationBaselineWorkbookRow[] = [
  {
    row_type: "GROUP",
    group_order: 1,
    group_name: "Yêu cầu kỹ thuật",
    criterion_order: null,
    criterion_code: null,
    criterion_title: null,
    requirement_text: null,
  },
  {
    row_type: "CRITERION",
    group_order: 1,
    group_name: null,
    criterion_order: 1,
    criterion_code: "TC-0007",
    criterion_title: "Môi trường hoạt động",
    requirement_text: "Môi trường hoạt động:\n+ Nhiệt độ tối đa: ≥ 30 độ C\n+ Độ ẩm tối đa: ≥ 80%",
  },
  {
    row_type: "GROUP",
    group_order: 2,
    group_name: "Nhóm hiệu chỉnh riêng",
    criterion_order: null,
    criterion_code: null,
    criterion_title: null,
    requirement_text: null,
  },
  {
    row_type: "CRITERION",
    group_order: 2,
    group_name: null,
    criterion_order: 1,
    criterion_code: null,
    criterion_title: null,
    requirement_text:
      "Các chương trình rửa: Rửa nước RO, rửa nhiệt, rửa hóa chất, rửa hóa chất nhiệt",
  },
]

export function getRowValues(
  row: { getCell: (column: number) => { value: unknown } },
  width: number
): unknown[] {
  return Array.from({ length: width }, (_, index) => row.getCell(index + 1).value)
}

export function toExcelWorkbookAdapter(
  workbook: Awaited<ReturnType<typeof createTechnicalConfigurationBaselineWorkbook>>
): ExcelWorkbook {
  return {
    SheetNames: workbook.worksheets.map((worksheet) => worksheet.name),
    Sheets: Object.fromEntries(workbook.worksheets.map((worksheet) => [worksheet.name, worksheet])),
    _workbook: workbook,
  }
}

export async function createCsvDerivedWorkbook() {
  return createTechnicalConfigurationBaselineWorkbook({
    metadata: METADATA,
    rows: CSV_DERIVED_ROWS,
  })
}

export async function expectWorkbookIssue(
  workbook: Awaited<ReturnType<typeof createTechnicalConfigurationBaselineWorkbook>>,
  expectedIssue: { code: string; row?: number }
): Promise<void> {
  try {
    await parseTechnicalConfigurationBaselineWorkbook(toExcelWorkbookAdapter(workbook), {
      existingCriterionCodes: new Set(["TC-0007"]),
    })
    throw new Error("Expected workbook parsing to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(TechnicalConfigurationBaselineWorkbookError)
    expect((error as TechnicalConfigurationBaselineWorkbookError).issues).toEqual(
      expect.arrayContaining([expect.objectContaining(expectedIssue)])
    )
  }
}
