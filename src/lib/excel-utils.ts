import { createExcelWorkbook, downloadBlob } from "./excel-workbook"
import { addReportWorksheets, type MultiSheetExcelSheet } from "./excel-report-workbook"
export { createExcelWorkbook, downloadBlob, readExcelFile, worksheetToJson } from "./excel-workbook"
export type { ExcelWorkbook } from "./excel-workbook"
export type { MultiSheetExcelPresentation, MultiSheetExcelSheet } from "./excel-report-workbook"
export { generateEquipmentImportTemplate } from "./equipment-import-template"

/** Exports record data to a single-sheet Excel workbook and downloads it. */
export async function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName: string = "Sheet1",
  columnWidths?: number[]
): Promise<void> {
  try {
    const workbook = await createExcelWorkbook()
    const worksheet = workbook.addWorksheet(sheetName)

    if (data.length === 0) {
      // Empty workbook
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const finalFileName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
      downloadBlob(blob, finalFileName)
      return
    }

    // Extract headers from all rows to handle sparse data
    const headers = Array.from(new Set(data.flatMap((row) => Object.keys(row))))

    // Add header row
    worksheet.addRow(headers)

    // Style header row
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    }

    // Add data rows
    data.forEach((item) => {
      const row = headers.map((header) => item[header])
      worksheet.addRow(row)
    })

    // Set column widths
    if (columnWidths) {
      columnWidths.forEach((width, index) => {
        const column = worksheet.getColumn(index + 1)
        column.width = width
      })
    } else {
      // Auto-width based on header length
      headers.forEach((header, index) => {
        const column = worksheet.getColumn(index + 1)
        column.width = Math.max(header.length + 2, 12)
      })
    }

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const finalFileName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
    downloadBlob(blob, finalFileName)
  } catch (error) {
    console.error("Failed to export to Excel:", error)
    throw new Error("Không thể xuất file Excel. Vui lòng thử lại.")
  }
}

/**
 * Export array of arrays to Excel file
 */
async function exportArrayToExcel(
  data: unknown[][],
  filename: string,
  sheetName: string = "Sheet1",
  columnWidths?: number[]
): Promise<void> {
  try {
    const workbook = await createExcelWorkbook()
    const worksheet = workbook.addWorksheet(sheetName)

    // Add all rows
    data.forEach((row) => {
      worksheet.addRow(row)
    })

    // Style header row if there's data
    if (data.length > 0) {
      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      }
    }

    // Set column widths
    if (columnWidths) {
      columnWidths.forEach((width, index) => {
        const column = worksheet.getColumn(index + 1)
        column.width = width
      })
    } else if (data.length > 0) {
      // Auto-width based on first row (headers)
      data[0].forEach((cell, index) => {
        const column = worksheet.getColumn(index + 1)
        const cellLength = String(cell ?? "").length
        column.width = Math.max(cellLength + 2, 12)
      })
    }

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const finalFileName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
    downloadBlob(blob, finalFileName)
  } catch (error) {
    console.error("Failed to export array to Excel:", error)
    throw new Error("Không thể xuất file Excel. Vui lòng thử lại.")
  }
}

/**
 * Create a multi-sheet Excel workbook
 */
export async function createMultiSheetExcel(
  sheets: MultiSheetExcelSheet[],
  filename: string
): Promise<void> {
  try {
    const workbook = await createExcelWorkbook()

    addReportWorksheets(workbook, sheets)

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const finalFileName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
    downloadBlob(blob, finalFileName)
  } catch (error) {
    console.error("Failed to create multi-sheet Excel:", error)
    throw new Error("Không thể tạo file Excel. Vui lòng thử lại.")
  }
}
