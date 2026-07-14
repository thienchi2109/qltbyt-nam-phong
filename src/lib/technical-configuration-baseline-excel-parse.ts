import type { Worksheet } from "exceljs"

import {
  BASELINE_WORKBOOK_META_SHEET_NAME,
  BASELINE_WORKBOOK_SHEET_NAME,
  type TechnicalConfigurationBaselineWorkbookCriterionRow,
  type TechnicalConfigurationBaselineWorkbookGroupRow,
  type TechnicalConfigurationBaselineWorkbookParseResult,
  type TechnicalConfigurationBaselineWorkbookRow,
} from "@/lib/technical-configuration-baseline-excel-contract"
import {
  getBaselineWorkbookDataRowNumbers,
  normalizeBaselineWorkbookText,
  parseBaselineWorkbookMetadata,
  throwIfBaselineWorkbookIssues,
  toNullableBaselineWorkbookText,
  toPositiveBaselineWorkbookInteger,
  validateBaselineWorkbookCellValues,
  validateBaselineWorkbookColumns,
  validateBaselineWorkbookStructure,
  type TechnicalConfigurationBaselineWorkbookIssue,
} from "@/lib/technical-configuration-baseline-excel-validation"
import { worksheetToJson, type ExcelWorkbook } from "@/lib/excel-workbook"

export {
  TechnicalConfigurationBaselineWorkbookError,
  type TechnicalConfigurationBaselineWorkbookIssue,
  type TechnicalConfigurationBaselineWorkbookIssueCode,
} from "@/lib/technical-configuration-baseline-excel-validation"

export interface ParseTechnicalConfigurationBaselineWorkbookOptions {
  /**
   * criterion_code is the persisted identity. Group, order, title and requirement text remain
   * editable, so target-version membership is the complete client-side ownership check.
   */
  existingCriterionCodes: ReadonlySet<string>
}

function toGroupRow(
  row: Record<string, unknown>,
  rowNumber: number,
  expectedGroupOrder: number,
  seenGroupOrders: Set<number>,
  issues: TechnicalConfigurationBaselineWorkbookIssue[]
): TechnicalConfigurationBaselineWorkbookGroupRow | null {
  const groupOrder = toPositiveBaselineWorkbookInteger(row.group_order)
  const groupName = normalizeBaselineWorkbookText(row.group_name)

  if (groupOrder === null || groupOrder !== expectedGroupOrder) {
    issues.push({
      code:
        groupOrder !== null && seenGroupOrders.has(groupOrder)
          ? "duplicate_group_order"
          : "invalid_group_order",
      row: rowNumber,
      column: "group_order",
      message: "group_order phải là số nguyên dương, duy nhất và theo thứ tự dòng.",
    })
  }
  if (!groupName) {
    issues.push({
      code: "required_text",
      row: rowNumber,
      column: "group_name",
      message: "Tên nhóm là bắt buộc.",
    })
  }
  if (
    toNullableBaselineWorkbookText(row.criterion_order) ||
    toNullableBaselineWorkbookText(row.criterion_code) ||
    toNullableBaselineWorkbookText(row.criterion_title) ||
    toNullableBaselineWorkbookText(row.requirement_text)
  ) {
    issues.push({
      code: "invalid_row_shape",
      row: rowNumber,
      message: "Dòng GROUP không được chứa dữ liệu tiêu chí.",
    })
  }
  if (groupOrder === null || !groupName) return null

  return {
    row_type: "GROUP",
    group_order: groupOrder,
    group_name: groupName,
    criterion_order: null,
    criterion_code: null,
    criterion_title: null,
    requirement_text: null,
  }
}

function validateCriterionCode(
  criterionCode: string | null,
  rowNumber: number,
  seenCriterionCodes: Set<string>,
  existingCriterionCodes: ReadonlySet<string>,
  issues: TechnicalConfigurationBaselineWorkbookIssue[]
): void {
  if (!criterionCode) return

  if (!/^TC-[0-9]{4,}$/.test(criterionCode)) {
    issues.push({
      code: "invalid_criterion_code",
      row: rowNumber,
      column: "criterion_code",
      message: "criterion_code phải theo định dạng TC-0001 hoặc để trống.",
    })
    return
  }
  if (seenCriterionCodes.has(criterionCode)) {
    issues.push({
      code: "duplicate_criterion_code",
      row: rowNumber,
      column: "criterion_code",
      message: `criterion_code "${criterionCode}" bị trùng.`,
    })
    return
  }
  if (!existingCriterionCodes.has(criterionCode)) {
    issues.push({
      code: "changed_criterion_code",
      row: rowNumber,
      column: "criterion_code",
      message: `criterion_code "${criterionCode}" không thuộc phiên bản đích.`,
    })
  }
}

function toCriterionRow(
  row: Record<string, unknown>,
  rowNumber: number,
  currentGroupOrder: number | null,
  expectedCriterionOrder: number,
  seenCriterionOrders: Set<number>,
  seenCriterionCodes: Set<string>,
  existingCriterionCodes: ReadonlySet<string>,
  issues: TechnicalConfigurationBaselineWorkbookIssue[]
): TechnicalConfigurationBaselineWorkbookCriterionRow | null {
  const groupOrder = toPositiveBaselineWorkbookInteger(row.group_order)
  const criterionOrder = toPositiveBaselineWorkbookInteger(row.criterion_order)
  const criterionCode = toNullableBaselineWorkbookText(row.criterion_code)
  const criterionTitle = toNullableBaselineWorkbookText(row.criterion_title)
  const requirementText = normalizeBaselineWorkbookText(row.requirement_text)

  if (currentGroupOrder === null || groupOrder !== currentGroupOrder) {
    issues.push({
      code: "invalid_group_order",
      row: rowNumber,
      column: "group_order",
      message: "Dòng CRITERION phải thuộc GROUP đứng trước với cùng group_order.",
    })
  }
  if (criterionOrder === null || criterionOrder !== expectedCriterionOrder) {
    issues.push({
      code:
        criterionOrder !== null && seenCriterionOrders.has(criterionOrder)
          ? "duplicate_criterion_order"
          : "invalid_criterion_order",
      row: rowNumber,
      column: "criterion_order",
      message: "criterion_order phải là số nguyên dương, duy nhất và theo thứ tự nhóm.",
    })
  }
  if (toNullableBaselineWorkbookText(row.group_name)) {
    issues.push({
      code: "invalid_row_shape",
      row: rowNumber,
      column: "group_name",
      message: "Dòng CRITERION không được lặp group_name.",
    })
  }
  if (!requirementText) {
    issues.push({
      code: "required_text",
      row: rowNumber,
      column: "requirement_text",
      message: "Nội dung yêu cầu là bắt buộc.",
    })
  }
  validateCriterionCode(
    criterionCode,
    rowNumber,
    seenCriterionCodes,
    existingCriterionCodes,
    issues
  )
  if (
    groupOrder === null ||
    currentGroupOrder === null ||
    criterionOrder === null ||
    !requirementText
  ) {
    return null
  }

  return {
    row_type: "CRITERION",
    group_order: groupOrder,
    group_name: null,
    criterion_order: criterionOrder,
    criterion_code: criterionCode,
    criterion_title: criterionTitle,
    requirement_text: requirementText,
  }
}

async function parseRows(
  worksheet: Worksheet,
  existingCriterionCodes: ReadonlySet<string>
): Promise<{
  rows: TechnicalConfigurationBaselineWorkbookRow[]
  issues: TechnicalConfigurationBaselineWorkbookIssue[]
}> {
  const issues: TechnicalConfigurationBaselineWorkbookIssue[] = []
  const rawRows = await worksheetToJson(worksheet)
  const rowNumbers = getBaselineWorkbookDataRowNumbers(worksheet)
  const rowEntries: Array<{ row: Record<string, unknown>; rowNumber: number }> = []
  rawRows.forEach((row, index) => {
    const hasMeaningfulValue = Object.values(row).some(
      (value) => normalizeBaselineWorkbookText(value).length > 0
    )
    if (hasMeaningfulValue) {
      rowEntries.push({ row, rowNumber: rowNumbers[index] ?? index + 2 })
    }
  })
  const rows: TechnicalConfigurationBaselineWorkbookRow[] = []
  const seenGroupOrders = new Set<number>()
  const seenCriterionCodes = new Set<string>()
  let currentGroupOrder: number | null = null
  let expectedGroupOrder = 1
  let expectedCriterionOrder = 1
  let seenCriterionOrders = new Set<number>()

  rowEntries.forEach(({ row, rowNumber }) => {
    const rowType = normalizeBaselineWorkbookText(row.row_type)

    if (rowType === "GROUP") {
      const parsed = toGroupRow(row, rowNumber, expectedGroupOrder, seenGroupOrders, issues)
      const groupOrder = toPositiveBaselineWorkbookInteger(row.group_order)
      if (groupOrder !== null) {
        seenGroupOrders.add(groupOrder)
        currentGroupOrder = groupOrder
      } else {
        currentGroupOrder = null
      }
      expectedGroupOrder += 1
      expectedCriterionOrder = 1
      seenCriterionOrders = new Set<number>()
      if (parsed) rows.push(parsed)
      return
    }

    if (rowType === "CRITERION") {
      const parsed = toCriterionRow(
        row,
        rowNumber,
        currentGroupOrder,
        expectedCriterionOrder,
        seenCriterionOrders,
        seenCriterionCodes,
        existingCriterionCodes,
        issues
      )
      const criterionOrder = toPositiveBaselineWorkbookInteger(row.criterion_order)
      if (criterionOrder !== null) seenCriterionOrders.add(criterionOrder)
      const criterionCode = toNullableBaselineWorkbookText(row.criterion_code)
      if (criterionCode) seenCriterionCodes.add(criterionCode)
      expectedCriterionOrder += 1
      if (parsed) rows.push(parsed)
      return
    }

    issues.push({
      code: "invalid_row_type",
      row: rowNumber,
      column: "row_type",
      message: 'row_type phải là "GROUP" hoặc "CRITERION".',
    })
  })

  return { rows, issues }
}

/** Parses and validates the complete P5B workbook into UI-independent canonical rows. */
export async function parseTechnicalConfigurationBaselineWorkbook(
  workbook: ExcelWorkbook,
  options: ParseTechnicalConfigurationBaselineWorkbookOptions
): Promise<TechnicalConfigurationBaselineWorkbookParseResult> {
  throwIfBaselineWorkbookIssues(validateBaselineWorkbookStructure(workbook))

  const baselineSheet = workbook._workbook.getWorksheet(BASELINE_WORKBOOK_SHEET_NAME)!
  const metaSheet = workbook._workbook.getWorksheet(BASELINE_WORKBOOK_META_SHEET_NAME)!
  const cellValueIssues = validateBaselineWorkbookCellValues(baselineSheet)
  throwIfBaselineWorkbookIssues(cellValueIssues)

  const columnIssues = validateBaselineWorkbookColumns(baselineSheet)
  const { metadata, issues: metadataIssues } = parseBaselineWorkbookMetadata(metaSheet)
  const { rows, issues: rowIssues } = await parseRows(baselineSheet, options.existingCriterionCodes)

  throwIfBaselineWorkbookIssues([...columnIssues, ...metadataIssues, ...rowIssues])
  return { metadata, rows }
}

/** Adapts the baseline codec to the P5A custom workbook parser contract. */
export function createTechnicalConfigurationBaselineWorkbookParser(
  options: ParseTechnicalConfigurationBaselineWorkbookOptions
): (workbook: ExcelWorkbook) => Promise<TechnicalConfigurationBaselineWorkbookParseResult[]> {
  return async (workbook) => {
    const result = await parseTechnicalConfigurationBaselineWorkbook(workbook, options)
    return [result]
  }
}
