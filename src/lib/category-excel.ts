/**
 * Category Excel Import Template Generator
 * Creates a structured template for importing equipment categories (nhom_thiet_bi)
 */

/** Maximum rows for data validation dropdown */
const MAX_TEMPLATE_ROWS = 1000

/**
 * Classification options per TT 08/2019
 * Only A and B classifications for medical equipment
 */
const CATEGORY_CLASSIFICATION_OPTIONS = ['A', 'B'] as const

/**
 * Generate Category Import Template
 *
 * Creates a 2-sheet Excel file:
 * 1. "Nhap Danh Muc" - Data entry sheet with validation
 * 2. "Huong Dan" - Instructions in Vietnamese
 *
 * @returns Promise<Blob> - Excel file blob for download
 */
export async function generateCategoryImportTemplate(): Promise<Blob> {
  try {
    // Dynamic import for code splitting
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()

    // ============================================================
    // SHEET 1: Nhập Danh Mục (Data Entry)
    // ============================================================
    const dataEntrySheet = workbook.addWorksheet('Nhập Danh Mục')

    // Define headers
    const headers = [
      'STT',
      'Mã nhóm',
      'Tên nhóm',
      'Mã nhóm cha',
      'Phân loại',
      'Đơn vị tính',
      'Thứ tự hiển thị',
      'Mô tả',
    ]

    // Add header row
    dataEntrySheet.addRow(headers)

    // Style header row
    const headerRow = dataEntrySheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }, // Blue-600
    }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.height = 28

    // Set column widths
    dataEntrySheet.columns = [
      { key: 'stt', width: 8 },                    // A: STT
      { key: 'ma_nhom', width: 20 },               // B: Mã nhóm
      { key: 'ten_nhom', width: 40 },              // C: Tên nhóm
      { key: 'parent_ma_nhom', width: 20 },        // D: Mã nhóm cha
      { key: 'phan_loai', width: 15 },             // E: Phân loại
      { key: 'don_vi_tinh', width: 18 },           // F: Đơn vị tính
      { key: 'thu_tu_hien_thi', width: 18 },       // G: Thứ tự hiển thị
      { key: 'mo_ta', width: 40 },                 // H: Mô tả
    ]

    // Mark required columns with red background (B: Mã nhóm, C: Tên nhóm)
    const requiredColumnIndices = [2, 3] // B and C (1-based)
    requiredColumnIndices.forEach(colIndex => {
      const headerCell = dataEntrySheet.getCell(1, colIndex)
      headerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDC2626' }, // Red-600
      }
    })

    // Freeze first row
    dataEntrySheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ]

    // Add row numbers (STT) automatically (column A) - up to MAX_TEMPLATE_ROWS
    for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
      dataEntrySheet.getCell(row, 1).value = row - 1
      dataEntrySheet.getCell(row, 1).alignment = { horizontal: 'center' }
    }

    // Add data validation dropdown for "Phân loại" (column E)
    for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
      const cell = dataEntrySheet.getCell(row, 5) // Column E
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${CATEGORY_CLASSIFICATION_OPTIONS.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Giá trị không hợp lệ',
        error: 'Vui lòng chọn A hoặc B theo TT 08/2019.',
      }
    }

    // Add number validation for "Thứ tự hiển thị" (column G) - must be integer >= 0
    for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
      const cell = dataEntrySheet.getCell(row, 7) // Column G
      cell.dataValidation = {
        type: 'whole',
        operator: 'greaterThanOrEqual',
        showErrorMessage: true,
        allowBlank: true,
        formulae: [0],
        errorTitle: 'Giá trị không hợp lệ',
        error: 'Thứ tự hiển thị phải là số nguyên >= 0.',
      }
    }

    // ============================================================
    // SHEET 2: Hướng Dẫn (Instructions)
    // ============================================================
    const instructionsSheet = workbook.addWorksheet('Hướng Dẫn')

    // Set column widths for instructions
    instructionsSheet.getColumn(1).width = 80

    // Add title
    instructionsSheet.addRow(['HƯỚNG DẪN NHẬP DANH MỤC THIẾT BỊ Y TẾ'])
    const titleRow = instructionsSheet.getRow(1)
    titleRow.font = { bold: true, size: 16, color: { argb: 'FF1E40AF' } }
    titleRow.height = 35
    titleRow.alignment = { vertical: 'middle' }

    instructionsSheet.addRow([''])

    // Legal basis section
    instructionsSheet.addRow(['1. CƠ SỞ PHÁP LÝ:'])
    instructionsSheet.getRow(3).font = { bold: true, size: 12, color: { argb: 'FF059669' } }
    instructionsSheet.addRow(['   - Thông tư 08/2019/TT-BYT hướng dẫn quản lý, sử dụng trang thiết bị y tế'])
    instructionsSheet.addRow(['   - Nghị định 98/2021/NĐ-CP về quản lý thiết bị y tế'])
    instructionsSheet.addRow([''])

    // Required fields section
    instructionsSheet.addRow(['2. CÁC TRƯỜNG BẮT BUỘC (tiêu đề màu đỏ):'])
    instructionsSheet.getRow(7).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
    instructionsSheet.addRow(['   - Mã nhóm: Mã định danh duy nhất (VD: 01, 01.01, 01.01.001)'])
    instructionsSheet.addRow(['   - Tên nhóm: Tên đầy đủ của danh mục'])
    instructionsSheet.addRow([''])

    // Code format section
    instructionsSheet.addRow(['3. ĐỊNH DẠNG MÃ NHÓM:'])
    instructionsSheet.getRow(11).font = { bold: true, size: 12 }
    instructionsSheet.addRow(['   - Cấp 1: XX (VD: 01, 02, 03)'])
    instructionsSheet.addRow(['   - Cấp 2: XX.XX (VD: 01.01, 01.02, 02.01)'])
    instructionsSheet.addRow(['   - Cấp 3: XX.XX.XXX (VD: 01.01.001, 01.01.002)'])
    instructionsSheet.addRow([''])

    // Classification section
    instructionsSheet.addRow(['4. PHÂN LOẠI THEO TT 08/2019:'])
    instructionsSheet.getRow(16).font = { bold: true, size: 12 }
    instructionsSheet.addRow(['   - A: Thiết bị y tế loại A (nguy cơ thấp)'])
    instructionsSheet.addRow(['   - B: Thiết bị y tế loại B (nguy cơ trung bình thấp)'])
    instructionsSheet.addRow([''])

    // Data entry rules section
    instructionsSheet.addRow(['5. QUY TẮC NHẬP LIỆU:'])
    instructionsSheet.getRow(20).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
    instructionsSheet.addRow(['   - Nhóm cha phải tồn tại trước nhóm con'])
    instructionsSheet.addRow(['   - Mã nhóm không được trùng lặp'])
    instructionsSheet.addRow(['   - Nếu nhập nhóm cha, nhập dòng nhóm cha trước dòng nhóm con'])
    instructionsSheet.addRow(['   - Không thay đổi tên các cột tiêu đề'])
    instructionsSheet.addRow([''])

    // Example section
    instructionsSheet.addRow(['6. VÍ DỤ:'])
    instructionsSheet.getRow(26).font = { bold: true, size: 12 }
    instructionsSheet.addRow([''])
    instructionsSheet.addRow(['   Mã nhóm: 01'])
    instructionsSheet.addRow(['   Tên nhóm: Thiết bị chẩn đoán hình ảnh'])
    instructionsSheet.addRow(['   Mã nhóm cha: (để trống - đây là nhóm gốc)'])
    instructionsSheet.addRow(['   Phân loại: B'])
    instructionsSheet.addRow(['   Đơn vị tính: Cái'])
    instructionsSheet.addRow(['   Thứ tự hiển thị: 1'])
    instructionsSheet.addRow(['   Mô tả: Nhóm các thiết bị chẩn đoán bằng hình ảnh'])
    instructionsSheet.addRow([''])

    // Second example - child category
    instructionsSheet.addRow(['   --- Ví dụ nhóm con ---'])
    instructionsSheet.getRow(36).font = { italic: true }
    instructionsSheet.addRow(['   Mã nhóm: 01.01'])
    instructionsSheet.addRow(['   Tên nhóm: Máy X-quang'])
    instructionsSheet.addRow(['   Mã nhóm cha: 01'])
    instructionsSheet.addRow(['   Phân loại: B'])
    instructionsSheet.addRow(['   Đơn vị tính: Cái'])
    instructionsSheet.addRow(['   Thứ tự hiển thị: 1'])
    instructionsSheet.addRow(['   Mô tả: Thiết bị chụp X-quang'])

    // Format instruction cells
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
    console.error('Failed to generate category import template:', error)
    throw new Error('Không thể tạo file template danh mục. Vui lòng thử lại.')
  }
}

/**
 * Download the category import template
 * Convenience function that generates and triggers download
 *
 * @param filename - Optional custom filename (defaults to 'template-nhap-danh-muc.xlsx')
 */
export async function downloadCategoryImportTemplate(
  filename: string = 'template-nhap-danh-muc.xlsx'
): Promise<void> {
  const blob = await generateCategoryImportTemplate()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
