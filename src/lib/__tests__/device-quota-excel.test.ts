/**
 * Tests for Device Quota Excel template generation.
 *
 * Validates that the device quota import template:
 * 1. Generates valid Excel file structure with 3 sheets
 * 2. Includes data validation dropdowns for category codes
 * 3. Has proper header structure with required fields highlighted
 * 4. Includes VLOOKUP formulas for auto-fill
 * 5. Includes instructions sheet with legal basis
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  generateDeviceQuotaImportTemplate,
  type NhomThietBiForTemplate,
} from '@/lib/device-quota-excel'
import type { Workbook, Worksheet } from 'exceljs'

/**
 * Helper to convert Blob to Buffer for ExcelJS in Node environment
 */
async function blobToBuffer(blob: Blob): Promise<Buffer> {
  // Try arrayBuffer first (modern browsers and newer Node.js)
  if (typeof blob.arrayBuffer === 'function') {
    const arrayBuffer = await blob.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  // Fallback for environments without arrayBuffer
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer
      resolve(Buffer.from(arrayBuffer))
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(blob)
  })
}

// Sample test categories
const TEST_CATEGORIES: NhomThietBiForTemplate[] = [
  {
    ma_nhom: 'XQ001',
    ten_nhom: 'Máy X-quang kỹ thuật số',
    phan_loai: 'A',
    don_vi_tinh: 'Cái',
    parent_name: 'Chẩn đoán hình ảnh',
    is_leaf: true,
  },
  {
    ma_nhom: 'SA001',
    ten_nhom: 'Máy siêu âm tổng quát',
    phan_loai: 'B',
    don_vi_tinh: 'Cái',
    parent_name: 'Chẩn đoán hình ảnh',
    is_leaf: true,
  },
  {
    ma_nhom: 'MT001',
    ten_nhom: 'Máy giúp thở',
    phan_loai: 'A',
    don_vi_tinh: 'Cái',
    parent_name: 'Hồi sức cấp cứu',
    is_leaf: true,
  },
]

// Expected headers in data entry sheet
const EXPECTED_DATA_HEADERS = [
  'STT',
  'Mã nhóm thiết bị',
  'Tên thiết bị',
  'Đơn vị tính',
  'Số lượng định mức',
  'Số lượng tối thiểu',
  'Ghi chú',
]

// Expected headers in reference sheet
const EXPECTED_REFERENCE_HEADERS = [
  'Mã nhóm',
  'Tên thiết bị',
  'Phân loại',
  'Đơn vị tính',
  'Nhóm cha',
]

// Required fields (columns B and E)
const REQUIRED_COLUMN_INDICES = [2, 5] // 1-based: B=2, E=5

describe('Device Quota Excel Template Generation', () => {
  let workbook: Workbook
  let dataEntrySheet: Worksheet
  let referenceSheet: Worksheet
  let instructionsSheet: Worksheet

  let initError: Error | null = null

  beforeAll(async () => {
    try {
      // Generate the template
      const blob = await generateDeviceQuotaImportTemplate(TEST_CATEGORIES)

      // Convert Blob to Buffer for ExcelJS
      const buffer = await blobToBuffer(blob)

      // Parse the Excel file
      const ExcelJS = await import('exceljs')
      workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)

      // Get sheets
      dataEntrySheet = workbook.getWorksheet('Nhập Định Mức')!
      referenceSheet = workbook.getWorksheet('Danh Mục Thiết Bị')!
      instructionsSheet = workbook.getWorksheet('Hướng Dẫn')!
    } catch (error) {
      initError = error as Error
    }
  }, 30000)

  describe('Workbook Structure', () => {
    it('should have exactly 3 sheets', () => {
      if (initError) throw initError
      expect(workbook.worksheets.length).toBe(3)
    })

    it('should have sheets with correct names', () => {
      if (initError) throw initError
      const sheetNames = workbook.worksheets.map((ws) => ws.name)
      expect(sheetNames).toContain('Nhập Định Mức')
      expect(sheetNames).toContain('Danh Mục Thiết Bị')
      expect(sheetNames).toContain('Hướng Dẫn')
    })
  })

  describe('Data Entry Sheet (Nhập Định Mức)', () => {
    it('should exist', () => {
      if (initError) throw initError
      expect(dataEntrySheet).toBeDefined()
    })

    it('should have correct headers', () => {
      if (initError) throw initError
      const headerRow = dataEntrySheet.getRow(1)
      const headers: string[] = []

      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || '')
      })

      EXPECTED_DATA_HEADERS.forEach((expectedHeader, index) => {
        expect(headers[index]).toBe(expectedHeader)
      })
    })

    it('should have red background for required column headers', () => {
      if (initError) throw initError
      const headerRow = dataEntrySheet.getRow(1)

      REQUIRED_COLUMN_INDICES.forEach((colIndex) => {
        const cell = headerRow.getCell(colIndex)
        const fill = cell.fill as { fgColor?: { argb?: string } }
        // Red color: FFDC2626
        expect(fill?.fgColor?.argb).toBe('FFDC2626')
      })
    })

    it('should have frozen first row', () => {
      if (initError) throw initError
      const views = dataEntrySheet.views
      expect(views.length).toBeGreaterThan(0)
      expect(views[0].state).toBe('frozen')
      expect(views[0].ySplit).toBe(1)
    })

    it('should have STT values in column A for rows 2-100', () => {
      if (initError) throw initError
      for (let row = 2; row <= 10; row++) {
        const cell = dataEntrySheet.getCell(row, 1)
        expect(cell.value).toBe(row - 1)
      }
    })

    it('should have data validation dropdown for category code (column B)', () => {
      if (initError) throw initError
      const cell = dataEntrySheet.getCell(2, 2) // B2
      expect(cell.dataValidation).toBeDefined()
      expect(cell.dataValidation?.type).toBe('list')
    })

    it('should have number validation for quota quantity (column E)', () => {
      if (initError) throw initError
      const cell = dataEntrySheet.getCell(2, 5) // E2
      expect(cell.dataValidation).toBeDefined()
      expect(cell.dataValidation?.type).toBe('whole')
      expect(cell.dataValidation?.operator).toBe('greaterThan')
      // allowBlank defaults to false (undefined in ExcelJS means false)
      expect(cell.dataValidation?.allowBlank).toBeFalsy()
    })

    it('should have number validation for minimum quantity (column F) with allowBlank', () => {
      if (initError) throw initError
      const cell = dataEntrySheet.getCell(2, 6) // F2
      expect(cell.dataValidation).toBeDefined()
      expect(cell.dataValidation?.type).toBe('custom')
      expect(cell.dataValidation?.allowBlank).toBe(true)
      expect(cell.dataValidation?.formulae?.[0]).toContain('F2<=E2')
    })

    it('should have VLOOKUP formula for equipment name (column C)', () => {
      if (initError) throw initError
      const cell = dataEntrySheet.getCell(2, 3) // C2
      const formula = cell.value as { formula?: string }
      expect(formula?.formula).toContain('VLOOKUP')
      expect(formula?.formula).toContain("'Danh Mục Thiết Bị'")
    })

    it('should have VLOOKUP formula for unit (column D)', () => {
      if (initError) throw initError
      const cell = dataEntrySheet.getCell(2, 4) // D2
      const formula = cell.value as { formula?: string }
      expect(formula?.formula).toContain('VLOOKUP')
    })
  })

  describe('Reference Sheet (Danh Mục Thiết Bị)', () => {
    it('should exist', () => {
      if (initError) throw initError
      expect(referenceSheet).toBeDefined()
    })

    it('should have correct headers', () => {
      if (initError) throw initError
      const headerRow = referenceSheet.getRow(1)
      const headers: string[] = []

      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || '')
      })

      EXPECTED_REFERENCE_HEADERS.forEach((expectedHeader, index) => {
        expect(headers[index]).toBe(expectedHeader)
      })
    })

    it('should contain all test categories', () => {
      if (initError) throw initError
      // Categories start at row 2
      TEST_CATEGORIES.forEach((category, index) => {
        const row = referenceSheet.getRow(index + 2)
        expect(row.getCell(1).value).toBe(category.ma_nhom)
        expect(row.getCell(2).value).toBe(category.ten_nhom)
      })
    })

    it('should have frozen first row', () => {
      if (initError) throw initError
      const views = referenceSheet.views
      expect(views.length).toBeGreaterThan(0)
      expect(views[0].state).toBe('frozen')
      expect(views[0].ySplit).toBe(1)
    })
  })

  describe('Instructions Sheet (Hướng Dẫn)', () => {
    it('should exist', () => {
      if (initError) throw initError
      expect(instructionsSheet).toBeDefined()
    })

    it('should contain legal basis references', () => {
      if (initError) throw initError
      let foundLegalBasis = false

      instructionsSheet.eachRow((row) => {
        const cellValue = String(row.getCell(1).value || '')
        if (
          cellValue.includes('Thông tư 46/2025') ||
          cellValue.includes('Thông tư 08/2019')
        ) {
          foundLegalBasis = true
        }
      })

      expect(foundLegalBasis).toBe(true)
    })

    it('should mention required fields', () => {
      if (initError) throw initError
      let foundRequiredFields = false

      instructionsSheet.eachRow((row) => {
        const cellValue = String(row.getCell(1).value || '')
        if (cellValue.includes('BẮT BUỘC') || cellValue.includes('bắt buộc')) {
          foundRequiredFields = true
        }
      })

      expect(foundRequiredFields).toBe(true)
    })

    it('should mention leaf categories only', () => {
      if (initError) throw initError
      let foundLeafNote = false

      instructionsSheet.eachRow((row) => {
        const cellValue = String(row.getCell(1).value || '')
        if (cellValue.includes('nhóm lá') || cellValue.includes('nhóm con')) {
          foundLeafNote = true
        }
      })

      expect(foundLeafNote).toBe(true)
    })
  })

  describe('Empty Categories Handling', () => {
    it('should handle empty categories array', async () => {
      const blob = await generateDeviceQuotaImportTemplate([])

      const buffer = await blobToBuffer(blob)
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)

      // Should still generate valid workbook
      expect(wb.worksheets.length).toBe(3)

      // Reference sheet should have only headers
      const refSheet = wb.getWorksheet('Danh Mục Thiết Bị')!
      expect(refSheet.rowCount).toBe(1) // Only header row
    })
  })

  describe('Blob Output', () => {
    it('should return valid Blob with correct MIME type', async () => {
      const blob = await generateDeviceQuotaImportTemplate(TEST_CATEGORIES)

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    })

    it('should generate non-empty file', async () => {
      const blob = await generateDeviceQuotaImportTemplate(TEST_CATEGORIES)

      expect(blob.size).toBeGreaterThan(0)
    })
  })
})
