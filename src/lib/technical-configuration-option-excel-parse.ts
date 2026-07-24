import type { Worksheet } from "exceljs"

import type { BulkImportWorkbookParser } from "@/components/bulk-import/bulk-import-types"
import {
  OPTION_WORKBOOK_COLUMNS,
  OPTION_WORKBOOK_META_KEYS,
  OPTION_WORKBOOK_META_SHEET_NAME,
  OPTION_WORKBOOK_SHEET_NAME,
  OPTION_WORKBOOK_TEMPLATE_KIND,
  OPTION_WORKBOOK_TEMPLATE_VERSION,
  TechnicalConfigurationOptionWorkbookError,
  collectOptionWorkbookCellValueIssues,
  collectOptionWorkbookColumnIssues,
  collectOptionWorkbookStructureIssues,
  hasOptionWorkbookCellValue,
  isSupportedOptionWorkbookCellValue,
  throwIfOptionWorkbookIssues,
  toNullableOptionWorkbookCellText,
  toOptionWorkbookCellText,
  toPositiveOptionWorkbookInteger,
  type TechnicalConfigurationOptionWorkbookCriterion,
  type TechnicalConfigurationOptionWorkbookIssue,
  type TechnicalConfigurationOptionWorkbookMetadata,
  type TechnicalConfigurationOptionWorkbookParseOptions,
  type TechnicalConfigurationOptionWorkbookParseResult,
  type TechnicalConfigurationOptionWorkbookRow,
} from "@/lib/technical-configuration-option-excel-contract"
import { worksheetToJson, type ExcelWorkbook } from "@/lib/excel-workbook"

function parseMetadata(
  worksheet: Worksheet,
  options: TechnicalConfigurationOptionWorkbookParseOptions
): {
  metadata: TechnicalConfigurationOptionWorkbookMetadata | null
  issues: TechnicalConfigurationOptionWorkbookIssue[]
} {
  const issues: TechnicalConfigurationOptionWorkbookIssue[] = []
  const header = [
    toOptionWorkbookCellText(worksheet.getRow(1).getCell(1).value),
    toOptionWorkbookCellText(worksheet.getRow(1).getCell(2).value),
  ]
  const values: Record<string, unknown> = {}

  if (header[0] !== "key" || header[1] !== "value") {
    issues.push({
      code: "invalid_metadata",
      message: "Sheet _meta phải bắt đầu bằng hai cột key và value.",
    })
  }

  worksheet.eachRow((row, rowNumber) => {
    let hasExtraColumnValue = false
    row.eachCell((cell, columnNumber) => {
      if (columnNumber > 2 && hasOptionWorkbookCellValue(cell.value)) {
        hasExtraColumnValue = true
      }
    })
    if (hasExtraColumnValue) {
      issues.push({
        code: "invalid_metadata",
        row: rowNumber,
        message: "Sheet _meta chỉ được chứa hai cột key và value.",
      })
    }
  })

  OPTION_WORKBOOK_META_KEYS.forEach((expectedKey, index) => {
    const rowNumber = index + 2
    const keyCell = worksheet.getRow(rowNumber).getCell(1)
    const valueCell = worksheet.getRow(rowNumber).getCell(2)
    const key = toOptionWorkbookCellText(keyCell.value)

    if (key !== expectedKey || !isSupportedOptionWorkbookCellValue(valueCell.value)) {
      issues.push({
        code: "invalid_metadata",
        row: rowNumber,
        message: `Metadata phải chứa đúng khóa "${expectedKey}" theo thứ tự contract.`,
      })
      return
    }
    values[expectedKey] = valueCell.value
  })

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < OPTION_WORKBOOK_META_KEYS.length + 2) return

    let hasExtraMetadataValue = false
    row.eachCell((cell, columnNumber) => {
      if (columnNumber <= 2 && hasOptionWorkbookCellValue(cell.value)) {
        hasExtraMetadataValue = true
      }
    })
    if (hasExtraMetadataValue) {
      issues.push({
        code: "invalid_metadata",
        row: rowNumber,
        message: "Sheet _meta không được chứa khóa bổ sung.",
      })
    }
  })

  const templateKind = typeof values.template_kind === "string" ? values.template_kind : ""
  if (templateKind !== OPTION_WORKBOOK_TEMPLATE_KIND) {
    issues.push({
      code: "invalid_metadata",
      message: "Workbook không phải template phản hồi phương án kỹ thuật.",
    })
  }

  const templateVersion =
    typeof values.template_version === "number" ? values.template_version : null
  if (templateVersion !== OPTION_WORKBOOK_TEMPLATE_VERSION) {
    issues.push({
      code: "version_mismatch",
      message: "Phiên bản template phản hồi phương án không được hỗ trợ.",
    })
  }

  const dossierRevision =
    typeof values.dossier_revision === "number"
      ? toPositiveOptionWorkbookInteger(values.dossier_revision)
      : null
  const generatedAt = typeof values.generated_at === "string" ? values.generated_at : ""
  if (dossierRevision === null || generatedAt === "" || Number.isNaN(Date.parse(generatedAt))) {
    issues.push({
      code: "invalid_metadata",
      message: "Metadata revision hoặc generated_at không hợp lệ.",
    })
  }

  const dossierId = typeof values.dossier_id === "string" ? values.dossier_id : ""
  const optionId = typeof values.option_id === "string" ? values.option_id : ""
  const baselineVersionId =
    typeof values.baseline_version_id === "string" ? values.baseline_version_id : ""
  if (!dossierId || !optionId || !baselineVersionId) {
    issues.push({
      code: "invalid_metadata",
      message: "Metadata dossier, option và baseline phải là chuỗi không rỗng.",
    })
  }

  const targetValues = {
    dossier_id: dossierId,
    option_id: optionId,
    baseline_version_id: baselineVersionId,
    dossier_revision: dossierRevision,
  }
  if (
    targetValues.dossier_id !== options.expectedMetadata.dossier_id ||
    targetValues.option_id !== options.expectedMetadata.option_id ||
    targetValues.baseline_version_id !== options.expectedMetadata.baseline_version_id ||
    targetValues.dossier_revision !== options.expectedMetadata.dossier_revision
  ) {
    issues.push({
      code: "target_mismatch",
      message: "Workbook không thuộc đúng hồ sơ, phương án, baseline hoặc revision hiện tại.",
    })
  }

  if (issues.length > 0 || dossierRevision === null) {
    return { metadata: null, issues }
  }

  return {
    metadata: {
      template_kind: OPTION_WORKBOOK_TEMPLATE_KIND,
      template_version: OPTION_WORKBOOK_TEMPLATE_VERSION,
      dossier_id: targetValues.dossier_id,
      option_id: targetValues.option_id,
      baseline_version_id: targetValues.baseline_version_id,
      dossier_revision: dossierRevision,
      generated_at: generatedAt,
    },
    issues,
  }
}

function getDataRowNumbers(worksheet: Worksheet): number[] {
  const rowNumbers: number[] = []

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    let hasData = false
    row.eachCell((cell, columnNumber) => {
      if (
        columnNumber <= OPTION_WORKBOOK_COLUMNS.length &&
        hasOptionWorkbookCellValue(cell.value)
      ) {
        hasData = true
      }
    })
    if (hasData) rowNumbers.push(rowNumber)
  })

  return rowNumbers
}

function parseRow(
  record: Record<string, unknown>,
  rowNumber: number,
  expectedCriteria: Map<string, TechnicalConfigurationOptionWorkbookCriterion>,
  seenCriterionIds: Set<string>,
  issues: TechnicalConfigurationOptionWorkbookIssue[]
): TechnicalConfigurationOptionWorkbookRow | null {
  const criterionId = toOptionWorkbookCellText(record.criterion_id)
  const groupOrder = toPositiveOptionWorkbookInteger(record.group_order)
  const criterionOrder = toPositiveOptionWorkbookInteger(record.criterion_order)
  const expectedCriterion = expectedCriteria.get(criterionId)

  if (!criterionId || groupOrder === null || criterionOrder === null) {
    issues.push({
      code: "invalid_row",
      row: rowNumber,
      message: "Dòng phản hồi phải có mã tiêu chí và thứ tự dương hợp lệ.",
    })
    return null
  }
  if (seenCriterionIds.has(criterionId)) {
    issues.push({
      code: "duplicate_criterion",
      row: rowNumber,
      column: "criterion_id",
      message: `Tiêu chí "${criterionId}" xuất hiện nhiều hơn một lần.`,
    })
    return null
  }
  seenCriterionIds.add(criterionId)

  if (!expectedCriterion) {
    issues.push({
      code: "unknown_criterion",
      row: rowNumber,
      column: "criterion_id",
      message: `Tiêu chí "${criterionId}" không thuộc baseline mục tiêu.`,
    })
    return null
  }

  const parsedContext: TechnicalConfigurationOptionWorkbookCriterion = {
    group_order: groupOrder,
    group_name: toOptionWorkbookCellText(record.group_name),
    criterion_order: criterionOrder,
    criterion_id: criterionId,
    criterion_code: toOptionWorkbookCellText(record.criterion_code),
    criterion_title: toNullableOptionWorkbookCellText(record.criterion_title),
    requirement_text: toOptionWorkbookCellText(record.requirement_text),
  }
  const contextColumns: readonly (keyof TechnicalConfigurationOptionWorkbookCriterion)[] = [
    "group_order",
    "group_name",
    "criterion_order",
    "criterion_id",
    "criterion_code",
    "criterion_title",
    "requirement_text",
  ]
  contextColumns.forEach((column) => {
    if (parsedContext[column] !== expectedCriterion[column]) {
      issues.push({
        code: "changed_context",
        row: rowNumber,
        column,
        message: `Cột chỉ đọc "${column}" không khớp baseline mục tiêu.`,
      })
    }
  })

  return {
    ...expectedCriterion,
    response_text: toOptionWorkbookCellText(record.response_text),
    supplementary_information: toOptionWorkbookCellText(record.supplementary_information),
  }
}

/** Parses and validates one authoritative supplier-option response workbook snapshot. */
export async function parseTechnicalConfigurationOptionWorkbook(
  workbook: ExcelWorkbook,
  options: TechnicalConfigurationOptionWorkbookParseOptions
): Promise<TechnicalConfigurationOptionWorkbookParseResult> {
  throwIfOptionWorkbookIssues(collectOptionWorkbookStructureIssues(workbook))

  const responseSheet = workbook._workbook.getWorksheet(OPTION_WORKBOOK_SHEET_NAME)
  const metaSheet = workbook._workbook.getWorksheet(OPTION_WORKBOOK_META_SHEET_NAME)
  if (!responseSheet || !metaSheet) {
    throw new TechnicalConfigurationOptionWorkbookError([
      {
        code: "missing_sheet",
        message: "Thiếu sheet bắt buộc của template phản hồi phương án.",
      },
    ])
  }

  const worksheetIssues = [
    ...collectOptionWorkbookColumnIssues(responseSheet),
    ...collectOptionWorkbookCellValueIssues(responseSheet),
  ]
  const { metadata, issues: metadataIssues } = parseMetadata(metaSheet, options)
  throwIfOptionWorkbookIssues([...worksheetIssues, ...metadataIssues])

  const records = await worksheetToJson(responseSheet)
  const rowNumbers = getDataRowNumbers(responseSheet)
  const expectedCriteria = new Map(
    options.expectedCriteria.map((criterion) => [criterion.criterion_id, criterion])
  )
  const seenCriterionIds = new Set<string>()
  const parsedRows = new Map<string, TechnicalConfigurationOptionWorkbookRow>()
  const rowIssues: TechnicalConfigurationOptionWorkbookIssue[] = []

  records.forEach((record, index) => {
    const row = parseRow(
      record,
      rowNumbers[index] ?? index + 2,
      expectedCriteria,
      seenCriterionIds,
      rowIssues
    )
    if (row) parsedRows.set(row.criterion_id, row)
  })

  options.expectedCriteria.forEach((criterion) => {
    if (!seenCriterionIds.has(criterion.criterion_id)) {
      rowIssues.push({
        code: "missing_criterion",
        column: "criterion_id",
        message: `Thiếu tiêu chí bắt buộc "${criterion.criterion_id}".`,
      })
    }
  })
  throwIfOptionWorkbookIssues(rowIssues)

  return {
    metadata: metadata!,
    rows: options.expectedCriteria.map((criterion) => parsedRows.get(criterion.criterion_id)!),
  }
}

/** Adapts the option codec to the shared bulk-import workbook parser seam. */
export function createTechnicalConfigurationOptionWorkbookParser(
  options: TechnicalConfigurationOptionWorkbookParseOptions
): BulkImportWorkbookParser<TechnicalConfigurationOptionWorkbookParseResult> {
  return async (workbook) => [await parseTechnicalConfigurationOptionWorkbook(workbook, options)]
}
