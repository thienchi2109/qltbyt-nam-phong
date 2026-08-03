import type { Cell, FillPattern, Worksheet } from "exceljs"

/** Approved P14B2 workbook colors expressed as ExcelJS ARGB values. */
export const RESULT_EXCEL_COLORS = {
  title: "FF166534",
  header: "FF2E7D32",
  border: "FFD1D5DB",
  zebra: "FFF3F4F6",
  amber: "FFFFF3CD",
  green: "FFD1FAE5",
  red: "FFFEE2E2",
  gray: "FFF3F4F6",
} as const

/** Ordered column labels shared by overview and ranking tables. */
export const RESULT_EXCEL_RANKING_HEADERS = [
  "Hạng",
  "Mã PA",
  "Nhà cung cấp",
  "Model",
  "Trạng thái",
  "Đã hoàn thiện",
  "Chưa hoàn thiện",
  "Ghi chú",
] as const

/** Required disclaimer for reference-only ranking surfaces. */
export const RESULT_EXCEL_REFERENCE_RANKING_DISCLAIMER =
  "Xếp hạng chỉ mang tính tham khảo theo dữ liệu đánh giá hiện có, không phải quyết định lựa chọn nhà cung cấp."

/** Creates the solid pattern fill used by P14B2 workbook cells. */
export function resultExcelPatternFill(color: string): FillPattern {
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  }
}

/** Applies the standard thin gray border to every cell edge. */
export function applyResultExcelThinGrayBorder(cell: Cell) {
  const edge = { style: "thin" as const, color: { argb: RESULT_EXCEL_COLORS.border } }
  cell.border = { top: edge, left: edge, bottom: edge, right: edge }
}

/** Applies the approved header fill, font, alignment and border. */
export function applyResultExcelHeader(cell: Cell) {
  cell.fill = resultExcelPatternFill(RESULT_EXCEL_COLORS.header)
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
  applyResultExcelThinGrayBorder(cell)
}

/** Applies standard data-cell presentation with optional zebra fill. */
export function applyResultExcelDataCell(cell: Cell, zebra: boolean) {
  cell.fill = resultExcelPatternFill(zebra ? RESULT_EXCEL_COLORS.zebra : "FFFFFFFF")
  cell.alignment = { vertical: "top", wrapText: true }
  applyResultExcelThinGrayBorder(cell)
}

/** Merges a range and applies the approved title or header presentation. */
export function setResultExcelMergedHeading(
  worksheet: Worksheet,
  range: string,
  value: string,
  style: "title" | "header"
) {
  worksheet.mergeCells(range)
  const cell = worksheet.getCell(range.split(":")[0])
  cell.value = value

  if (style === "header") {
    applyResultExcelHeader(cell)
    return
  }

  cell.fill = resultExcelPatternFill(RESULT_EXCEL_COLORS.title)
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 }
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
}

/** Configures the fixed widths for ranking table columns. */
export function configureResultExcelRankingColumns(worksheet: Worksheet) {
  ;[10, 20, 28, 20, 18, 16, 18, 32].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width
  })
}
