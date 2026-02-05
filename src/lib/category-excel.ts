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
    // SHEET 1: Nhap Danh Muc (Data Entry)
    // ============================================================
    const dataEntrySheet = workbook.addWorksheet('Nhap Danh Muc')

    // Define headers
    const headers = [
      'STT',
      'Ma nhom',
      'Ten nhom',
      'Ma nhom cha',
      'Phan loai',
      'Don vi tinh',
      'Thu tu hien thi',
      'Mo ta',
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
      { key: 'ma_nhom', width: 20 },               // B: Ma nhom
      { key: 'ten_nhom', width: 40 },              // C: Ten nhom
      { key: 'parent_ma_nhom', width: 20 },        // D: Ma nhom cha
      { key: 'phan_loai', width: 15 },             // E: Phan loai
      { key: 'don_vi_tinh', width: 18 },           // F: Don vi tinh
      { key: 'thu_tu_hien_thi', width: 18 },       // G: Thu tu hien thi
      { key: 'mo_ta', width: 40 },                 // H: Mo ta
    ]

    // Mark required columns with red background (B: Ma nhom, C: Ten nhom)
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

    // Add data validation dropdown for "Phan loai" (column E)
    for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
      const cell = dataEntrySheet.getCell(row, 5) // Column E
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${CATEGORY_CLASSIFICATION_OPTIONS.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Gia tri khong hop le',
        error: 'Vui long chon A hoac B theo TT 08/2019.',
      }
    }

    // Add number validation for "Thu tu hien thi" (column G) - must be integer >= 0
    for (let row = 2; row <= MAX_TEMPLATE_ROWS; row++) {
      const cell = dataEntrySheet.getCell(row, 7) // Column G
      cell.dataValidation = {
        type: 'whole',
        operator: 'greaterThanOrEqual',
        showErrorMessage: true,
        allowBlank: true,
        formulae: [0],
        errorTitle: 'Gia tri khong hop le',
        error: 'Thu tu hien thi phai la so nguyen >= 0.',
      }
    }

    // ============================================================
    // SHEET 2: Huong Dan (Instructions)
    // ============================================================
    const instructionsSheet = workbook.addWorksheet('Huong Dan')

    // Set column widths for instructions
    instructionsSheet.getColumn(1).width = 80

    // Add title
    instructionsSheet.addRow(['HUONG DAN NHAP DANH MUC THIET BI Y TE'])
    const titleRow = instructionsSheet.getRow(1)
    titleRow.font = { bold: true, size: 16, color: { argb: 'FF1E40AF' } }
    titleRow.height = 35
    titleRow.alignment = { vertical: 'middle' }

    instructionsSheet.addRow([''])

    // Legal basis section
    instructionsSheet.addRow(['1. CO SO PHAP LY:'])
    instructionsSheet.getRow(3).font = { bold: true, size: 12, color: { argb: 'FF059669' } }
    instructionsSheet.addRow(['   - Thong tu 08/2019/TT-BYT huong dan quan ly, su dung trang thiet bi y te'])
    instructionsSheet.addRow(['   - Nghi dinh 98/2021/ND-CP ve quan ly thiet bi y te'])
    instructionsSheet.addRow([''])

    // Required fields section
    instructionsSheet.addRow(['2. CAC TRUONG BAT BUOC (tieu de mau do):'])
    instructionsSheet.getRow(7).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
    instructionsSheet.addRow(['   - Ma nhom: Ma dinh danh duy nhat (VD: 01, 01.01, 01.01.001)'])
    instructionsSheet.addRow(['   - Ten nhom: Ten day du cua danh muc'])
    instructionsSheet.addRow([''])

    // Code format section
    instructionsSheet.addRow(['3. DINH DANG MA NHOM:'])
    instructionsSheet.getRow(11).font = { bold: true, size: 12 }
    instructionsSheet.addRow(['   - Cap 1: XX (VD: 01, 02, 03)'])
    instructionsSheet.addRow(['   - Cap 2: XX.XX (VD: 01.01, 01.02, 02.01)'])
    instructionsSheet.addRow(['   - Cap 3: XX.XX.XXX (VD: 01.01.001, 01.01.002)'])
    instructionsSheet.addRow([''])

    // Classification section
    instructionsSheet.addRow(['4. PHAN LOAI THEO TT 08/2019:'])
    instructionsSheet.getRow(16).font = { bold: true, size: 12 }
    instructionsSheet.addRow(['   - A: Thiet bi y te loai A (nguy co thap)'])
    instructionsSheet.addRow(['   - B: Thiet bi y te loai B (nguy co trung binh thap)'])
    instructionsSheet.addRow([''])

    // Data entry rules section
    instructionsSheet.addRow(['5. QUY TAC NHAP LIEU:'])
    instructionsSheet.getRow(20).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
    instructionsSheet.addRow(['   - Nhom cha phai ton tai truoc nhom con'])
    instructionsSheet.addRow(['   - Ma nhom khong duoc trung lap'])
    instructionsSheet.addRow(['   - Neu nhap nhom cha, nhap dong nhom cha truoc dong nhom con'])
    instructionsSheet.addRow(['   - Khong thay doi ten cac cot tieu de'])
    instructionsSheet.addRow([''])

    // Example section
    instructionsSheet.addRow(['6. VI DU:'])
    instructionsSheet.getRow(26).font = { bold: true, size: 12 }
    instructionsSheet.addRow([''])
    instructionsSheet.addRow(['   Ma nhom: 01'])
    instructionsSheet.addRow(['   Ten nhom: Thiet bi chan doan hinh anh'])
    instructionsSheet.addRow(['   Ma nhom cha: (de trong - day la nhom goc)'])
    instructionsSheet.addRow(['   Phan loai: B'])
    instructionsSheet.addRow(['   Don vi tinh: Cai'])
    instructionsSheet.addRow(['   Thu tu hien thi: 1'])
    instructionsSheet.addRow(['   Mo ta: Nhom cac thiet bi chan doan bang hinh anh'])
    instructionsSheet.addRow([''])

    // Second example - child category
    instructionsSheet.addRow(['   --- Vi du nhom con ---'])
    instructionsSheet.getRow(36).font = { italic: true }
    instructionsSheet.addRow(['   Ma nhom: 01.01'])
    instructionsSheet.addRow(['   Ten nhom: May X-quang'])
    instructionsSheet.addRow(['   Ma nhom cha: 01'])
    instructionsSheet.addRow(['   Phan loai: B'])
    instructionsSheet.addRow(['   Don vi tinh: Cai'])
    instructionsSheet.addRow(['   Thu tu hien thi: 1'])
    instructionsSheet.addRow(['   Mo ta: Thiet bi chup X-quang'])

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
    throw new Error('Khong the tao file template danh muc. Vui long thu lai.')
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
