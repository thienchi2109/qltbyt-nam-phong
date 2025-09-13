/**
 * Excel utilities with dynamic import for XLSX library
 * This ensures XLSX is only loaded when actually needed for export/import operations
 */

// Type definitions for XLSX (to avoid importing the full library)
export interface WorkSheet {
  [key: string]: any
  '!cols'?: Array<{ wch: number }>
}

export interface WorkBook {
  Sheets: { [name: string]: WorkSheet }
  SheetNames: string[]
}

export interface ExcelUtils {
  utils: {
    book_new(): WorkBook
    book_append_sheet(workbook: WorkBook, worksheet: WorkSheet, name: string): void
    aoa_to_sheet(data: any[][]): WorkSheet
    json_to_sheet(data: any[]): WorkSheet
  }
  writeFile(workbook: WorkBook, filename: string): void
  read(data: ArrayBuffer, options?: any): WorkBook
  utils: any
}

/**
 * Dynamically import XLSX library only when needed
 * This reduces initial bundle size by ~600KB
 */
export async function loadExcelLibrary(): Promise<ExcelUtils> {
  try {
    // Dynamic import - only loads when this function is called
    const XLSX = await import('xlsx')
    return XLSX as any
  } catch (error) {
    console.error('Failed to load Excel library:', error)
    throw new Error('Không thể tải thư viện Excel. Vui lòng thử lại.')
  }
}

/**
 * Export data to Excel file with dynamic loading
 */
export async function exportToExcel(
  data: any[],
  filename: string,
  sheetName: string = 'Sheet1',
  columnWidths?: number[]
): Promise<void> {
  const XLSX = await loadExcelLibrary()
  
  const worksheet = XLSX.utils.json_to_sheet(data)
  
  // Set column widths if provided
  if (columnWidths) {
    worksheet['!cols'] = columnWidths.map(width => ({ wch: width }))
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  
  const finalFileName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(workbook, finalFileName)
}

/**
 * Export array of arrays to Excel file
 */
export async function exportArrayToExcel(
  data: any[][],
  filename: string,
  sheetName: string = 'Sheet1',
  columnWidths?: number[]
): Promise<void> {
  const XLSX = await loadExcelLibrary()
  
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  
  // Set column widths if provided
  if (columnWidths) {
    worksheet['!cols'] = columnWidths.map(width => ({ wch: width }))
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  
  const finalFileName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(workbook, finalFileName)
}

/**
 * Create a multi-sheet Excel workbook
 */
export async function createMultiSheetExcel(
  sheets: Array<{
    name: string
    data: any[] | any[][]
    type: 'json' | 'array'
    columnWidths?: number[]
  }>,
  filename: string
): Promise<void> {
  const XLSX = await loadExcelLibrary()
  
  const workbook = XLSX.utils.book_new()
  
  for (const sheet of sheets) {
    let worksheet: WorkSheet
    
    if (sheet.type === 'json') {
      worksheet = XLSX.utils.json_to_sheet(sheet.data)
    } else {
      worksheet = XLSX.utils.aoa_to_sheet(sheet.data)
    }
    
    // Set column widths if provided
    if (sheet.columnWidths) {
      worksheet['!cols'] = sheet.columnWidths.map(width => ({ wch: width }))
    }
    
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  }
  
  const finalFileName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(workbook, finalFileName)
}

/**
 * Read Excel file with dynamic loading
 */
export async function readExcelFile(file: File): Promise<WorkBook> {
  const XLSX = await loadExcelLibrary()
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer
        const workbook = XLSX.read(data, { type: 'array' })
        resolve(workbook)
      } catch (error) {
        reject(new Error('Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Lỗi khi đọc file. Vui lòng thử lại.'))
    }
    
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Convert worksheet to JSON with dynamic loading
 */
export async function worksheetToJson(worksheet: WorkSheet): Promise<any[]> {
  const XLSX = await loadExcelLibrary()
  return XLSX.utils.sheet_to_json(worksheet)
}
