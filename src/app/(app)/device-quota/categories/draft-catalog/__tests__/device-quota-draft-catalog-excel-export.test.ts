import { writeFileSync } from "node:fs"
import { join } from "node:path"

import type { CellValue } from "exceljs"
import { afterEach, describe, expect, it, vi } from "vitest"

import type {
  DeviceQuotaDraftCatalogExportSnapshot,
  DeviceQuotaDraftCatalogWorksheetRow,
} from "../device-quota-draft-catalog-excel-export"
import {
  DEVICE_QUOTA_DRAFT_EXPORT_COLUMN_WIDTHS,
  DEVICE_QUOTA_DRAFT_EXPORT_HEADERS,
  DEVICE_QUOTA_DRAFT_EXPORT_LEAD_IN,
  DEVICE_QUOTA_DRAFT_EXPORT_MARKER,
  DEVICE_QUOTA_DRAFT_EXPORT_SHEET_NAME,
  buildDeviceQuotaDraftCatalogFilename,
  createDeviceQuotaDraftCatalogWorkbook,
  mapDeviceQuotaDraftCatalogRow,
  serializeDeviceQuotaDraftCatalogWorkbook,
} from "../device-quota-draft-catalog-excel-export"
import {
  loadWorkbook,
  makeSnapshot,
  normalizeDraftExportArchive,
  rowNumberForSourceId,
  sourceAppendix,
  sourceManifest,
} from "./device-quota-draft-catalog-excel-export.test-support"

function cellText(value: CellValue | undefined): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("")
  }
  return String(value)
}

describe("device quota draft catalog Excel export", () => {
  afterEach(() => vi.restoreAllMocks())

  it("renders one seven-column worksheet with source order, metadata, rules, notes, and validation-only identity", async () => {
    const snapshot = makeSnapshot()
    const workbook = await createDeviceQuotaDraftCatalogWorkbook(snapshot)
    const worksheet = workbook.getWorksheet(DEVICE_QUOTA_DRAFT_EXPORT_SHEET_NAME)

    expect(workbook.worksheets).toHaveLength(1)
    expect(worksheet).toBeDefined()
    if (!worksheet) return

    expect(worksheet.columnCount).toBe(7)
    expect(worksheet.getRow(9).values.slice(1, 8)).toEqual([...DEVICE_QUOTA_DRAFT_EXPORT_HEADERS])
    expect(worksheet.rowCount).toBe(55)
    expect(worksheet.getCell(1, 1).value).toBe("PHỤ LỤC")
    expect(worksheet.getCell(2, 1).value).toBe(sourceAppendix.document_title)
    expect(worksheet.getCell(3, 1).value).toBe(DEVICE_QUOTA_DRAFT_EXPORT_LEAD_IN)
    expect(worksheet.getCell(4, 1).value).toBe(snapshot.unitName)
    expect(worksheet.getCell(5, 1).value).toBe("Bản nháp — Chưa hoàn thiện")
    expect(worksheet.getCell(6, 1).value).toBe("Phiên bản: 4")
    expect(worksheet.getCell(7, 1).value).toBe("01/09/2026 15:30:00 (Asia/Ho_Chi_Minh)")
    expect(buildDeviceQuotaDraftCatalogFilename(snapshot)).toBe(
      "danh-muc-du-thao-don-vi-23-r4-20260901T083000Z.xlsx"
    )
    expect(worksheet.getRow(8).values).toEqual([])
    expect(worksheet.getCell(1, 1).isMerged).toBe(true)
    expect(worksheet.getCell(2, 7).isMerged).toBe(true)
    expect(worksheet.getCell(7, 7).isMerged).toBe(true)

    sourceAppendix.rows.forEach((source, index) => {
      const row = worksheet.getRow(10 + index)
      expect(cellText(row.getCell(1).value)).toBe(
        source.type === "section" ? `${source.tt}. ${source.name}` : source.tt
      )
      if (source.type === "item") {
        expect(row.getCell(2).value).toBe(source.name)
        expect(row.getCell(3).value).toBe(source.unit)
        expect(row.getCell(4).value).toBe(source.quota?.join("\n"))
      }
    })

    const multilineRow = worksheet.getRow(rowNumberForSourceId("1a"))
    expect(multilineRow.getCell(4).value).toBe(sourceAppendix.rows[1]?.quota?.join("\n"))
    expect(worksheet.getCell(53, 1).value).toBe(sourceAppendix.footnotes[0])
    expect(worksheet.getCell(54, 1).value).toBe(sourceAppendix.footnotes[1])
    expect(worksheet.getCell(55, 1).value).toBe(sourceAppendix.footnotes[2])
    expect(worksheet.getCell(53, 7).isMerged).toBe(true)
    expect(worksheet.getCell(55, 7).isMerged).toBe(true)

    const technicalSentinel = "TECHNICAL-ONLY-EXPORT-CONTEXT"
    const validationOnlySnapshot: DeviceQuotaDraftCatalogExportSnapshot = {
      ...snapshot,
      sourcePdfMarker: technicalSentinel,
      sourcePdfSha256: technicalSentinel,
      catalogVersionId: technicalSentinel,
      rows: snapshot.rows.map((row) => ({
        ...row,
        sourceIdentifier: technicalSentinel,
        parentSourceIdentifier: technicalSentinel,
        sourcePages: [999],
        sourceReference: technicalSentinel,
      })),
    }
    const validationOnlyWorksheet = (await loadWorkbook(validationOnlySnapshot)).worksheets[0]
    expect(validationOnlyWorksheet).toBeDefined()
    if (!validationOnlyWorksheet) return

    const visibleValues: string[] = []
    validationOnlyWorksheet.eachRow((row) =>
      row.eachCell({ includeEmpty: true }, (cell) => visibleValues.push(cellText(cell.value)))
    )

    expect(visibleValues.join("\n")).not.toContain(technicalSentinel)
    expect(validationOnlyWorksheet.columnCount).toBe(7)
    expect(validationOnlyWorksheet.columns.some((column) => column.hidden === true)).toBe(false)
    const cellNotes: unknown[] = []
    validationOnlyWorksheet.eachRow((row) =>
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.note !== undefined) cellNotes.push(cell.note)
      })
    )
    expect(cellNotes).toEqual([])
  })

  it("rejects incoherent source parent identity before rendering", async () => {
    const snapshot = makeSnapshot()
    const rows = snapshot.rows.map((row, index) =>
      index === 1 ? { ...row, parentSourceIdentifier: "missing-source-row" } : row
    )

    await expect(createDeviceQuotaDraftCatalogWorkbook({ ...snapshot, rows })).rejects.toThrow(
      "Invalid source hierarchy"
    )
  })

  it("preserves null and zero proposal semantics and styles excluded rows without striking source cells", async () => {
    const snapshot = makeSnapshot()
    const worksheet = (await loadWorkbook(snapshot)).worksheets[0]
    if (!worksheet) return

    const nullRow = worksheet.getRow(rowNumberForSourceId("1a"))
    expect(nullRow.getCell(5).value).toBe("")
    expect(nullRow.getCell(6).value).toBe("")

    const zeroRow = worksheet.getRow(rowNumberForSourceId("1b"))
    expect(zeroRow.getCell(5).value).toBe("Máy")
    expect(zeroRow.getCell(6).value).toBe(0)
    expect(typeof zeroRow.getCell(6).value).toBe("number")

    const excludedRow = worksheet.getRow(rowNumberForSourceId("5a"))
    expect(excludedRow.getCell(2).value).toBe("Máy siêu âm chuyên tim mạch")
    expect(excludedRow.getCell(5).value).toBe("Máy")
    expect(excludedRow.getCell(6).value).toBe(1)
    expect(excludedRow.getCell(7).value).toBe(`Ghi chú cũ ${DEVICE_QUOTA_DRAFT_EXPORT_MARKER}`)
    expect(String(excludedRow.getCell(7).value).match(/\[Đã loại khỏi đề xuất\]/g)).toHaveLength(1)

    for (let column = 1; column <= 7; column += 1) {
      const cell = excludedRow.getCell(column)
      expect(cell.fill).toMatchObject({ type: "pattern", pattern: "solid" })
      expect((cell.fill as { fgColor?: { argb?: string } }).fgColor?.argb).toBe("FFE5E7EB")
      expect(Boolean(cell.font.strike)).toBe(column >= 5)
    }
    expect(excludedRow.getCell(4).value).toBe(sourceAppendix.rows[13]?.quota?.join("\n"))

    const completeSnapshot: DeviceQuotaDraftCatalogExportSnapshot = {
      ...snapshot,
      rows: snapshot.rows.map((row) =>
        row.type === "item" && row.sourceIdentifier === "1a"
          ? { ...row, appliedUnit: "Máy", appliedQuantity: 1 }
          : row
      ),
    }
    const completeWorksheet = (await loadWorkbook(completeSnapshot)).worksheets[0]
    expect(completeWorksheet?.getCell(5, 1).value).toBe("Bản nháp — Đã đủ dữ liệu")
  })

  it("rejects negative saved proposal quantities before rendering", async () => {
    const snapshot = makeSnapshot()
    const rows = snapshot.rows.map((row) =>
      row.type === "item" && row.sourceIdentifier === "1b" ? { ...row, appliedQuantity: -1 } : row
    )

    await expect(createDeviceQuotaDraftCatalogWorkbook({ ...snapshot, rows })).rejects.toThrow(
      "Invalid applied quantity"
    )
  })

  it("serializes with the required print layout, styles, widths, freeze pane, and dynamic wrapped heights", async () => {
    const snapshot = makeSnapshot()
    const workbook = await loadWorkbook(snapshot)
    const worksheet = workbook.worksheets[0]
    if (!worksheet) return

    expect(worksheet.pageSetup).toMatchObject({
      orientation: "landscape",
      paperSize: 9,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "9:9",
    })
    expect(worksheet.pageSetup.printArea).toBeUndefined()
    expect(worksheet.views[0]).toMatchObject({
      state: "frozen",
      ySplit: 9,
      topLeftCell: "A10",
      activeCell: "A10",
    })
    expect([1, 2, 3, 4, 5, 6, 7].map((column) => worksheet.getColumn(column).width)).toEqual([
      7, 32, 13, 64, 15, 14, 32,
    ])

    const narrowColumnValue = "X".repeat(104)
    const narrowColumnWorksheet = (
      await loadWorkbook({
        ...snapshot,
        rows: snapshot.rows.map((row) =>
          row.type === "item" && row.sourceIdentifier === "1a"
            ? { ...row, regulatoryUnit: narrowColumnValue }
            : row
        ),
      })
    ).worksheets[0]
    expect(narrowColumnWorksheet).toBeDefined()
    if (!narrowColumnWorksheet) return

    const narrowColumnRow = narrowColumnWorksheet.getRow(rowNumberForSourceId("1a"))
    const expectedWrappedHeight =
      Math.ceil(narrowColumnValue.length / DEVICE_QUOTA_DRAFT_EXPORT_COLUMN_WIDTHS[2]) * 15
    expect(narrowColumnRow.height).toBeGreaterThanOrEqual(expectedWrappedHeight)

    expect(worksheet.getCell(1, 1).font).toMatchObject({
      name: "Times New Roman",
      size: 13,
      bold: true,
    })
    expect(worksheet.getCell(1, 1).alignment).toMatchObject({ horizontal: "center" })
    expect(worksheet.getCell(3, 1).font).toMatchObject({
      name: "Times New Roman",
      size: 11,
      italic: true,
    })
    expect(worksheet.getCell(9, 1).font).toMatchObject({
      name: "Times New Roman",
      size: 11,
      bold: true,
    })
    expect(worksheet.getCell(9, 1).border).toMatchObject({
      top: { style: "thin" },
      right: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
    })
    expect(worksheet.getCell(rowNumberForSourceId("1a"), 4).alignment).toMatchObject({
      vertical: "top",
      wrapText: true,
    })
    expect(worksheet.getRow(rowNumberForSourceId("1a")).height).toBeGreaterThan(
      worksheet.getRow(rowNumberForSourceId("19")).height ?? 0
    )

    if (process.env.DEVICE_QUOTA_WRITE_SAMPLE === "1") {
      const samplePath = join(
        process.cwd(),
        "openspec/changes/add-device-quota-draft-excel-export/artifacts/device-quota-draft-export-sample.xlsx"
      )
      const buffer = await serializeDeviceQuotaDraftCatalogWorkbook(snapshot)
      const deterministicBuffer = await normalizeDraftExportArchive(buffer)
      writeFileSync(samplePath, Buffer.from(deterministicBuffer))
    }

    expect((await serializeDeviceQuotaDraftCatalogWorkbook(snapshot)).byteLength).toBeGreaterThan(0)
  })

  it("exposes a mapper that keeps the worksheet contract finite and source-only", () => {
    const snapshot = makeSnapshot()
    const firstItem = snapshot.rows.find((row) => row.type === "item")
    if (!firstItem || firstItem.type !== "item") return

    const mapped: DeviceQuotaDraftCatalogWorksheetRow = mapDeviceQuotaDraftCatalogRow(firstItem)
    expect(mapped).toHaveLength(7)
    expect(mapped.slice(0, 4)).toEqual([
      firstItem.sourceLabel,
      firstItem.name,
      firstItem.regulatoryUnit,
      firstItem.quotaLines?.join("\n") ?? "",
    ])
  })

  it("serializes without requiring Node Buffer.from", async () => {
    const originalBufferFrom = Buffer.from
    vi.spyOn(Buffer, "from").mockImplementation((...args) => {
      if (Buffer.isBuffer(args[0])) throw new Error("Buffer.from unavailable")
      return Reflect.apply(originalBufferFrom, Buffer, args)
    })
    await expect(serializeDeviceQuotaDraftCatalogWorkbook(makeSnapshot())).resolves.toBeInstanceOf(
      Uint8Array
    )
  })

  it("pins workbook metadata to the saved snapshot time for deterministic serialization", async () => {
    const snapshot = makeSnapshot()
    const workbook = await createDeviceQuotaDraftCatalogWorkbook(snapshot)
    const expectedTimestamp = new Date(snapshot.lastSavedAt)

    expect(workbook.created).toEqual(expectedTimestamp)
    expect(workbook.modified).toEqual(expectedTimestamp)
  })

  it("normalizes sample archive timestamps for stable repeated writes", async () => {
    const snapshot = makeSnapshot()
    const source = await serializeDeviceQuotaDraftCatalogWorkbook(snapshot)
    const normalized = await normalizeDraftExportArchive(source)
    const normalizedAgain = await normalizeDraftExportArchive(normalized)

    expect(normalized).not.toEqual(source)
    expect(normalizedAgain).toEqual(normalized)
  })

  it("sizes long merged section labels from the combined column widths", async () => {
    const longSectionName = "X".repeat(400)
    const snapshot = makeSnapshot()
    const worksheet = (
      await loadWorkbook({
        ...snapshot,
        rows: snapshot.rows.map((row) =>
          row.type === "section" && row.sourceIdentifier === "1"
            ? { ...row, name: longSectionName, displayName: longSectionName }
            : row
        ),
      })
    ).worksheets[0]
    const sectionRow = worksheet?.getRow(rowNumberForSourceId("1"))
    const mergedWidth = DEVICE_QUOTA_DRAFT_EXPORT_COLUMN_WIDTHS.reduce(
      (sum, width) => sum + width,
      0
    )
    expect(sectionRow?.height).toBeGreaterThanOrEqual(
      Math.ceil(`1. ${longSectionName}`.length / mergedWidth) * 15
    )
  })
})
