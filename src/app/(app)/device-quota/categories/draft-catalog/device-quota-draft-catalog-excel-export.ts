import type { Cell, Row, Workbook, Worksheet } from "exceljs"

import { createExcelWorkbook } from "@/lib/excel-workbook"

import { getDeviceQuotaDraftCompleteness } from "./device-quota-draft-catalog-mappers"
import type {
  DeviceQuotaMergedItemRow,
  DeviceQuotaMergedRow,
} from "./device-quota-draft-catalog-types"
import { validateDeviceQuotaDraftCatalogExportSnapshot } from "./device-quota-draft-catalog-excel-export-validation"

/** The sole worksheet name used by the draft catalog export. */
export const DEVICE_QUOTA_DRAFT_EXPORT_SHEET_NAME = "Danh mục dự thảo"

/** The fixed seven-column header contract for the draft catalog table. */
export const DEVICE_QUOTA_DRAFT_EXPORT_HEADERS = [
  "TT",
  "Chủng loại",
  "Đơn vị tính",
  "Số lượng định mức",
  "ĐVT áp dụng",
  "SL đề xuất",
  "Ghi chú",
] as const

/** The source-document lead-in rendered in the metadata block. */
export const DEVICE_QUOTA_DRAFT_EXPORT_LEAD_IN =
  "Ban hành kèm theo Thông tư số 10/2026/TT-BYT ngày 14 tháng 5 năm 2026 của Bộ trưởng Bộ Y tế"

/** The exact note marker appended to an excluded proposal row. */
export const DEVICE_QUOTA_DRAFT_EXPORT_EXCLUDED_MARKER = "[Đã loại khỏi đề xuất]"
/** Backwards-compatible short name for the excluded-row marker. */
export const DEVICE_QUOTA_DRAFT_EXPORT_MARKER = DEVICE_QUOTA_DRAFT_EXPORT_EXCLUDED_MARKER
/** The full-row fill color used for excluded proposal rows. */
export const DEVICE_QUOTA_DRAFT_EXPORT_EXCLUDED_FILL = "FFE5E7EB"
/** Fixed printable widths for columns A through G. */
export const DEVICE_QUOTA_DRAFT_EXPORT_COLUMN_WIDTHS = [7, 32, 13, 64, 15, 14, 32] as const
const MERGED_SECTION_WIDTH =
  DEVICE_QUOTA_DRAFT_EXPORT_COLUMN_WIDTHS.reduce((total, width) => total + width, 0) + 2

type ExportCellValue = string | number

export type DeviceQuotaDraftCatalogWorksheetRow = readonly [
  string,
  string,
  string,
  string,
  string,
  number | "",
  string,
]

export type DeviceQuotaDraftCatalogExportSnapshot = Readonly<{
  unitId: number
  unitName: string
  userId: string
  draftStatus: "draft"
  revision: number
  lastSavedAt: string
  documentNumber: string
  documentVersion: string
  appendixTitle: string
  sourcePdfMarker: string
  sourcePdfSha256: string
  catalogVersionId: string
  rows: readonly Readonly<DeviceQuotaMergedRow>[]
  footnotes: readonly string[]
}>

const DEFAULT_FONT = { name: "Times New Roman", size: 11 }
const TITLE_FONT = { ...DEFAULT_FONT, size: 13, bold: true }
const HEADER_FONT = { ...DEFAULT_FONT, bold: true }
const HEADER_BORDER = {
  top: { style: "thin" as const, color: { argb: "FF7F8C8D" } },
  left: { style: "thin" as const, color: { argb: "FF7F8C8D" } },
  bottom: { style: "thin" as const, color: { argb: "FF7F8C8D" } },
  right: { style: "thin" as const, color: { argb: "FF7F8C8D" } },
}
const SAVED_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

function normalizeSectionLabel(label: string): string {
  return label.trim().replace(/[.:]+$/, "")
}

function formatSectionCell(row: DeviceQuotaMergedRow): string {
  return `${normalizeSectionLabel(row.sourceLabel)}. ${row.name}`
}

function getQuotaText(row: DeviceQuotaMergedItemRow): string {
  const quotaLines =
    row.regulatoryQuotaLines.length > 0 ? row.regulatoryQuotaLines : (row.quotaLines ?? [])
  return quotaLines.join("\n")
}

function getNotes(row: DeviceQuotaMergedItemRow): string {
  const note = row.notes?.trim() ?? ""
  if (!row.isExcluded || note.includes(DEVICE_QUOTA_DRAFT_EXPORT_EXCLUDED_MARKER)) return note
  return note
    ? `${note}\n${DEVICE_QUOTA_DRAFT_EXPORT_EXCLUDED_MARKER}`
    : DEVICE_QUOTA_DRAFT_EXPORT_EXCLUDED_MARKER
}

/** Maps one merged catalog row to the finite seven-cell worksheet contract. */
export function mapDeviceQuotaDraftCatalogRow(
  row: DeviceQuotaMergedRow
): DeviceQuotaDraftCatalogWorksheetRow {
  if (row.type === "section") {
    return [formatSectionCell(row), "", "", "", "", "", ""]
  }

  return [
    row.sourceLabel,
    row.name,
    row.regulatoryUnit ?? "",
    getQuotaText(row),
    row.appliedUnit ?? "",
    row.appliedQuantity ?? "",
    getNotes(row),
  ]
}

function formatSavedTimestamp(isoTimestamp: string): string {
  const parts = SAVED_TIMESTAMP_FORMATTER.formatToParts(new Date(isoTimestamp))
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}:${values.second} (Asia/Ho_Chi_Minh)`
}

function formatSavedUtc(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

/** Builds the deterministic filename from saved revision metadata. */
export function buildDeviceQuotaDraftCatalogFilename(
  snapshot: Pick<DeviceQuotaDraftCatalogExportSnapshot, "unitId" | "revision" | "lastSavedAt">
): string {
  return `danh-muc-du-thao-don-vi-${snapshot.unitId}-r${snapshot.revision}-${formatSavedUtc(snapshot.lastSavedAt)}.xlsx`
}

function setBaseCellStyle(cell: Cell): void {
  cell.font = { ...DEFAULT_FONT }
  cell.alignment = { vertical: "top", wrapText: true }
}

function setThinBorder(cell: Cell): void {
  cell.border = HEADER_BORDER
}

function estimateLineCount(value: ExportCellValue, width: number): number {
  return String(value)
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / width)), 0)
}

function setDynamicHeight(row: Row, values: readonly ExportCellValue[]): void {
  const lineCount = values.reduce<number>(
    (max, value, index) =>
      Math.max(max, estimateLineCount(value, DEVICE_QUOTA_DRAFT_EXPORT_COLUMN_WIDTHS[index])),
    1
  )
  row.height = Math.max(18, lineCount * 15)
}

function applyTableStyle(row: Row): void {
  for (let column = 1; column <= DEVICE_QUOTA_DRAFT_EXPORT_HEADERS.length; column += 1) {
    setBaseCellStyle(row.getCell(column))
  }
}

function styleExcludedRow(row: Row): void {
  for (let column = 1; column <= DEVICE_QUOTA_DRAFT_EXPORT_HEADERS.length; column += 1) {
    const cell = row.getCell(column)
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: DEVICE_QUOTA_DRAFT_EXPORT_EXCLUDED_FILL },
    }
    cell.font = { ...DEFAULT_FONT, strike: column >= 5 }
  }
}

function renderMetadata(
  worksheet: Worksheet,
  snapshot: DeviceQuotaDraftCatalogExportSnapshot
): void {
  const incomplete = snapshot.rows.some(
    (row) =>
      row.type === "item" &&
      getDeviceQuotaDraftCompleteness({
        applied_unit: row.appliedUnit,
        applied_quantity: row.appliedQuantity,
        is_excluded: row.isExcluded,
      }) === "incomplete"
  )
  const metadata = [
    "PHỤ LỤC",
    snapshot.appendixTitle,
    DEVICE_QUOTA_DRAFT_EXPORT_LEAD_IN,
    snapshot.unitName,
    incomplete ? "Bản nháp — Chưa hoàn thiện" : "Bản nháp — Đã đủ dữ liệu",
    `Phiên bản: ${snapshot.revision}`,
    formatSavedTimestamp(snapshot.lastSavedAt),
  ]

  metadata.forEach((value, index) => {
    const row = worksheet.addRow([value])
    const rowNumber = index + 1
    worksheet.mergeCells(`A${rowNumber}:G${rowNumber}`)
    const cell = row.getCell(1)
    setBaseCellStyle(cell)
    cell.alignment = { horizontal: "center", vertical: "top", wrapText: true }
    if (rowNumber === 1 || rowNumber === 2) cell.font = { ...TITLE_FONT }
    if (rowNumber === 3) cell.font = { ...DEFAULT_FONT, italic: true }
    row.height =
      rowNumber === 1 || rowNumber === 2 ? 24 : Math.max(20, estimateLineCount(value, 120) * 15)
  })
}

function renderTable(worksheet: Worksheet, snapshot: DeviceQuotaDraftCatalogExportSnapshot): void {
  worksheet.addRow([])
  const header = worksheet.addRow([...DEVICE_QUOTA_DRAFT_EXPORT_HEADERS])
  header.height = 30
  for (let column = 1; column <= DEVICE_QUOTA_DRAFT_EXPORT_HEADERS.length; column += 1) {
    const cell = header.getCell(column)
    cell.font = { ...HEADER_FONT }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    setThinBorder(cell)
  }

  snapshot.rows.forEach((sourceRow) => {
    const values = mapDeviceQuotaDraftCatalogRow(sourceRow)
    const row = worksheet.addRow([...values])
    applyTableStyle(row)
    setDynamicHeight(row, values)
    if (sourceRow.type === "section") {
      worksheet.mergeCells(`A${row.number}:G${row.number}`)
      row.getCell(1).font = { ...DEFAULT_FONT, bold: true }
      row.getCell(1).alignment = { vertical: "middle", wrapText: true }
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } }
      row.height = Math.max(24, estimateLineCount(values[0], MERGED_SECTION_WIDTH) * 15)
    } else if (sourceRow.isExcluded) {
      styleExcludedRow(row)
    }
  })
}

function renderFootnotes(worksheet: Worksheet, footnotes: readonly string[]): void {
  worksheet.addRow([])
  footnotes.forEach((footnote) => {
    const row = worksheet.addRow([footnote])
    worksheet.mergeCells(`A${row.number}:G${row.number}`)
    const cell = row.getCell(1)
    setBaseCellStyle(cell)
    row.height = Math.max(20, estimateLineCount(footnote, 120) * 15)
  })
}

function configureWorksheet(worksheet: Worksheet): void {
  DEVICE_QUOTA_DRAFT_EXPORT_COLUMN_WIDTHS.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width
  })
  worksheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "9:9",
  }
  worksheet.views = [{ state: "frozen", ySplit: 9, topLeftCell: "A10", activeCell: "A10" }]
}

/** Builds the independent workbook without reading or mutating application state. */
export async function createDeviceQuotaDraftCatalogWorkbook(
  snapshot: DeviceQuotaDraftCatalogExportSnapshot
): Promise<Workbook> {
  validateDeviceQuotaDraftCatalogExportSnapshot(snapshot)
  const workbook = await createExcelWorkbook()
  const worksheet = workbook.addWorksheet(DEVICE_QUOTA_DRAFT_EXPORT_SHEET_NAME)
  configureWorksheet(worksheet)
  renderMetadata(worksheet, snapshot)
  renderTable(worksheet, snapshot)
  renderFootnotes(worksheet, snapshot.footnotes)
  return workbook
}

/** Serializes an independent draft catalog snapshot to browser-compatible bytes. */
export async function serializeDeviceQuotaDraftCatalogWorkbook(
  snapshot: DeviceQuotaDraftCatalogExportSnapshot
): Promise<Uint8Array> {
  const workbook = await createDeviceQuotaDraftCatalogWorkbook(snapshot)
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}
