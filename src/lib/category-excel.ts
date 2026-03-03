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
      'Định mức (SL tối đa)',
      'Tối thiểu',
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
      { key: 'dinh_muc_toi_da', width: 22 },       // I: Định mức (SL tối đa)
      { key: 'toi_thieu', width: 15 },             // J: Tối thiểu
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

    // Add number validation for "Định mức (SL tối đa)" (column I) - optional, must be integer > 0
    for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
      const cell = dataEntrySheet.getCell(row, 9) // Column I
      cell.dataValidation = {
        type: 'whole',
        operator: 'greaterThan',
        showErrorMessage: true,
        allowBlank: true,
        formulae: [0],
        errorTitle: 'Giá trị không hợp lệ',
        error: 'Số lượng định mức phải là số nguyên > 0.',
      }
    }

    // Add number validation for "Tối thiểu" (column J) - optional, must be integer >= 0
    for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
      const cell = dataEntrySheet.getCell(row, 10) // Column J
      cell.dataValidation = {
        type: 'whole',
        operator: 'greaterThanOrEqual',
        showErrorMessage: true,
        allowBlank: true,
        formulae: [0],
        errorTitle: 'Giá trị không hợp lệ',
        error: 'Số lượng tối thiểu phải là số nguyên >= 0.',
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
    instructionsSheet.addRow(['   - Mã nhóm: Mã định danh duy nhất, chấp nhận chữ và số (VD: I, 01, XN, 01.01)'])
    instructionsSheet.addRow(['   - Tên nhóm: Tên đầy đủ của danh mục'])
    instructionsSheet.addRow([''])

    // Code format section
    instructionsSheet.addRow(['3. ĐỊNH DẠNG MÃ NHÓM:'])
    instructionsSheet.getRow(11).font = { bold: true, size: 12 }
    instructionsSheet.addRow(['   - Chấp nhận chữ cái và số (A-Z, a-z, 0-9)'])
    instructionsSheet.addRow(['   - Dùng dấu chấm (.) để phân cấp, tối đa 4 cấp'])
    instructionsSheet.addRow(['   - Cấp 1: VD: I, 01, XN (nhóm gốc, không có nhóm cha)'])
    instructionsSheet.addRow(['   - Cấp 2: VD: 01, 02 hoặc 01.01 (nhóm con của cấp 1)'])
    instructionsSheet.addRow(['   - Cấp 3: VD: 01.01, 01.02 hoặc 01.01.001 (nhóm con của cấp 2)'])
    instructionsSheet.addRow(['   - Lưu ý: Mã nhóm phải duy nhất trong cùng cơ sở'])
    instructionsSheet.addRow([''])

    // Classification section
    instructionsSheet.addRow(['4. PHÂN LOẠI THEO TT 08/2019:'])
    const classificationRowNum = instructionsSheet.rowCount
    instructionsSheet.getRow(classificationRowNum).font = { bold: true, size: 12 }
    instructionsSheet.addRow(['   - A: Thiết bị y tế loại A (nguy cơ thấp)'])
    instructionsSheet.addRow(['   - B: Thiết bị y tế loại B (nguy cơ trung bình thấp)'])
    instructionsSheet.addRow([''])

    // Data entry rules section
    instructionsSheet.addRow(['5. QUY TẮC NHẬP LIỆU:'])
    const rulesRowNum = instructionsSheet.rowCount
    instructionsSheet.getRow(rulesRowNum).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
    instructionsSheet.addRow(['   - Mã nhóm không được trùng lặp'])
    instructionsSheet.addRow(['   - Nếu có nhóm cha, mã nhóm cha phải tồn tại (trong file hoặc trong hệ thống)'])
    instructionsSheet.addRow(['   - Thứ tự dòng không quan trọng - hệ thống tự sắp xếp cha trước con'])
    instructionsSheet.addRow(['   - Không thay đổi tên các cột tiêu đề'])
    instructionsSheet.addRow([''])

    // Example section
    instructionsSheet.addRow(['6. VÍ DỤ:'])
    const exampleHeaderRowNum = instructionsSheet.rowCount
    instructionsSheet.getRow(exampleHeaderRowNum).font = { bold: true, size: 12 }
    instructionsSheet.addRow([''])

    // Example 1: Root category
    instructionsSheet.addRow(['   --- Ví dụ nhóm gốc (cấp 1) ---'])
    const example1LabelRowNum = instructionsSheet.rowCount
    instructionsSheet.getRow(example1LabelRowNum).font = { italic: true, color: { argb: 'FF059669' } }
    instructionsSheet.addRow(['   Mã nhóm: I'])
    instructionsSheet.addRow(['   Tên nhóm: Trang thiết bị y tế chuyên dùng đặc thù'])
    instructionsSheet.addRow(['   Mã nhóm cha: (để trống - đây là nhóm gốc)'])
    instructionsSheet.addRow(['   Phân loại: (để trống)'])
    instructionsSheet.addRow(['   Đơn vị tính: (để trống)'])
    instructionsSheet.addRow(['   Thứ tự hiển thị: 1'])
    instructionsSheet.addRow([''])

    // Example 2: Child category (level 2)
    instructionsSheet.addRow(['   --- Ví dụ nhóm con (cấp 2) ---'])
    const example2LabelRowNum = instructionsSheet.rowCount
    instructionsSheet.getRow(example2LabelRowNum).font = { italic: true, color: { argb: 'FF2563EB' } }
    instructionsSheet.addRow(['   Mã nhóm: 01'])
    instructionsSheet.addRow(['   Tên nhóm: Hệ thống X - quang'])
    instructionsSheet.addRow(['   Mã nhóm cha: I'])
    instructionsSheet.addRow(['   Phân loại: (để trống)'])
    instructionsSheet.addRow(['   Đơn vị tính: Hệ thống'])
    instructionsSheet.addRow(['   Thứ tự hiển thị: 1'])
    instructionsSheet.addRow([''])

    // Example 3: Grandchild category (level 3)
    instructionsSheet.addRow(['   --- Ví dụ nhóm cháu (cấp 3) ---'])
    const example3LabelRowNum = instructionsSheet.rowCount
    instructionsSheet.getRow(example3LabelRowNum).font = { italic: true, color: { argb: 'FFDC2626' } }
    instructionsSheet.addRow(['   Mã nhóm: 01.01'])
    instructionsSheet.addRow(['   Tên nhóm: Máy X quang kỹ thuật số chụp tổng quát'])
    instructionsSheet.addRow(['   Mã nhóm cha: 01'])
    instructionsSheet.addRow(['   Phân loại: B'])
    instructionsSheet.addRow(['   Đơn vị tính: Máy'])
    instructionsSheet.addRow(['   Thứ tự hiển thị: 1'])
    instructionsSheet.addRow(['   Mô tả: Máy chụp X quang kỹ thuật số dùng trong chẩn đoán tổng quát'])
    instructionsSheet.addRow(['   Định mức (SL tối đa): 5'])
    instructionsSheet.addRow(['   Tối thiểu: 3'])
    instructionsSheet.addRow([''])

    // Section 7: Quota columns explanation
    instructionsSheet.addRow(['7. ĐỊNH MỨC THIẾT BỊ (TÙY CHỌN):'])
    const quotaSectionRowNum = instructionsSheet.rowCount
    instructionsSheet.getRow(quotaSectionRowNum).font = { bold: true, size: 12, color: { argb: 'FF2563EB' } }
    instructionsSheet.addRow(['   - Cột I "Định mức (SL tối đa)": Số lượng tối đa thiết bị được phép có'])
    instructionsSheet.addRow(['   - Nếu nhập cột I, giá trị phải là số nguyên > 0'])
    instructionsSheet.addRow(['   - Cột J "Tối thiểu": Số lượng tối thiểu (không được lớn hơn SL tối đa)'])
    instructionsSheet.addRow(['   - Chỉ áp dụng cho nhóm lá (nhóm không có nhóm con)'])
    instructionsSheet.addRow(['   - Nếu có giá trị: hệ thống tự tạo Quyết Định Định mức nháp'])
    instructionsSheet.addRow(['   - Nếu để trống: chỉ import danh mục (không ảnh hưởng định mức)'])

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
