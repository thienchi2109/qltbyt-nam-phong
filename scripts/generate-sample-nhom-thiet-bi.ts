/**
 * Generate Sample nhom_thiet_bi (Equipment Category) Master Data Excel
 *
 * This script creates a sample Excel file demonstrating the hierarchical
 * structure of Vietnamese medical equipment categories per Circular 08/2019.
 *
 * Usage:
 *   npx tsx scripts/generate-sample-nhom-thiet-bi.ts
 *
 * Output:
 *   scripts/output/sample-nhom-thiet-bi.xlsx
 */

import ExcelJS from 'exceljs'
import * as fs from 'fs'
import * as path from 'path'

// Sample hierarchical equipment categories based on Circular 08/2019
// Structure: Level 1 (Nhóm) → Level 2 (Phân nhóm) → Level 3 (Chi tiết)
const SAMPLE_CATEGORIES = [
  // ============================================================
  // NHÓM 1: THIẾT BỊ CHẨN ĐOÁN HÌNH ẢNH
  // ============================================================
  {
    ma_nhom: '01',
    ten_nhom: 'Thiết bị chẩn đoán hình ảnh',
    phan_loai: null,
    don_vi_tinh: null,
    parent_id: null,
    level: 1,
    is_leaf: false,
  },
  {
    ma_nhom: '01.01',
    ten_nhom: 'Thiết bị X-quang',
    phan_loai: 'C',
    don_vi_tinh: null,
    parent_id: '01',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '01.01.001',
    ten_nhom: 'Máy X-quang kỹ thuật số (DR)',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '01.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '01.01.002',
    ten_nhom: 'Máy X-quang di động',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '01.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '01.01.003',
    ten_nhom: 'Máy X-quang C-Arm',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '01.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '01.02',
    ten_nhom: 'Thiết bị siêu âm',
    phan_loai: 'B',
    don_vi_tinh: null,
    parent_id: '01',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '01.02.001',
    ten_nhom: 'Máy siêu âm 2D',
    phan_loai: 'B',
    don_vi_tinh: 'Máy',
    parent_id: '01.02',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '01.02.002',
    ten_nhom: 'Máy siêu âm 4D',
    phan_loai: 'B',
    don_vi_tinh: 'Máy',
    parent_id: '01.02',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '01.02.003',
    ten_nhom: 'Máy siêu âm Doppler màu',
    phan_loai: 'B',
    don_vi_tinh: 'Máy',
    parent_id: '01.02',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '01.03',
    ten_nhom: 'Thiết bị CT Scanner',
    phan_loai: 'C',
    don_vi_tinh: null,
    parent_id: '01',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '01.03.001',
    ten_nhom: 'Máy CT 16 lát cắt',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '01.03',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '01.03.002',
    ten_nhom: 'Máy CT 64 lát cắt',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '01.03',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '01.03.003',
    ten_nhom: 'Máy CT 128 lát cắt trở lên',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '01.03',
    level: 3,
    is_leaf: true,
  },

  // ============================================================
  // NHÓM 2: THIẾT BỊ XÉT NGHIỆM
  // ============================================================
  {
    ma_nhom: '02',
    ten_nhom: 'Thiết bị xét nghiệm',
    phan_loai: null,
    don_vi_tinh: null,
    parent_id: null,
    level: 1,
    is_leaf: false,
  },
  {
    ma_nhom: '02.01',
    ten_nhom: 'Thiết bị xét nghiệm huyết học',
    phan_loai: 'B',
    don_vi_tinh: null,
    parent_id: '02',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '02.01.001',
    ten_nhom: 'Máy phân tích huyết học tự động',
    phan_loai: 'B',
    don_vi_tinh: 'Máy',
    parent_id: '02.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '02.01.002',
    ten_nhom: 'Máy đông máu tự động',
    phan_loai: 'B',
    don_vi_tinh: 'Máy',
    parent_id: '02.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '02.02',
    ten_nhom: 'Thiết bị xét nghiệm sinh hóa',
    phan_loai: 'B',
    don_vi_tinh: null,
    parent_id: '02',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '02.02.001',
    ten_nhom: 'Máy sinh hóa tự động',
    phan_loai: 'B',
    don_vi_tinh: 'Máy',
    parent_id: '02.02',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '02.02.002',
    ten_nhom: 'Máy điện giải đồ',
    phan_loai: 'B',
    don_vi_tinh: 'Máy',
    parent_id: '02.02',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '02.03',
    ten_nhom: 'Thiết bị xét nghiệm miễn dịch',
    phan_loai: 'B',
    don_vi_tinh: null,
    parent_id: '02',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '02.03.001',
    ten_nhom: 'Máy miễn dịch tự động',
    phan_loai: 'B',
    don_vi_tinh: 'Máy',
    parent_id: '02.03',
    level: 3,
    is_leaf: true,
  },

  // ============================================================
  // NHÓM 3: THIẾT BỊ HỒI SỨC CẤP CỨU
  // ============================================================
  {
    ma_nhom: '03',
    ten_nhom: 'Thiết bị hồi sức cấp cứu',
    phan_loai: null,
    don_vi_tinh: null,
    parent_id: null,
    level: 1,
    is_leaf: false,
  },
  {
    ma_nhom: '03.01',
    ten_nhom: 'Thiết bị hỗ trợ hô hấp',
    phan_loai: 'C',
    don_vi_tinh: null,
    parent_id: '03',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '03.01.001',
    ten_nhom: 'Máy thở xâm nhập',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '03.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '03.01.002',
    ten_nhom: 'Máy thở không xâm nhập (CPAP/BiPAP)',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '03.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '03.01.003',
    ten_nhom: 'Máy thở cao tần (HFO)',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '03.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '03.02',
    ten_nhom: 'Thiết bị theo dõi bệnh nhân',
    phan_loai: 'B',
    don_vi_tinh: null,
    parent_id: '03',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '03.02.001',
    ten_nhom: 'Monitor theo dõi bệnh nhân',
    phan_loai: 'B',
    don_vi_tinh: 'Máy',
    parent_id: '03.02',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '03.02.002',
    ten_nhom: 'Máy đo SpO2',
    phan_loai: 'B',
    don_vi_tinh: 'Máy',
    parent_id: '03.02',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '03.03',
    ten_nhom: 'Thiết bị cấp cứu tim mạch',
    phan_loai: 'C',
    don_vi_tinh: null,
    parent_id: '03',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '03.03.001',
    ten_nhom: 'Máy sốc điện (Defibrillator)',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '03.03',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '03.03.002',
    ten_nhom: 'Máy tạo nhịp tim tạm thời',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '03.03',
    level: 3,
    is_leaf: true,
  },

  // ============================================================
  // NHÓM 4: THIẾT BỊ PHẪU THUẬT
  // ============================================================
  {
    ma_nhom: '04',
    ten_nhom: 'Thiết bị phẫu thuật',
    phan_loai: null,
    don_vi_tinh: null,
    parent_id: null,
    level: 1,
    is_leaf: false,
  },
  {
    ma_nhom: '04.01',
    ten_nhom: 'Thiết bị phẫu thuật nội soi',
    phan_loai: 'C',
    don_vi_tinh: null,
    parent_id: '04',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '04.01.001',
    ten_nhom: 'Hệ thống nội soi ổ bụng',
    phan_loai: 'C',
    don_vi_tinh: 'Bộ',
    parent_id: '04.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '04.01.002',
    ten_nhom: 'Hệ thống nội soi khớp',
    phan_loai: 'C',
    don_vi_tinh: 'Bộ',
    parent_id: '04.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '04.02',
    ten_nhom: 'Thiết bị gây mê',
    phan_loai: 'C',
    don_vi_tinh: null,
    parent_id: '04',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '04.02.001',
    ten_nhom: 'Máy gây mê kèm thở',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '04.02',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '04.02.002',
    ten_nhom: 'Bơm tiêm điện',
    phan_loai: 'B',
    don_vi_tinh: 'Máy',
    parent_id: '04.02',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '04.02.003',
    ten_nhom: 'Bơm truyền dịch',
    phan_loai: 'B',
    don_vi_tinh: 'Máy',
    parent_id: '04.02',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '04.03',
    ten_nhom: 'Thiết bị cắt đốt',
    phan_loai: 'C',
    don_vi_tinh: null,
    parent_id: '04',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '04.03.001',
    ten_nhom: 'Dao mổ điện cao tần',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '04.03',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '04.03.002',
    ten_nhom: 'Dao mổ siêu âm (Harmonic)',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '04.03',
    level: 3,
    is_leaf: true,
  },

  // ============================================================
  // NHÓM 5: THIẾT BỊ ĐIỀU TRỊ
  // ============================================================
  {
    ma_nhom: '05',
    ten_nhom: 'Thiết bị điều trị',
    phan_loai: null,
    don_vi_tinh: null,
    parent_id: null,
    level: 1,
    is_leaf: false,
  },
  {
    ma_nhom: '05.01',
    ten_nhom: 'Thiết bị vật lý trị liệu',
    phan_loai: 'A',
    don_vi_tinh: null,
    parent_id: '05',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '05.01.001',
    ten_nhom: 'Máy điện xung',
    phan_loai: 'A',
    don_vi_tinh: 'Máy',
    parent_id: '05.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '05.01.002',
    ten_nhom: 'Máy sóng ngắn',
    phan_loai: 'A',
    don_vi_tinh: 'Máy',
    parent_id: '05.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '05.01.003',
    ten_nhom: 'Máy siêu âm trị liệu',
    phan_loai: 'A',
    don_vi_tinh: 'Máy',
    parent_id: '05.01',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '05.02',
    ten_nhom: 'Thiết bị lọc máu',
    phan_loai: 'C',
    don_vi_tinh: null,
    parent_id: '05',
    level: 2,
    is_leaf: false,
  },
  {
    ma_nhom: '05.02.001',
    ten_nhom: 'Máy chạy thận nhân tạo (Hemodialysis)',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '05.02',
    level: 3,
    is_leaf: true,
  },
  {
    ma_nhom: '05.02.002',
    ten_nhom: 'Máy lọc máu liên tục (CRRT)',
    phan_loai: 'C',
    don_vi_tinh: 'Máy',
    parent_id: '05.02',
    level: 3,
    is_leaf: true,
  },
]

async function generateSampleExcel() {
  const workbook = new ExcelJS.Workbook()

  // ============================================================
  // SHEET 1: Danh Mục Thiết Bị Y Tế (Full Hierarchy)
  // ============================================================
  const hierarchySheet = workbook.addWorksheet('Danh Mục Phân Cấp')

  // Headers
  const headers = [
    'Mã nhóm',
    'Tên nhóm thiết bị',
    'Phân loại\n(A/B/C/D)',
    'Đơn vị tính',
    'Mã nhóm cha',
    'Cấp',
    'Là nhóm lá\n(có thể gán định mức)',
  ]

  hierarchySheet.addRow(headers)

  // Style header
  const headerRow = hierarchySheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' }, // Blue-800
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  headerRow.height = 40

  // Add data
  SAMPLE_CATEGORIES.forEach(cat => {
    const row = hierarchySheet.addRow([
      cat.ma_nhom,
      cat.ten_nhom,
      cat.phan_loai || '',
      cat.don_vi_tinh || '',
      cat.parent_id || '',
      cat.level,
      cat.is_leaf ? 'Có' : 'Không',
    ])

    // Indent based on level
    const nameCell = row.getCell(2)
    const indent = '  '.repeat((cat.level - 1) * 2)
    nameCell.value = indent + cat.ten_nhom

    // Style leaf rows differently
    if (cat.is_leaf) {
      row.font = { color: { argb: 'FF166534' } } // Green-800
    } else {
      row.font = { bold: true }
    }

    // Alternate row colors
    if (cat.level === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }, // Blue-100
      }
    }
  })

  // Column widths
  hierarchySheet.columns = [
    { width: 15 },  // Mã nhóm
    { width: 45 },  // Tên nhóm
    { width: 12 },  // Phân loại
    { width: 12 },  // Đơn vị tính
    { width: 15 },  // Mã cha
    { width: 8 },   // Cấp
    { width: 18 },  // Là nhóm lá
  ]

  // Freeze header
  hierarchySheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

  // ============================================================
  // SHEET 2: Chỉ Nhóm Lá (Leaf Categories Only)
  // ============================================================
  const leafSheet = workbook.addWorksheet('Nhóm Lá (Dùng Cho Định Mức)')

  const leafHeaders = [
    'Mã nhóm',
    'Tên thiết bị',
    'Phân loại',
    'Đơn vị tính',
    'Đường dẫn (Parent > Child)',
  ]

  leafSheet.addRow(leafHeaders)

  // Style header
  const leafHeaderRow = leafSheet.getRow(1)
  leafHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  leafHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF059669' }, // Emerald-600
  }
  leafHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' }
  leafHeaderRow.height = 28

  // Add only leaf categories
  const leafCategories = SAMPLE_CATEGORIES.filter(c => c.is_leaf)

  // Build path lookup
  const categoryMap = new Map(SAMPLE_CATEGORIES.map(c => [c.ma_nhom, c]))

  leafCategories.forEach(cat => {
    // Build full path
    const pathParts: string[] = []
    let current = cat
    while (current) {
      pathParts.unshift(current.ten_nhom)
      current = current.parent_id ? categoryMap.get(current.parent_id)! : null!
    }

    leafSheet.addRow([
      cat.ma_nhom,
      cat.ten_nhom,
      cat.phan_loai || '',
      cat.don_vi_tinh || '',
      pathParts.join(' > '),
    ])
  })

  // Column widths
  leafSheet.columns = [
    { width: 15 },  // Mã nhóm
    { width: 40 },  // Tên thiết bị
    { width: 12 },  // Phân loại
    { width: 12 },  // Đơn vị tính
    { width: 60 },  // Đường dẫn
  ]

  // Freeze header
  leafSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

  // ============================================================
  // SHEET 3: Hướng Dẫn
  // ============================================================
  const guideSheet = workbook.addWorksheet('Hướng Dẫn')

  const guideContent = [
    ['HƯỚNG DẪN SỬ DỤNG DANH MỤC NHÓM THIẾT BỊ Y TẾ'],
    [''],
    ['1. CẤU TRÚC PHÂN CẤP'],
    ['   - Cấp 1: Nhóm lớn (VD: 01 - Thiết bị chẩn đoán hình ảnh)'],
    ['   - Cấp 2: Phân nhóm (VD: 01.01 - Thiết bị X-quang)'],
    ['   - Cấp 3: Chi tiết (VD: 01.01.001 - Máy X-quang kỹ thuật số)'],
    [''],
    ['2. PHÂN LOẠI THIẾT BỊ Y TẾ (Nghị định 98/2021/NĐ-CP)'],
    ['   - Loại A: Thiết bị có mức độ rủi ro thấp'],
    ['   - Loại B: Thiết bị có mức độ rủi ro trung bình thấp'],
    ['   - Loại C: Thiết bị có mức độ rủi ro trung bình cao'],
    ['   - Loại D: Thiết bị có mức độ rủi ro cao'],
    [''],
    ['3. QUY TẮC GÁN ĐỊNH MỨC'],
    ['   - CHỈ các nhóm lá (is_leaf = Có) mới được gán định mức'],
    ['   - Nhóm cha dùng để phân loại và tổng hợp báo cáo'],
    ['   - Xem sheet "Nhóm Lá (Dùng Cho Định Mức)" để lấy danh sách'],
    [''],
    ['4. CĂN CỨ PHÁP LÝ'],
    ['   - Thông tư 08/2019/TT-BYT: Danh mục trang thiết bị y tế'],
    ['   - Thông tư 46/2025/TT-BYT: Tiêu chuẩn định mức trang thiết bị'],
    ['   - Nghị định 98/2021/NĐ-CP: Phân loại trang thiết bị y tế'],
    [''],
    ['5. LƯU Ý KHI NHẬP DỮ LIỆU'],
    ['   - Mã nhóm phải đúng định dạng: XX.XX.XXX'],
    ['   - Không được thay đổi mã nhóm đã có trong hệ thống'],
    ['   - Liên hệ quản trị viên để bổ sung nhóm mới'],
  ]

  guideContent.forEach((row, index) => {
    const excelRow = guideSheet.addRow(row)
    if (index === 0) {
      excelRow.font = { bold: true, size: 16 }
      excelRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF59E0B' }, // Amber-500
      }
    } else if (row[0]?.match(/^\d\./)) {
      excelRow.font = { bold: true, size: 12 }
    }
  })

  guideSheet.getColumn(1).width = 80

  // ============================================================
  // SHEET 4: Mẫu Nhập Định Mức (Sample Import Data)
  // ============================================================
  const sampleImportSheet = workbook.addWorksheet('Mẫu Nhập Định Mức')

  const importHeaders = [
    'Mã nhóm thiết bị',
    'Tên thiết bị (tự điền)',
    'Số lượng định mức',
    'Số lượng tối thiểu',
    'Ghi chú',
  ]

  sampleImportSheet.addRow(importHeaders)

  // Style header
  const importHeaderRow = sampleImportSheet.getRow(1)
  importHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  importHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7C3AED' }, // Violet-600
  }
  importHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' }
  importHeaderRow.height = 28

  // Mark required columns
  ;[1, 3].forEach(colIndex => {
    const cell = sampleImportSheet.getCell(1, colIndex)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDC2626' }, // Red-600
    }
  })

  // Sample data rows
  const sampleData = [
    ['01.01.001', 'Máy X-quang kỹ thuật số (DR)', 2, 1, 'Theo Thông tư 46/2025'],
    ['01.02.001', 'Máy siêu âm 2D', 3, 2, ''],
    ['01.02.003', 'Máy siêu âm Doppler màu', 1, 1, 'Ưu tiên khoa Tim mạch'],
    ['03.01.001', 'Máy thở xâm nhập', 5, 3, 'ICU + Cấp cứu'],
    ['03.02.001', 'Monitor theo dõi bệnh nhân', 10, 5, ''],
    ['03.03.001', 'Máy sốc điện (Defibrillator)', 3, 2, 'Mỗi khoa 1 máy'],
    ['04.02.002', 'Bơm tiêm điện', 20, 10, ''],
    ['04.02.003', 'Bơm truyền dịch', 30, 15, ''],
    ['05.02.001', 'Máy chạy thận nhân tạo', 8, 5, 'Đơn vị thận nhân tạo'],
  ]

  sampleData.forEach(row => {
    sampleImportSheet.addRow(row)
  })

  // Column widths
  sampleImportSheet.columns = [
    { width: 20 },  // Mã nhóm
    { width: 40 },  // Tên thiết bị
    { width: 20 },  // Số lượng định mức
    { width: 20 },  // Số lượng tối thiểu
    { width: 30 },  // Ghi chú
  ]

  // Freeze header
  sampleImportSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

  // ============================================================
  // Save file
  // ============================================================
  const outputDir = path.join(__dirname, 'output')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, 'sample-nhom-thiet-bi.xlsx')
  await workbook.xlsx.writeFile(outputPath)

  console.log(`✅ Generated: ${outputPath}`)
  console.log(`   - Sheet 1: Danh Mục Phân Cấp (${SAMPLE_CATEGORIES.length} categories)`)
  console.log(`   - Sheet 2: Nhóm Lá (${leafCategories.length} leaf categories for quotas)`)
  console.log(`   - Sheet 3: Hướng Dẫn`)
  console.log(`   - Sheet 4: Mẫu Nhập Định Mức (${sampleData.length} sample rows)`)
}

generateSampleExcel().catch(console.error)
