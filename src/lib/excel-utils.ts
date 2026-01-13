/**
 * Excel utilities using ExcelJS library
 * Migrated from xlsx to ExcelJS to fix security vulnerabilities (Prototype Pollution, ReDoS)
 */

import type { Workbook, Worksheet, CellValue } from 'exceljs'

/**
 * Equipment status options for data validation
 */
const EQUIPMENT_STATUS_OPTIONS = [
  'Hoạt động',
  'Chờ sửa chữa',
  'Chờ bảo trì',
  'Chờ hiệu chuẩn/kiểm định',
  'Ngưng sử dụng',
  'Chưa có nhu cầu sử dụng',
] as const

/**
 * Equipment classification options for data validation
 */
const EQUIPMENT_CLASSIFICATION_OPTIONS = ['A', 'B', 'C', 'D'] as const

/** Maximum rows for data validation in template. */
const MAX_TEMPLATE_ROWS = 1000

/**
 * Column labels for equipment import template
 * Matches the columnLabels in equipment-table-columns.tsx
 */
const EQUIPMENT_COLUMN_LABELS: Record<string, string> = {
  ma_thiet_bi: 'Mã thiết bị',
  ten_thiet_bi: 'Tên thiết bị',
  model: 'Model',
  serial: 'Serial',
  cau_hinh_thiet_bi: 'Cấu hình',
  phu_kien_kem_theo: 'Phụ kiện kèm theo',
  hang_san_xuat: 'Hãng sản xuất',
  noi_san_xuat: 'Nơi sản xuất',
  nam_san_xuat: 'Năm sản xuất',
  ngay_nhap: 'Ngày nhập',
  ngay_dua_vao_su_dung: 'Ngày đưa vào sử dụng',
  nguon_kinh_phi: 'Nguồn kinh phí',
  gia_goc: 'Giá gốc',
  nam_tinh_hao_mon: 'Năm tính hao mòn',
  ty_le_hao_mon: 'Tỷ lệ hao mòn theo TT23',
  han_bao_hanh: 'Hạn bảo hành',
  vi_tri_lap_dat: 'Vị trí lắp đặt',
  nguoi_dang_truc_tiep_quan_ly: 'Người sử dụng',
  khoa_phong_quan_ly: 'Khoa/phòng quản lý',
  tinh_trang_hien_tai: 'Tình trạng',
  ghi_chu: 'Ghi chú',
  chu_ky_bt_dinh_ky: 'Chu kỳ BT định kỳ (ngày)',
  ngay_bt_tiep_theo: 'Ngày BT tiếp theo',
  chu_ky_hc_dinh_ky: 'Chu kỳ HC định kỳ (ngày)',
  ngay_hc_tiep_theo: 'Ngày HC tiếp theo',
  chu_ky_kd_dinh_ky: 'Chu kỳ KĐ định kỳ (ngày)',
  ngay_kd_tiep_theo: 'Ngày KĐ tiếp theo',
  phan_loai_theo_nd98: 'Phân loại theo NĐ98',
}

/**
 * Helper to get the string value from an ExcelJS cell value
 */
function getCellStringValue(value: CellValue): string {
  if (value === null || value === undefined) return ''

  // Handle RichText objects
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((rt) => rt.text).join('')
  }

  // Handle formula results
  if (typeof value === 'object' && 'result' in value) {
    return getCellStringValue(value.result as CellValue)
  }

  // Handle error values
  if (typeof value === 'object' && 'error' in value) {
    return ''
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }

  return String(value)
}

/**
 * Helper to get the raw value from an ExcelJS cell value for JSON conversion
 */
function getCellRawValue(value: CellValue): unknown {
  if (value === null || value === undefined) return null

  // Handle RichText objects
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((rt) => rt.text).join('')
  }

  // Handle formula results
  if (typeof value === 'object' && 'result' in value) {
    return getCellRawValue(value.result as CellValue)
  }

  // Handle error values
  if (typeof value === 'object' && 'error' in value) {
    return null
  }

  // Handle Date objects - return as Date for proper type handling
  if (value instanceof Date) {
    return value
  }

  return value
}

/**
 * Read Excel file and return ExcelJS Workbook
 * Compatible with the old xlsx interface for backward compatibility
 */
export async function readExcelFile(file: File): Promise<{
  SheetNames: string[]
  Sheets: Record<string, Worksheet>
  _workbook: Workbook
}> {
  try {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const arrayBuffer = await file.arrayBuffer()
    await workbook.xlsx.load(arrayBuffer)

    // Build backward-compatible interface
    const sheetNames: string[] = []
    const sheets: Record<string, Worksheet> = {}

    workbook.eachSheet((worksheet) => {
      sheetNames.push(worksheet.name)
      sheets[worksheet.name] = worksheet
    })

    return {
      SheetNames: sheetNames,
      Sheets: sheets,
      _workbook: workbook
    }
  } catch (error) {
    console.error('Failed to read Excel file:', error)
    throw new Error('Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.')
  }
}

/**
 * Convert worksheet to JSON array
 * Each row becomes an object with header names as keys
 */
export async function worksheetToJson(worksheet: Worksheet): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  const headers: string[] = []

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // First row is headers
      row.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = getCellStringValue(cell.value)
      })
    } else {
      const rowData: Record<string, unknown> = {}
      let hasData = false

      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1]
        if (header) {
          const value = getCellRawValue(cell.value)
          if (value !== null && value !== '') {
            hasData = true
          }
          rowData[header] = value
        }
      })

      // Only add rows that have at least some data
      if (hasData) {
        rows.push(rowData)
      }
    }
  })

  return rows
}

/**
 * Trigger file download in browser
 */
function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export JSON data to Excel file with automatic download
 */
export async function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName: string = 'Sheet1',
  columnWidths?: number[]
): Promise<void> {
  try {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(sheetName)

    if (data.length === 0) {
      // Empty workbook
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const finalFileName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
      downloadFile(blob, finalFileName)
      return
    }

    // Extract headers from first row
    const headers = Object.keys(data[0])

    // Add header row
    worksheet.addRow(headers)

    // Style header row
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
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
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const finalFileName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
    downloadFile(blob, finalFileName)
  } catch (error) {
    console.error('Failed to export to Excel:', error)
    throw new Error('Không thể xuất file Excel. Vui lòng thử lại.')
  }
}

/**
 * Export array of arrays to Excel file
 */
export async function exportArrayToExcel(
  data: unknown[][],
  filename: string,
  sheetName: string = 'Sheet1',
  columnWidths?: number[]
): Promise<void> {
  try {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
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
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
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
        const cellLength = String(cell ?? '').length
        column.width = Math.max(cellLength + 2, 12)
      })
    }

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const finalFileName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
    downloadFile(blob, finalFileName)
  } catch (error) {
    console.error('Failed to export array to Excel:', error)
    throw new Error('Không thể xuất file Excel. Vui lòng thử lại.')
  }
}

/**
 * Create a multi-sheet Excel workbook
 */
export async function createMultiSheetExcel(
  sheets: Array<{
    name: string
    data: Record<string, unknown>[] | unknown[][]
    type: 'json' | 'array'
    columnWidths?: number[]
  }>,
  filename: string
): Promise<void> {
  try {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()

    for (const sheet of sheets) {
      const worksheet = workbook.addWorksheet(sheet.name)

      if (sheet.type === 'json') {
        const jsonData = sheet.data as Record<string, unknown>[]

        if (jsonData.length > 0) {
          // Extract headers from first row
          const headers = Object.keys(jsonData[0])

          // Add header row
          worksheet.addRow(headers)

          // Style header row
          const headerRow = worksheet.getRow(1)
          headerRow.font = { bold: true }
          headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' },
          }

          // Add data rows
          jsonData.forEach((item) => {
            const row = headers.map((header) => item[header])
            worksheet.addRow(row)
          })

          // Set column widths
          if (sheet.columnWidths) {
            sheet.columnWidths.forEach((width, index) => {
              const column = worksheet.getColumn(index + 1)
              column.width = width
            })
          } else {
            headers.forEach((header, index) => {
              const column = worksheet.getColumn(index + 1)
              column.width = Math.max(header.length + 2, 12)
            })
          }
        }
      } else {
        // Array type
        const arrayData = sheet.data as unknown[][]

        // Add all rows
        arrayData.forEach((row) => {
          worksheet.addRow(row)
        })

        // Style header row if there's data
        if (arrayData.length > 0) {
          const headerRow = worksheet.getRow(1)
          headerRow.font = { bold: true }
          headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' },
          }
        }

        // Set column widths
        if (sheet.columnWidths) {
          sheet.columnWidths.forEach((width, index) => {
            const column = worksheet.getColumn(index + 1)
            column.width = width
          })
        } else if (arrayData.length > 0) {
          arrayData[0].forEach((cell, index) => {
            const column = worksheet.getColumn(index + 1)
            const cellLength = String(cell ?? '').length
            column.width = Math.max(cellLength + 2, 12)
          })
        }
      }
    }

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const finalFileName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
    downloadFile(blob, finalFileName)
  } catch (error) {
    console.error('Failed to create multi-sheet Excel:', error)
    throw new Error('Không thể tạo file Excel. Vui lòng thử lại.')
  }
}

/**
 * Generate equipment import template with data validation dropdowns using ExcelJS
 * This provides a better user experience with dropdown lists for status and classification fields
 */
export async function generateEquipmentImportTemplate(): Promise<Blob> {
  try {
    // Dynamic import of ExcelJS for code splitting
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()

    // Sheet 1: Template Thiết Bị (main data entry sheet)
    const templateSheet = workbook.addWorksheet('Template Thiết Bị')

    // Get headers from column labels (excluding 'id')
    const headers = Object.values(EQUIPMENT_COLUMN_LABELS)
    const columnKeys = Object.keys(EQUIPMENT_COLUMN_LABELS)

    // Add header row
    templateSheet.addRow(headers)

    // Style header row
    const headerRow = templateSheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }, // Blue-600
    }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.height = 28

    // Set column widths based on header text length
    templateSheet.columns = headers.map((header, index) => ({
      key: columnKeys[index],
      width: Math.max(header.length + 4, 18),
    }))

    // Find column indices for data validation (1-based for ExcelJS)
    const statusColumnIndex = columnKeys.findIndex(key => key === 'tinh_trang_hien_tai') + 1
    const classificationColumnIndex = columnKeys.findIndex(key => key === 'phan_loai_theo_nd98') + 1

    // Add data validation for status column
    if (statusColumnIndex > 0) {
      for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
        const cell = templateSheet.getCell(row, statusColumnIndex)
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${EQUIPMENT_STATUS_OPTIONS.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Giá trị không hợp lệ',
          error: 'Vui lòng chọn giá trị từ danh sách.',
        }
      }
    }

    // Add data validation for classification column
    if (classificationColumnIndex > 0) {
      for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
        const cell = templateSheet.getCell(row, classificationColumnIndex)
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${EQUIPMENT_CLASSIFICATION_OPTIONS.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Giá trị không hợp lệ',
          error: 'Vui lòng chọn A, B, C hoặc D.',
        }
      }
    }

    // Highlight required columns with light yellow background
    const requiredColumns = ['khoa_phong_quan_ly', 'nguoi_dang_truc_tiep_quan_ly', 'tinh_trang_hien_tai', 'vi_tri_lap_dat']
    requiredColumns.forEach(colKey => {
      const colIndex = columnKeys.findIndex(key => key === colKey) + 1
      if (colIndex > 0) {
        const headerCell = templateSheet.getCell(1, colIndex)
        headerCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDC2626' }, // Red-600 for required
        }
      }
    })

    // Sheet 2: Hướng dẫn (Instructions)
    const instructionsSheet = workbook.addWorksheet('Hướng dẫn')

    // Set column widths for instructions
    instructionsSheet.getColumn(1).width = 60

    // Add title
    instructionsSheet.addRow(['HƯỚNG DẪN NHẬP LIỆU THIẾT BỊ'])
    const titleRow = instructionsSheet.getRow(1)
    titleRow.font = { bold: true, size: 16, color: { argb: 'FF1E40AF' } }
    titleRow.height = 30

    instructionsSheet.addRow([''])

    // Required fields section
    instructionsSheet.addRow(['1. CÁC TRƯỜNG BẮT BUỘC (tiêu đề màu đỏ):'])
    instructionsSheet.getRow(3).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
    instructionsSheet.addRow(['   - Khoa/phòng quản lý'])
    instructionsSheet.addRow(['   - Người sử dụng'])
    instructionsSheet.addRow(['   - Tình trạng'])
    instructionsSheet.addRow(['   - Vị trí lắp đặt'])
    instructionsSheet.addRow([''])

    // Status values section
    instructionsSheet.addRow(['2. GIÁ TRỊ TÌNH TRẠNG HỢP LỆ:'])
    instructionsSheet.getRow(9).font = { bold: true, size: 12 }
    EQUIPMENT_STATUS_OPTIONS.forEach(status => {
      instructionsSheet.addRow([`   - ${status}`])
    })
    instructionsSheet.addRow([''])

    // Classification section
    const classificationStartRow = instructionsSheet.rowCount + 1
    instructionsSheet.addRow(['3. PHÂN LOẠI THEO NĐ98:'])
    instructionsSheet.getRow(classificationStartRow).font = { bold: true, size: 12 }
    instructionsSheet.addRow(['   - A: Loại A'])
    instructionsSheet.addRow(['   - B: Loại B'])
    instructionsSheet.addRow(['   - C: Loại C'])
    instructionsSheet.addRow(['   - D: Loại D'])
    instructionsSheet.addRow([''])

    // Date format section
    const dateStartRow = instructionsSheet.rowCount + 1
    instructionsSheet.addRow(['4. ĐỊNH DẠNG NGÀY:'])
    instructionsSheet.getRow(dateStartRow).font = { bold: true, size: 12 }
    instructionsSheet.addRow(['   - DD/MM/YYYY (ví dụ: 25/12/2024)'])
    instructionsSheet.addRow(['   - hoặc YYYY-MM-DD (ví dụ: 2024-12-25)'])
    instructionsSheet.addRow([''])

    // Notes section
    const notesStartRow = instructionsSheet.rowCount + 1
    instructionsSheet.addRow(['5. LƯU Ý:'])
    instructionsSheet.getRow(notesStartRow).font = { bold: true, size: 12 }
    instructionsSheet.addRow(['   - Cột "Tình trạng" có dropdown để chọn giá trị'])
    instructionsSheet.addRow(['   - Cột "Phân loại theo NĐ98" có dropdown để chọn giá trị'])
    instructionsSheet.addRow(['   - Không thay đổi tên các cột tiêu đề'])
    instructionsSheet.addRow(['   - Các cột có tiêu đề màu đỏ là bắt buộc'])

    // Add border to all instruction cells
    for (let row = 1; row <= instructionsSheet.rowCount; row++) {
      const cell = instructionsSheet.getCell(row, 1)
      if (cell.value) {
        cell.alignment = { wrapText: true, vertical: 'middle' }
      }
    }

    // Generate buffer and return as Blob
    const buffer: ArrayBuffer = await workbook.xlsx.writeBuffer()
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  } catch (error) {
    console.error('Failed to generate equipment import template:', error)
    throw new Error('Không thể tạo file template. Vui lòng thử lại.')
  }
}
