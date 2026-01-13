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
    sheet_to_json(worksheet: WorkSheet): any[]
  }
  writeFile(workbook: WorkBook, filename: string): void
  read(data: ArrayBuffer, options?: any): WorkBook
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
 * Generate equipment import template with data validation dropdowns using ExcelJS
 * This provides a better user experience with dropdown lists for status and classification fields
 */
export async function generateEquipmentImportTemplate(): Promise<Blob> {
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

  // Add data validation for status column (rows 2-1000)
  if (statusColumnIndex > 0) {
    const statusColumn = templateSheet.getColumn(statusColumnIndex)
    statusColumn.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber === 1) return // Skip header
    })

    // Apply data validation to rows 2-1000
    for (let row = 2; row <= 1000; row++) {
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

  // Add data validation for classification column (rows 2-1000)
  if (classificationColumnIndex > 0) {
    for (let row = 2; row <= 1000; row++) {
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
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
