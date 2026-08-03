import type { Workbook, Worksheet } from "exceljs"

import { createExcelWorkbook } from "@/lib/excel-workbook"
import {
  RESULT_WORKBOOK_META_KEYS,
  type TechnicalConfigurationResultWorkbookModel,
  type TechnicalConfigurationResultWorkbookSheetModel,
} from "@/lib/technical-configuration-result-excel-contract"
import {
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS,
  type TechnicalConfigurationDerivedStatus,
} from "@/lib/technical-configuration-evaluation"
import {
  RESULT_EXCEL_COLORS,
  RESULT_EXCEL_RANKING_HEADERS,
  RESULT_EXCEL_REFERENCE_RANKING_DISCLAIMER,
  applyResultExcelDataCell,
  applyResultExcelHeader,
  configureResultExcelRankingColumns,
  resultExcelPatternFill,
  setResultExcelMergedHeading,
} from "@/lib/technical-configuration-result-excel-styles"

type OverviewSheetModel = Extract<
  TechnicalConfigurationResultWorkbookSheetModel,
  { kind: "overview" }
>
type RankingSheetModel = Extract<
  TechnicalConfigurationResultWorkbookSheetModel,
  { kind: "ranking" }
>
type MatrixSheetModel = Extract<TechnicalConfigurationResultWorkbookSheetModel, { kind: "matrix" }>
type MetaSheetModel = Extract<TechnicalConfigurationResultWorkbookSheetModel, { kind: "meta" }>
type RankingRow = RankingSheetModel["rows"][number]

const STATUS_FILLS = {
  not_evaluated: RESULT_EXCEL_COLORS.gray,
  not_applicable: RESULT_EXCEL_COLORS.gray,
  fails: RESULT_EXCEL_COLORS.red,
  unclear: RESULT_EXCEL_COLORS.amber,
  insufficient_evidence: RESULT_EXCEL_COLORS.amber,
  exceeds: RESULT_EXCEL_COLORS.green,
  meets: RESULT_EXCEL_COLORS.green,
} as const satisfies Record<TechnicalConfigurationDerivedStatus, string>

function formatScope(scope: "all" | "selected", orderedIds: readonly string[]) {
  return scope === "all" ? "Tất cả" : `Đã chọn (${orderedIds.length})`
}

function formatRankingNotes(row: RankingRow) {
  const notes = [
    ["Không đạt", row.failed_count],
    ["Thiếu bằng chứng", row.insufficient_evidence_count],
    ["Vượt yêu cầu", row.exceeds_count],
  ] as const
  return notes
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label}: ${count}`)
    .join("; ")
}

function rankingRowValues(row: RankingRow, criterionTotal: number) {
  return [
    row.rank ?? "",
    row.display_label,
    row.supplier_name,
    row.model ?? "",
    row.eligibility === "eligible" ? "Đủ điều kiện" : "Chưa hoàn thiện",
    criterionTotal - row.incomplete_criterion_count,
    row.incomplete_criterion_count,
    formatRankingNotes(row),
  ]
}

function styleRankingTable(worksheet: Worksheet, headerRowNumber: number, rowCount: number) {
  const headerRow = worksheet.getRow(headerRowNumber)
  headerRow.height = 36
  headerRow.eachCell((cell) => applyResultExcelHeader(cell))

  for (let index = 0; index < rowCount; index += 1) {
    const row = worksheet.getRow(headerRowNumber + index + 1)
    row.height = 36
    row.eachCell({ includeEmpty: true }, (cell) => applyResultExcelDataCell(cell, index % 2 === 1))
    row.getCell(5).fill = resultExcelPatternFill(
      row.getCell(5).value === "Đủ điều kiện"
        ? RESULT_EXCEL_COLORS.green
        : RESULT_EXCEL_COLORS.amber
    )
  }
}

function renderOverview(workbook: Workbook, sheet: OverviewSheetModel) {
  const worksheet = workbook.addWorksheet(sheet.name)
  worksheet.state = sheet.state
  setResultExcelMergedHeading(worksheet, "A1:H2", "KẾT QUẢ SO SÁNH CẤU HÌNH KỸ THUẬT", "title")
  setResultExcelMergedHeading(worksheet, "A3:H3", sheet.summary.dossier.name, "header")
  worksheet.getRow(1).height = 30
  worksheet.getRow(3).height = 24

  const summaryRows = [
    ["Mã hồ sơ", sheet.summary.dossier.id],
    ["Phiên bản cấu hình cơ sở", sheet.summary.baseline_version.version_number],
    ["Khóa lúc", sheet.summary.baseline_version.locked_at ?? ""],
    [
      "Phạm vi phương án",
      formatScope(sheet.summary.scope.option_scope, sheet.summary.scope.ordered_option_ids),
    ],
    [
      "Phạm vi tiêu chí",
      formatScope(sheet.summary.scope.criterion_scope, sheet.summary.scope.ordered_criterion_ids),
    ],
    ["Thời điểm xuất", sheet.summary.generated_at],
    ["Người xuất", sheet.summary.generated_by],
  ] as const
  summaryRows.forEach(([label, value], index) => {
    const rowNumber = index + 5
    worksheet.getCell(rowNumber, 1).value = label
    worksheet.getCell(rowNumber, 2).value = value
    applyResultExcelHeader(worksheet.getCell(rowNumber, 1))
    applyResultExcelDataCell(worksheet.getCell(rowNumber, 2), false)
  })

  const totals = [
    ["Tổng phương án", sheet.summary.option_total],
    ["Tổng tiêu chí", sheet.summary.criterion_total],
  ]
  if (sheet.summary.ranking_summary) {
    totals.push(
      ["Đủ điều kiện", sheet.summary.ranking_summary.eligible_total],
      ["Chưa hoàn thiện", sheet.summary.ranking_summary.incomplete_total]
    )
  }
  totals.forEach(([label, value], index) => {
    const rowNumber = index + 5
    worksheet.getCell(rowNumber, 4).value = label
    worksheet.getCell(rowNumber, 5).value = value
    applyResultExcelHeader(worksheet.getCell(rowNumber, 4))
    applyResultExcelDataCell(worksheet.getCell(rowNumber, 5), false)
  })

  if (sheet.summary.ranking_summary) {
    setResultExcelMergedHeading(
      worksheet,
      "A13:H13",
      RESULT_EXCEL_REFERENCE_RANKING_DISCLAIMER,
      "header"
    )
    worksheet.getCell("A13").fill = resultExcelPatternFill(RESULT_EXCEL_COLORS.amber)
    worksheet.getCell("A13").font = { bold: true, color: { argb: "FF7C2D12" } }
    setResultExcelMergedHeading(worksheet, "A15:H15", "XẾP HẠNG THAM KHẢO - TOP 10", "header")
    worksheet.addRow([])
    worksheet.getRow(16).values = [...RESULT_EXCEL_RANKING_HEADERS]
    sheet.summary.ranking_summary.top_ten.forEach((row) => {
      worksheet.addRow(rankingRowValues(row, sheet.summary.criterion_total))
    })
    styleRankingTable(worksheet, 16, sheet.summary.ranking_summary.top_ten.length)
    worksheet.autoFilter = {
      from: "A16",
      to: `H${Math.max(16, 16 + sheet.summary.ranking_summary.top_ten.length)}`,
    }
  }

  configureResultExcelRankingColumns(worksheet)
  return worksheet
}

function renderRanking(workbook: Workbook, sheet: RankingSheetModel, overview: OverviewSheetModel) {
  const worksheet = workbook.addWorksheet(sheet.name)
  worksheet.state = sheet.state
  setResultExcelMergedHeading(worksheet, "A1:H2", "XẾP HẠNG PHƯƠNG ÁN", "title")
  setResultExcelMergedHeading(worksheet, "A3:H3", overview.summary.dossier.name, "header")
  worksheet.getRow(1).height = 30
  worksheet.getRow(5).values = [...RESULT_EXCEL_RANKING_HEADERS]
  sheet.rows.forEach((row) => worksheet.addRow(rankingRowValues(row, sheet.criterion_total)))
  styleRankingTable(worksheet, 5, sheet.rows.length)
  configureResultExcelRankingColumns(worksheet)
  worksheet.autoFilter = { from: "A5", to: `H${Math.max(5, 5 + sheet.rows.length)}` }
  worksheet.views = [{ state: "frozen", ySplit: 5, topLeftCell: "A6", activeCell: "A6" }]
  return worksheet
}

function formatOptionGroup(option: MatrixSheetModel["option_groups"][number]) {
  return [option.display_label, option.supplier_name, option.model]
    .filter((value): value is string => Boolean(value))
    .join(" - ")
}

function formatSupplementaryCell(row: MatrixSheetModel["rows"][number], optionIndex: number) {
  const value = row.option_values[optionIndex]
  const linkLines = value.document_links.map((link) => {
    const location = link.page_section ? ` (${link.page_section})` : ""
    return `[${link.citation_id}] ${link.document_name}${location} - ${link.document_url}`
  })
  const text = [value.supplementary_information, ...linkLines].filter(Boolean).join("\n")
  const hyperlink = value.document_links.find((link) => /^https?:\/\//i.test(link.document_url))
  return hyperlink
    ? {
        text,
        hyperlink: hyperlink.document_url,
        tooltip: hyperlink.excerpt ?? hyperlink.document_name,
      }
    : text
}

function renderMatrix(workbook: Workbook, sheet: MatrixSheetModel, overview: OverviewSheetModel) {
  const worksheet = workbook.addWorksheet(sheet.name)
  worksheet.state = sheet.state
  const lastColumn = 4 + sheet.option_groups.length * 3
  const lastColumnLetter = worksheet.getColumn(lastColumn).letter
  setResultExcelMergedHeading(
    worksheet,
    `A1:${lastColumnLetter}1`,
    "MA TRẬN SO SÁNH CHI TIẾT",
    "title"
  )
  setResultExcelMergedHeading(
    worksheet,
    `A2:${lastColumnLetter}2`,
    overview.summary.dossier.name,
    "header"
  )
  setResultExcelMergedHeading(
    worksheet,
    `A3:${lastColumnLetter}3`,
    `${sheet.option_groups.length} phương án | ${sheet.rows.length} tiêu chí`,
    "header"
  )
  setResultExcelMergedHeading(worksheet, "A4:D4", "TIÊU CHÍ CƠ SỞ", "header")

  const headerValues: string[] = [...sheet.context_columns]
  sheet.option_groups.forEach((option, index) => {
    const startColumn = 5 + index * 3
    const endColumn = startColumn + 2
    const range = `${worksheet.getColumn(startColumn).letter}4:${worksheet.getColumn(endColumn).letter}4`
    setResultExcelMergedHeading(worksheet, range, formatOptionGroup(option), "header")
    headerValues.push(...sheet.option_columns)
  })
  worksheet.getRow(5).values = headerValues
  worksheet.getRow(5).eachCell((cell) => applyResultExcelHeader(cell))

  sheet.rows.forEach((row, rowIndex) => {
    const values: Array<number | string | { text: string; hyperlink: string; tooltip: string }> = [
      row.stt,
      row.group_name,
      row.criterion_code,
      row.requirement_text,
    ]
    row.option_values.forEach((optionValue, optionIndex) => {
      values.push(
        optionValue.response_text ?? "",
        formatSupplementaryCell(row, optionIndex),
        TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS[optionValue.conclusion]
      )
    })
    const worksheetRow = worksheet.addRow(values)
    worksheetRow.height = 60
    worksheetRow.eachCell({ includeEmpty: true }, (cell) =>
      applyResultExcelDataCell(cell, rowIndex % 2 === 1)
    )
    row.option_values.forEach((optionValue, optionIndex) => {
      worksheetRow.getCell(7 + optionIndex * 3).fill = resultExcelPatternFill(
        STATUS_FILLS[optionValue.conclusion]
      )
    })
  })

  ;[8, 24, 16, 42].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width
  })
  sheet.option_groups.forEach((_, index) => {
    worksheet.getColumn(5 + index * 3).width = 32
    worksheet.getColumn(6 + index * 3).width = 40
    worksheet.getColumn(7 + index * 3).width = 22
  })
  worksheet.getRow(1).height = 30
  worksheet.getRow(4).height = 24
  worksheet.getRow(5).height = 36
  worksheet.autoFilter = {
    from: "A5",
    to: `${lastColumnLetter}${Math.max(5, 5 + sheet.rows.length)}`,
  }
  worksheet.views = [{ state: "frozen", xSplit: 4, ySplit: 5, topLeftCell: "E6", activeCell: "E6" }]
  return worksheet
}

function renderMeta(workbook: Workbook, sheet: MetaSheetModel) {
  const worksheet = workbook.addWorksheet(sheet.name)
  worksheet.state = sheet.state
  worksheet.addRow(["key", "value"])
  RESULT_WORKBOOK_META_KEYS.forEach((key) => {
    const value = sheet.metadata[key]
    worksheet.addRow([key, Array.isArray(value) ? JSON.stringify(value) : value])
  })
  worksheet.getColumn(1).width = 28
  worksheet.getColumn(2).width = 64
}

/** Renders an output-only P14B1F workbook model without mounting download behavior. */
export async function createTechnicalConfigurationResultWorkbook(
  model: TechnicalConfigurationResultWorkbookModel
): Promise<Workbook> {
  const workbook = await createExcelWorkbook()
  const overview = model.sheets.find(
    (sheet): sheet is OverviewSheetModel => sheet.kind === "overview"
  )
  if (!overview) throw new Error("Technical configuration result workbook is missing overview.")

  model.sheets.forEach((sheet) => {
    switch (sheet.kind) {
      case "overview":
        renderOverview(workbook, sheet)
        break
      case "ranking":
        renderRanking(workbook, sheet, overview)
        break
      case "matrix":
        renderMatrix(workbook, sheet, overview)
        break
      case "meta":
        renderMeta(workbook, sheet)
        break
    }
  })
  return workbook
}

/** Serializes the rendered workbook lazily without creating a Blob or triggering download. */
export async function serializeTechnicalConfigurationResultWorkbook(
  model: TechnicalConfigurationResultWorkbookModel
) {
  const workbook = await createTechnicalConfigurationResultWorkbook(model)
  return workbook.xlsx.writeBuffer()
}
