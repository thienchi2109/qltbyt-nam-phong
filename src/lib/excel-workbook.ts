import type { CellValue, Workbook, Worksheet } from "exceljs"

export interface ExcelWorkbook {
  SheetNames: string[]
  Sheets: Record<string, Worksheet>
  _workbook: Workbook
}

/** Creates an empty ExcelJS workbook through the lazily loaded dependency. */
export async function createExcelWorkbook(): Promise<Workbook> {
  const ExcelJS = await import("exceljs")
  return new ExcelJS.Workbook()
}

function getCellStringValue(value: CellValue): string {
  if (value === null || value === undefined) return ""

  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((item) => item.text).join("")
  }

  if (typeof value === "object" && "result" in value) {
    return getCellStringValue(value.result as CellValue)
  }

  if (typeof value === "object" && "error" in value) {
    return ""
  }

  if (value instanceof Date) {
    return value.toISOString().split("T")[0]
  }

  return String(value)
}

function getCellRawValue(value: CellValue): unknown {
  if (value === null || value === undefined) return null

  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((item) => item.text).join("")
  }

  if (typeof value === "object" && "result" in value) {
    return getCellRawValue(value.result as CellValue)
  }

  if (typeof value === "object" && "error" in value) {
    return null
  }

  return value
}

/** Loads an uploaded Excel file into the legacy workbook adapter shape. */
export async function readExcelFile(file: File): Promise<ExcelWorkbook> {
  try {
    const workbook = await createExcelWorkbook()
    const arrayBuffer = await file.arrayBuffer()
    await workbook.xlsx.load(arrayBuffer)

    const SheetNames: string[] = []
    const Sheets: Record<string, Worksheet> = {}

    workbook.eachSheet((worksheet) => {
      SheetNames.push(worksheet.name)
      Sheets[worksheet.name] = worksheet
    })

    return {
      SheetNames,
      Sheets,
      _workbook: workbook,
    }
  } catch (error) {
    console.error("Failed to read Excel file:", error)
    throw new Error("Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.")
  }
}

/** Converts worksheet rows into header-keyed records while omitting empty rows. */
export async function worksheetToJson(worksheet: Worksheet): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  const headers: string[] = []

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = getCellStringValue(cell.value)
      })
      return
    }

    const rowData: Record<string, unknown> = {}
    let hasData = false

    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1]
      if (!header) return

      const value = getCellRawValue(cell.value)
      if (value !== null && value !== "") {
        hasData = true
      }
      rowData[header] = value
    })

    if (hasData) {
      rows.push(rowData)
    }
  })

  return rows
}

/** Downloads a Blob and always releases its temporary browser resources. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename

  try {
    document.body.appendChild(link)
    link.click()
  } finally {
    if (link.parentNode) {
      link.parentNode.removeChild(link)
    }
    URL.revokeObjectURL(url)
  }
}
