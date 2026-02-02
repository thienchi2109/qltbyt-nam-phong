/**
 * Device Quota Excel Import Template Generator
 * Creates a structured template for importing device quotas with data validation
 */

/** Maximum rows for data validation dropdown */
const MAX_TEMPLATE_ROWS = 1000

/**
 * Interface for equipment categories to populate the template
 * IMPORTANT: Only pass leaf categories (categories with no children)
 * Parent categories should be filtered out before calling generateDeviceQuotaImportTemplate
 */
export interface NhomThietBiForTemplate {
  ma_nhom: string
  ten_nhom: string
  phan_loai: string | null
  don_vi_tinh: string | null
  parent_name: string | null
  /** Whether this category is a leaf (has no children). Only leaf categories should be included. */
  is_leaf?: boolean
}

/**
 * Generate Device Quota Import Template
 *
 * Creates a 3-sheet Excel file:
 * 1. "Nhập Định Mức" - Data entry sheet with dropdowns
 * 2. "Danh Mục Thiết Bị" - Pre-populated reference data
 * 3. "Hướng Dẫn" - Instructions with legal basis
 *
 * @param categories - Equipment category data for dropdowns and reference
 * @returns Promise<Blob> - Excel file blob for download
 */
export async function generateDeviceQuotaImportTemplate(
  categories: NhomThietBiForTemplate[]
): Promise<Blob> {
  try {
    // Dynamic import for code splitting
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()

    // ============================================================
    // SHEET 1: Nhập Định Mức (Data Entry)
    // ============================================================
    const dataEntrySheet = workbook.addWorksheet('Nhập Định Mức')

    // Define headers
    const headers = [
      'STT',
      'Mã nhóm thiết bị',
      'Tên thiết bị',
      'Đơn vị tính',
      'Số lượng định mức',
      'Số lượng tối thiểu',
      'Ghi chú',
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
      { key: 'ma_nhom', width: 20 },               // B: Mã nhóm thiết bị
      { key: 'ten_thiet_bi', width: 35 },          // C: Tên thiết bị
      { key: 'don_vi_tinh', width: 15 },           // D: Đơn vị tính
      { key: 'so_luong_dinh_muc', width: 20 },     // E: Số lượng định mức
      { key: 'so_luong_toi_thieu', width: 20 },    // F: Số lượng tối thiểu
      { key: 'ghi_chu', width: 30 },               // G: Ghi chú
    ]

    // Mark required columns with red background (B: Mã nhóm, E: Số lượng định mức)
    const requiredColumnIndices = [2, 5] // B and E (1-based)
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

    // Add row numbers (STT) automatically (column A)
    for (let row = 2; row <= 100; row++) {
      dataEntrySheet.getCell(row, 1).value = row - 1
      dataEntrySheet.getCell(row, 1).alignment = { horizontal: 'center' }
    }

    // Add data validation dropdown for "Mã nhóm thiết bị" (column B)
    // Reference data from Sheet 2
    if (categories.length > 0) {
      const categoryCodesFormula = `'Danh Mục Thiết Bị'!$A$2:$A$${categories.length + 1}`

      for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
        const cell = dataEntrySheet.getCell(row, 2) // Column B
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [categoryCodesFormula],
          showErrorMessage: true,
          errorTitle: 'Giá trị không hợp lệ',
          error: 'Vui lòng chọn mã nhóm từ danh sách.',
        }
      }

      // Add VLOOKUP formulas for auto-filling columns C and D based on column B
      for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
        // Column C: Tên thiết bị (lookup from Sheet 2, column B)
        const nameCell = dataEntrySheet.getCell(row, 3)
        nameCell.value = {
          formula: `IF(B${row}="","",VLOOKUP(B${row},'Danh Mục Thiết Bị'!$A:$B,2,FALSE))`,
        }

        // Column D: Đơn vị tính (lookup from Sheet 2, column D)
        const unitCell = dataEntrySheet.getCell(row, 4)
        unitCell.value = {
          formula: `IF(B${row}="","",VLOOKUP(B${row},'Danh Mục Thiết Bị'!$A:$D,4,FALSE))`,
        }
      }
    }

    // Add number validation for "Số lượng định mức" (column E) - must be integer > 0
    for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
      const cell = dataEntrySheet.getCell(row, 5) // Column E
      cell.dataValidation = {
        type: 'whole',
        operator: 'greaterThan',
        showErrorMessage: true,
        formulae: [0],
        errorTitle: 'Giá trị không hợp lệ',
        error: 'Số lượng định mức phải là số nguyên lớn hơn 0.',
      }
    }

    // Add number validation for "Số lượng tối thiểu" (column F) - must be integer >= 0
    for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
      const cell = dataEntrySheet.getCell(row, 6) // Column F
      cell.dataValidation = {
        type: 'whole',
        operator: 'greaterThanOrEqual',
        showErrorMessage: true,
        formulae: [0],
        allowBlank: true,
        errorTitle: 'Giá trị không hợp lệ',
        error: 'Số lượng tối thiểu phải là số nguyên >= 0 và <= số lượng định mức.',
      }
    }

    // ============================================================
    // SHEET 2: Danh Mục Thiết Bị (Reference Data)
    // ============================================================
    const referenceSheet = workbook.addWorksheet('Danh Mục Thiết Bị')

    // Define reference headers
    const refHeaders = [
      'Mã nhóm',
      'Tên thiết bị',
      'Phân loại',
      'Đơn vị tính',
      'Nhóm cha',
    ]

    // Add header row
    referenceSheet.addRow(refHeaders)

    // Style header row
    const refHeaderRow = referenceSheet.getRow(1)
    refHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    refHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' }, // Green-600
    }
    refHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' }
    refHeaderRow.height = 28

    // Set column widths
    referenceSheet.columns = [
      { key: 'ma_nhom', width: 20 },
      { key: 'ten_nhom', width: 35 },
      { key: 'phan_loai', width: 20 },
      { key: 'don_vi_tinh', width: 15 },
      { key: 'nhom_cha', width: 30 },
    ]

    // Populate reference data
    categories.forEach(category => {
      referenceSheet.addRow([
        category.ma_nhom,
        category.ten_nhom,
        category.phan_loai || '',
        category.don_vi_tinh || '',
        category.parent_name || '',
      ])
    })

    // Freeze first row
    referenceSheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ]

    // ============================================================
    // SHEET 3: Hướng Dẫn (Instructions)
    // ============================================================
    const instructionsSheet = workbook.addWorksheet('Hướng Dẫn')

    // Set column widths for instructions
    instructionsSheet.getColumn(1).width = 80

    // Add title
    instructionsSheet.addRow(['HƯỚNG DẪN NHẬP ĐỊNH MỨC THIẾT BỊ Y TẾ'])
    const titleRow = instructionsSheet.getRow(1)
    titleRow.font = { bold: true, size: 16, color: { argb: 'FF1E40AF' } }
    titleRow.height = 35
    titleRow.alignment = { vertical: 'middle' }

    instructionsSheet.addRow([''])

    // Legal basis section
    instructionsSheet.addRow(['1. CƠ SỞ PHÁP LÝ:'])
    instructionsSheet.getRow(3).font = { bold: true, size: 12, color: { argb: 'FF059669' } }
    instructionsSheet.addRow(['   - Thông tư 46/2025/TT-BYT về danh mục thiết bị y tế trang bị cho các cơ sở khám, chữa bệnh'])
    instructionsSheet.addRow(['   - Thông tư 08/2019/TT-BYT hướng dẫn quản lý, sử dụng trang thiết bị y tế'])
    instructionsSheet.addRow(['   - Nghị định 98/2021/NĐ-CP về quản lý thiết bị y tế'])
    instructionsSheet.addRow([''])

    // Required fields section
    instructionsSheet.addRow(['2. CÁC TRƯỜNG BẮT BUỘC (tiêu đề màu đỏ):'])
    instructionsSheet.getRow(8).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
    instructionsSheet.addRow(['   - Mã nhóm thiết bị: Chọn từ danh sách dropdown (chỉ nhóm lá, không có nhóm con)'])
    instructionsSheet.addRow(['   - Số lượng định mức: Số nguyên lớn hơn 0'])
    instructionsSheet.addRow([''])

    // Quantity rules section
    instructionsSheet.addRow(['3. QUY TẮC VỀ SỐ LƯỢNG:'])
    instructionsSheet.getRow(12).font = { bold: true, size: 12 }
    instructionsSheet.addRow(['   - Số lượng định mức: Bắt buộc, phải là số nguyên > 0'])
    instructionsSheet.addRow(['   - Số lượng tối thiểu: Không bắt buộc, nếu có phải là số nguyên >= 0 và <= số lượng định mức'])
    instructionsSheet.addRow(['   - Hệ thống sẽ kiểm tra và cảnh báo nếu số lượng hiện tại không đạt định mức'])
    instructionsSheet.addRow([''])

    // Auto-fill features section
    instructionsSheet.addRow(['4. TỰ ĐỘNG ĐIỀN THÔNG TIN:'])
    instructionsSheet.getRow(17).font = { bold: true, size: 12 }
    instructionsSheet.addRow(['   - Khi chọn "Mã nhóm thiết bị", các cột sau sẽ tự động điền:'])
    instructionsSheet.addRow(['     + Tên thiết bị'])
    instructionsSheet.addRow(['     + Đơn vị tính'])
    instructionsSheet.addRow(['   - Tham khảo sheet "Danh Mục Thiết Bị" để xem danh sách đầy đủ'])
    instructionsSheet.addRow([''])

    // Draft-only import section
    instructionsSheet.addRow(['5. LƯU Ý QUAN TRỌNG:'])
    instructionsSheet.getRow(23).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
    instructionsSheet.addRow(['   - Import chỉ tạo BẢN NHÁP, chưa áp dụng vào hệ thống'])
    instructionsSheet.addRow(['   - Sau khi import, bạn cần DUYỆT bản nháp để chính thức áp dụng định mức'])
    instructionsSheet.addRow(['   - Có thể chỉnh sửa hoặc xóa bản nháp trước khi duyệt'])
    instructionsSheet.addRow(['   - Không thay đổi tên các cột tiêu đề'])
    instructionsSheet.addRow(['   - Không xóa hoặc chỉnh sửa sheet "Danh Mục Thiết Bị"'])
    instructionsSheet.addRow([''])

    // Example section
    instructionsSheet.addRow(['6. VÍ DỤ:'])
    instructionsSheet.getRow(30).font = { bold: true, size: 12 }
    instructionsSheet.addRow(['   Mã nhóm: XQ001'])
    instructionsSheet.addRow(['   Tên thiết bị: (tự động điền)'])
    instructionsSheet.addRow(['   Đơn vị tính: (tự động điền)'])
    instructionsSheet.addRow(['   Số lượng định mức: 5'])
    instructionsSheet.addRow(['   Số lượng tối thiểu: 3'])
    instructionsSheet.addRow(['   Ghi chú: Ưu tiên thay thế thiết bị cũ'])

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
    console.error('Failed to generate device quota import template:', error)
    throw new Error('Không thể tạo file template định mức. Vui lòng thử lại.')
  }
}
