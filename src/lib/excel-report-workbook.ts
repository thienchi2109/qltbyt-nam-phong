import type { Workbook, Worksheet } from "exceljs"

/** Controls the report-only layout around a sheet's existing data rows. */
export type MultiSheetExcelPresentation = {
  layout?: "overview"
  metadata?: string[]
  emptyMessage?: string
  freezeColumns?: number
}

/** A single typed sheet passed to the Reports workbook writer. */
export type MultiSheetExcelSheet = {
  name: string
  data: Record<string, unknown>[] | unknown[][]
  type: "json" | "array"
  columnWidths?: number[]
  headers?: string[]
  presentation?: MultiSheetExcelPresentation
}

const NAVY = "FF264B7D"
const PALE_BLUE = "FFEAF1F8"
const ZEBRA = "FFF3F6FA"
const BORDER = "FFD5DEE8"
const COUNT_FORMAT = "#,##0"
const VND_FORMAT = '#,##0 "₫"'
const PERCENT_FORMAT = '0.0"%"'

/** Adds report-styled sheets and preserves legacy sheet serialization. */
export function addReportWorksheets(workbook: Workbook, sheets: MultiSheetExcelSheet[]) {
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name)
    if (!sheet.presentation) {
      addLegacySheet(worksheet, sheet)
      continue
    }

    const presentation = sheet.presentation
    const rows = sheet.type === "json" ? (sheet.data as Record<string, unknown>[]) : []
    const arrays = sheet.type === "array" ? (sheet.data as unknown[][]) : []

    if (presentation.layout === "overview") {
      addOverview(worksheet, sheet, arrays)
      continue
    }

    const headers =
      sheet.headers ??
      (sheet.type === "json"
        ? Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
        : (arrays[0] ?? []).map((value) => String(value ?? "")))
    const dataRows =
      sheet.type === "json" ? rows.map((row) => headers.map((key) => row[key])) : arrays.slice(1)
    const actualHeaders = headers.length > 0 ? headers : ["Thông tin"]
    const columnCount = Math.max(actualHeaders.length, sheet.columnWidths?.length ?? 0, 1)

    addTitleAndMetadata(worksheet, sheet.name, presentation.metadata ?? [], columnCount)
    const headerRow = worksheet.rowCount + 1
    styleTableHeader(worksheet.addRow(actualHeaders))
    setColumnWidths(worksheet, sheet.columnWidths, actualHeaders, columnCount)

    dataRows.forEach((values, index) =>
      styleDataRow(worksheet.addRow(values), index, actualHeaders, sheet.name)
    )

    if (dataRows.length === 0 && presentation.emptyMessage) {
      const row = worksheet.addRow([presentation.emptyMessage])
      row.height = 30
      row.alignment = { vertical: "middle", wrapText: true }
      row.font = { name: "Aptos", size: 10, italic: true, color: { argb: "FF526174" } }
      row.border = { bottom: { style: "thin", color: { argb: BORDER } } }
      if (columnCount > 1) worksheet.mergeCells(row.number, 1, row.number, columnCount)
    }

    worksheet.views = [
      {
        state: "frozen",
        ySplit: headerRow,
        xSplit: presentation.freezeColumns ?? 1,
      },
    ]
    worksheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + dataRows.length, column: columnCount },
    }
    configurePrint(worksheet, columnCount, worksheet.rowCount, headerRow)
  }
}

function addLegacySheet(worksheet: Worksheet, sheet: MultiSheetExcelSheet) {
  if (sheet.type === "json") {
    const jsonData = sheet.data as Record<string, unknown>[]
    if (jsonData.length === 0) return

    const headers = Array.from(new Set(jsonData.flatMap((row) => Object.keys(row))))
    styleLegacyHeader(worksheet.addRow(headers))
    jsonData.forEach((item) => worksheet.addRow(headers.map((header) => item[header])))

    if (sheet.columnWidths) {
      sheet.columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width
      })
    } else {
      headers.forEach((header, index) => {
        worksheet.getColumn(index + 1).width = Math.max(header.length + 2, 12)
      })
    }
    return
  }

  const arrayData = sheet.data as unknown[][]
  arrayData.forEach((row) => worksheet.addRow(row))
  if (arrayData.length > 0) styleLegacyHeader(worksheet.getRow(1))

  if (sheet.columnWidths) {
    sheet.columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width
    })
  } else if (arrayData.length > 0) {
    arrayData[0].forEach((cell, index) => {
      const cellLength = String(cell ?? "").length
      worksheet.getColumn(index + 1).width = Math.max(cellLength + 2, 12)
    })
  }
}

function styleLegacyHeader(row: ReturnType<Worksheet["addRow"]>) {
  row.font = { bold: true }
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  }
}

function addOverview(worksheet: Worksheet, sheet: MultiSheetExcelSheet, rows: unknown[][]) {
  const columnCount = Math.max(sheet.columnWidths?.length ?? 0, 8)
  addTitleAndMetadata(
    worksheet,
    "BÁO CÁO TỔNG HỢP THIẾT BỊ",
    sheet.presentation?.metadata ?? [],
    columnCount
  )
  const firstContentRow = worksheet.rowCount + 1
  rows.forEach((row) => worksheet.addRow(row))
  setColumnWidths(worksheet, sheet.columnWidths, [], columnCount)

  for (const offset of [0, 3]) {
    const rowNumber = firstContentRow + offset
    if (columnCount > 1) worksheet.mergeCells(rowNumber, 1, rowNumber, columnCount)
    const cell = worksheet.getCell(rowNumber, 1)
    cell.font = { name: "Aptos", size: 11, bold: true, color: { argb: NAVY } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALE_BLUE } }
    cell.alignment = { vertical: "middle", wrapText: true }
    worksheet.getRow(rowNumber).height = 22
  }

  const labelRow = firstContentRow + 1
  const valueRow = labelRow + 1
  for (let index = 0; index < 4; index += 1) {
    const firstColumn = index * 2 + 1
    const lastColumn = firstColumn + 1
    worksheet.mergeCells(labelRow, firstColumn, labelRow, lastColumn)
    worksheet.mergeCells(valueRow, firstColumn, valueRow, lastColumn)
    const label = worksheet.getCell(labelRow, firstColumn)
    label.font = { name: "Aptos", size: 10, bold: true, color: { argb: NAVY } }
    label.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALE_BLUE } }
    label.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    label.border = { bottom: { style: "thin", color: { argb: BORDER } } }

    const value = worksheet.getCell(valueRow, firstColumn)
    value.font = { name: "Aptos", size: 22, bold: true, color: { argb: NAVY } }
    value.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F9FC" } }
    value.alignment = { horizontal: "center", vertical: "middle" }
    value.numFmt = index === 3 ? "+#,##0;-#,##0;0" : COUNT_FORMAT
    value.border = { bottom: { style: "thin", color: { argb: BORDER } } }
  }
  worksheet.getRow(labelRow).height = 28
  worksheet.getRow(valueRow).height = 38

  const noteRow = worksheet.getRow(firstContentRow + 4)
  noteRow.height = 36
  noteRow.getCell(1).alignment = { vertical: "middle", wrapText: true }
  noteRow.getCell(1).font = { name: "Aptos", size: 10, color: { argb: "FF526174" } }
  if (columnCount > 1) worksheet.mergeCells(noteRow.number, 1, noteRow.number, columnCount)
  configurePrint(worksheet, columnCount, worksheet.rowCount)
}

function addTitleAndMetadata(
  worksheet: Worksheet,
  title: string,
  metadata: string[],
  columnCount: number
) {
  const titleRow = worksheet.addRow([title])
  if (columnCount > 1) worksheet.mergeCells(titleRow.number, 1, titleRow.number, columnCount)
  titleRow.height = 32
  titleRow.getCell(1).font = { name: "Aptos", size: 18, bold: true, color: { argb: NAVY } }
  titleRow.getCell(1).alignment = { vertical: "middle", wrapText: true }

  metadata.forEach((text) => {
    const row = worksheet.addRow([text])
    if (columnCount > 1) worksheet.mergeCells(row.number, 1, row.number, columnCount)
    row.height = 26
    row.getCell(1).font = { name: "Aptos", size: 10, color: { argb: "FF526174" } }
    row.getCell(1).alignment = { vertical: "middle", wrapText: true }
    row.getCell(1).border = { bottom: { style: "hair", color: { argb: BORDER } } }
  })
}

function styleTableHeader(row: ReturnType<Worksheet["addRow"]>) {
  row.height = 34
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.border = { bottom: { style: "thin", color: { argb: BORDER } } }
  })
}

function styleDataRow(
  row: ReturnType<Worksheet["addRow"]>,
  index: number,
  headers: string[],
  sheetName: string
) {
  row.eachCell({ includeEmpty: true }, (cell, column) => {
    if (index % 2 === 1) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } }
    }
    cell.font = { name: "Aptos", size: 10, color: { argb: "FF243244" } }
    cell.alignment = { vertical: "top", wrapText: true }
    cell.border = { bottom: { style: "hair", color: { argb: BORDER } } }
    if (typeof cell.value === "number") {
      cell.numFmt = numberFormat(sheetName, headers[column - 1], row.getCell(1).value)
    }
  })
}

function numberFormat(sheetName: string, header: string, rowLabel: unknown) {
  if (header === "Tỷ lệ (%)") return PERCENT_FORMAT
  if (
    (sheetName === "Chi tiết giao dịch" && header === "Giá trị") ||
    (header === "Giá trị" &&
      [
        "Tổng chi phí sửa chữa",
        "Chi phí TB ca hoàn thành",
        "Chi phí TB ca hoàn thành có ghi nhận chi phí",
      ].includes(String(rowLabel)))
  ) {
    return VND_FORMAT
  }
  return COUNT_FORMAT
}

function setColumnWidths(
  worksheet: Worksheet,
  explicitWidths: number[] | undefined,
  headers: string[],
  columnCount: number
) {
  for (let column = 1; column <= columnCount; column += 1) {
    const width =
      explicitWidths?.[column - 1] ??
      Math.min(Math.max((headers[column - 1]?.length ?? 10) + 2, 12), 36)
    worksheet.getColumn(column).width = width
  }
}

function configurePrint(
  worksheet: Worksheet,
  columnCount: number,
  lastRow: number,
  headerRow?: number
) {
  worksheet.pageSetup.orientation = "landscape"
  worksheet.pageSetup.paperSize = 9
  worksheet.pageSetup.fitToPage = true
  worksheet.pageSetup.fitToWidth = 1
  worksheet.pageSetup.fitToHeight = 0
  worksheet.pageSetup.margins = {
    left: 0.25,
    right: 0.25,
    top: 0.5,
    bottom: 0.5,
    header: 0.2,
    footer: 0.2,
  }
  worksheet.pageSetup.printArea = `A1:${columnName(columnCount)}${lastRow}`
  if (headerRow) worksheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`
  worksheet.headerFooter.oddFooter = "&P / &N"
}

function columnName(column: number) {
  let name = ""
  let value = column
  while (value > 0) {
    value -= 1
    name = String.fromCharCode(65 + (value % 26)) + name
    value = Math.floor(value / 26)
  }
  return name
}
