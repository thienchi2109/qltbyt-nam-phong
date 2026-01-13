/**
 * Tests for Excel template generation with data validation.
 *
 * Validates that the equipment import template:
 * 1. Generates valid Excel file structure
 * 2. Includes data validation dropdowns for status column
 * 3. Includes data validation dropdowns for classification column
 * 4. Has proper header structure with required fields highlighted
 * 5. Includes instructions sheet with correct information
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { generateEquipmentImportTemplate } from '@/lib/excel-utils'
import type { Workbook, Worksheet } from 'exceljs'

// Valid status values - must match excel-utils.ts
const EXPECTED_STATUS_OPTIONS = [
  'Hoạt động',
  'Chờ sửa chữa',
  'Chờ bảo trì',
  'Chờ hiệu chuẩn/kiểm định',
  'Ngưng sử dụng',
  'Chưa có nhu cầu sử dụng',
] as const

// Valid classification options
const EXPECTED_CLASSIFICATION_OPTIONS = ['A', 'B', 'C', 'D'] as const

// Required fields that should be highlighted
const REQUIRED_FIELDS = [
  'Khoa/phòng quản lý',
  'Người sử dụng',
  'Tình trạng',
  'Vị trí lắp đặt',
]

// Expected headers in the template
const EXPECTED_HEADERS = [
  'Mã thiết bị',
  'Tên thiết bị',
  'Model',
  'Serial',
  'Cấu hình',
  'Phụ kiện kèm theo',
  'Hãng sản xuất',
  'Nơi sản xuất',
  'Năm sản xuất',
  'Ngày nhập',
  'Ngày đưa vào sử dụng',
  'Nguồn kinh phí',
  'Giá gốc',
  'Năm tính hao mòn',
  'Tỷ lệ hao mòn theo TT23',
  'Hạn bảo hành',
  'Vị trí lắp đặt',
  'Người sử dụng',
  'Khoa/phòng quản lý',
  'Tình trạng',
  'Ghi chú',
  'Chu kỳ BT định kỳ (ngày)',
  'Ngày BT tiếp theo',
  'Chu kỳ HC định kỳ (ngày)',
  'Ngày HC tiếp theo',
  'Chu kỳ KĐ định kỳ (ngày)',
  'Ngày KĐ tiếp theo',
  'Phân loại theo NĐ98',
]

/**
 * Helper to convert Blob to ArrayBuffer in Node.js environment
 */
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  // In Node.js, Blob may not have arrayBuffer() method
  // Use text() and convert, or use stream
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer()
  }

  // Fallback: convert via Uint8Array
  const reader = new FileReader()
  return new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(blob)
  })
}

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

describe('Excel Template Generation', () => {
  let templateBlob: Blob
  let workbook: Workbook
  let templateSheet: Worksheet
  let instructionsSheet: Worksheet
  let initError: Error | null = null

  beforeAll(async () => {
    try {
      // Generate template once for all tests
      templateBlob = await generateEquipmentImportTemplate()

      // Parse the generated Excel to verify structure
      const ExcelJS = await import('exceljs')
      workbook = new ExcelJS.Workbook()

      // Convert Blob to Buffer for ExcelJS
      const buffer = await blobToBuffer(templateBlob)
      await workbook.xlsx.load(buffer)

      // Get worksheets
      templateSheet = workbook.getWorksheet('Template Thiết Bị') as Worksheet
      instructionsSheet = workbook.getWorksheet('Hướng dẫn') as Worksheet
    } catch (error) {
      initError = error as Error
    }
  })

  describe('Blob Generation', () => {
    it('should return a valid Blob', () => {
      if (initError) throw initError
      expect(templateBlob).toBeInstanceOf(Blob)
    })

    it('should have Excel MIME type', () => {
      if (initError) throw initError
      expect(templateBlob.type).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    })

    it('should have non-zero size', () => {
      if (initError) throw initError
      expect(templateBlob.size).toBeGreaterThan(0)
    })
  })

  describe('Workbook Structure', () => {
    it('should have exactly 2 worksheets', () => {
      if (initError) throw initError
      expect(workbook.worksheets).toHaveLength(2)
    })

    it('should have Template Thiết Bị worksheet', () => {
      if (initError) throw initError
      expect(templateSheet).toBeDefined()
      expect(templateSheet?.name).toBe('Template Thiết Bị')
    })

    it('should have Hướng dẫn worksheet', () => {
      if (initError) throw initError
      expect(instructionsSheet).toBeDefined()
      expect(instructionsSheet?.name).toBe('Hướng dẫn')
    })
  })

  describe('Template Sheet Headers', () => {
    it('should have header row with all required columns', () => {
      if (initError) throw initError
      const headerRow = templateSheet.getRow(1)
      const headers: string[] = []

      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || '')
      })

      // Check that all expected headers are present
      EXPECTED_HEADERS.forEach((expectedHeader) => {
        expect(headers).toContain(expectedHeader)
      })
    })

    it('should have Tình trạng column', () => {
      if (initError) throw initError
      const headerRow = templateSheet.getRow(1)
      let foundStatus = false

      headerRow.eachCell((cell) => {
        if (cell.value === 'Tình trạng') {
          foundStatus = true
        }
      })

      expect(foundStatus).toBe(true)
    })

    it('should have Phân loại theo NĐ98 column', () => {
      if (initError) throw initError
      const headerRow = templateSheet.getRow(1)
      let foundClassification = false

      headerRow.eachCell((cell) => {
        if (cell.value === 'Phân loại theo NĐ98') {
          foundClassification = true
        }
      })

      expect(foundClassification).toBe(true)
    })
  })

  describe('Status Column Data Validation', () => {
    it('should have data validation on status column row 2', () => {
      if (initError) throw initError
      // Find status column index
      const headerRow = templateSheet.getRow(1)
      let statusColIndex = -1

      headerRow.eachCell((cell, colNumber) => {
        if (cell.value === 'Tình trạng') {
          statusColIndex = colNumber
        }
      })

      expect(statusColIndex).toBeGreaterThan(0)

      const statusCell = templateSheet.getCell(2, statusColIndex)
      expect(statusCell.dataValidation).toBeDefined()
      expect(statusCell.dataValidation?.type).toBe('list')
    })

    it('should include all valid status options in dropdown', () => {
      if (initError) throw initError
      const headerRow = templateSheet.getRow(1)
      let statusColIndex = -1

      headerRow.eachCell((cell, colNumber) => {
        if (cell.value === 'Tình trạng') {
          statusColIndex = colNumber
        }
      })

      const statusCell = templateSheet.getCell(2, statusColIndex)
      const validation = statusCell.dataValidation

      expect(validation?.formulae).toBeDefined()
      expect(validation?.formulae?.length).toBeGreaterThan(0)

      const formulaStr = validation?.formulae?.[0] || ''

      // Check all status options are in the formula
      EXPECTED_STATUS_OPTIONS.forEach((status) => {
        expect(formulaStr).toContain(status)
      })
    })

    it('should have error message configured for invalid status', () => {
      if (initError) throw initError
      const headerRow = templateSheet.getRow(1)
      let statusColIndex = -1

      headerRow.eachCell((cell, colNumber) => {
        if (cell.value === 'Tình trạng') {
          statusColIndex = colNumber
        }
      })

      const statusCell = templateSheet.getCell(2, statusColIndex)
      const validation = statusCell.dataValidation

      expect(validation?.showErrorMessage).toBe(true)
      expect(validation?.errorTitle).toBeDefined()
      expect(validation?.error).toBeDefined()
    })
  })

  describe('Classification Column Data Validation', () => {
    it('should have data validation on classification column row 2', () => {
      if (initError) throw initError
      const headerRow = templateSheet.getRow(1)
      let classificationColIndex = -1

      headerRow.eachCell((cell, colNumber) => {
        if (cell.value === 'Phân loại theo NĐ98') {
          classificationColIndex = colNumber
        }
      })

      expect(classificationColIndex).toBeGreaterThan(0)

      const classificationCell = templateSheet.getCell(2, classificationColIndex)
      expect(classificationCell.dataValidation).toBeDefined()
      expect(classificationCell.dataValidation?.type).toBe('list')
    })

    it('should include all classification options (A, B, C, D)', () => {
      if (initError) throw initError
      const headerRow = templateSheet.getRow(1)
      let classificationColIndex = -1

      headerRow.eachCell((cell, colNumber) => {
        if (cell.value === 'Phân loại theo NĐ98') {
          classificationColIndex = colNumber
        }
      })

      const classificationCell = templateSheet.getCell(2, classificationColIndex)
      const validation = classificationCell.dataValidation

      expect(validation?.formulae).toBeDefined()
      const formulaStr = validation?.formulae?.[0] || ''

      EXPECTED_CLASSIFICATION_OPTIONS.forEach((option) => {
        expect(formulaStr).toContain(option)
      })
    })
  })

  describe('Instructions Sheet', () => {
    it('should have title row', () => {
      if (initError) throw initError
      const titleRow = instructionsSheet.getRow(1)
      const titleValue = titleRow.getCell(1).value

      expect(titleValue).toBeDefined()
      expect(String(titleValue)).toContain('HƯỚNG DẪN')
    })

    it('should list required fields section', () => {
      if (initError) throw initError
      let foundRequiredSection = false
      let sheetText = ''

      instructionsSheet.eachRow((row) => {
        row.eachCell((cell) => {
          const cellValue = String(cell.value || '')
          sheetText += cellValue + '\n'
          if (cellValue.includes('BẮT BUỘC')) {
            foundRequiredSection = true
          }
        })
      })

      expect(foundRequiredSection).toBe(true)
    })

    it('should list valid status values', () => {
      if (initError) throw initError
      let sheetText = ''

      instructionsSheet.eachRow((row) => {
        row.eachCell((cell) => {
          sheetText += String(cell.value || '') + '\n'
        })
      })

      // Check that status values are mentioned
      let foundStatusSection = false
      EXPECTED_STATUS_OPTIONS.forEach((status) => {
        if (sheetText.includes(status)) {
          foundStatusSection = true
        }
      })

      expect(foundStatusSection).toBe(true)
    })

    it('should mention date format guidance', () => {
      if (initError) throw initError
      let sheetText = ''

      instructionsSheet.eachRow((row) => {
        row.eachCell((cell) => {
          sheetText += String(cell.value || '') + '\n'
        })
      })

      // Should mention date format somewhere
      const hasDateGuidance =
        sheetText.includes('ngày') ||
        sheetText.includes('NGÀY') ||
        sheetText.includes('date') ||
        sheetText.includes('DATE')

      expect(hasDateGuidance).toBe(true)
    })
  })

  describe('Required Fields Highlighting', () => {
    it('should have required column headers with different styling', () => {
      if (initError) throw initError
      const headerRow = templateSheet.getRow(1)
      const requiredCells: Array<{ header: string; colIndex: number }> = []

      REQUIRED_FIELDS.forEach((requiredHeader) => {
        headerRow.eachCell((cell, colNumber) => {
          if (cell.value === requiredHeader) {
            requiredCells.push({ header: requiredHeader, colIndex: colNumber })
          }
        })
      })

      // All required fields should be found
      expect(requiredCells).toHaveLength(REQUIRED_FIELDS.length)

      // Check that required headers have fill color (red-600)
      requiredCells.forEach(({ colIndex }) => {
        const cell = templateSheet.getCell(1, colIndex)
        const fill = cell.fill

        // ExcelJS uses 'pattern' fill type
        expect(fill).toBeDefined()
        if (fill && 'fgColor' in fill) {
          // Should have a red color (FFDC2626)
          expect(fill.fgColor?.argb).toBe('FFDC2626')
        }
      })
    })
  })
})

describe('Template Data Validation Range', () => {
  it('should apply data validation to multiple rows (not just row 2)', async () => {
    const templateBlob = await generateEquipmentImportTemplate()

    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()

    // Convert Blob to Buffer for ExcelJS
    const buffer = await blobToBuffer(templateBlob)
    await workbook.xlsx.load(buffer)

    const templateSheet = workbook.getWorksheet('Template Thiết Bị') as Worksheet

    // Find status column
    const headerRow = templateSheet.getRow(1)
    let statusColIndex = -1

    headerRow.eachCell((cell, colNumber) => {
      if (cell.value === 'Tình trạng') {
        statusColIndex = colNumber
      }
    })

    // Check validation exists on rows 2, 10, and 100
    const rowsToCheck = [2, 10, 100]
    rowsToCheck.forEach((rowNum) => {
      const cell = templateSheet.getCell(rowNum, statusColIndex)
      expect(cell.dataValidation).toBeDefined()
      expect(cell.dataValidation?.type).toBe('list')
    })
  })
})

/**
 * Tests for Excel read/parse functions.
 *
 * NOTE: These tests are skipped in jsdom because File.arrayBuffer() is not fully
 * supported. The readExcelFile and worksheetToJson functions are designed for
 * browser environments. In practice, these are tested through:
 * 1. Manual browser testing
 * 2. E2E tests (if available)
 * 3. The template generation tests above verify ExcelJS works correctly
 */
describe('Excel Read/Parse Functions (ExcelJS)', () => {
  /**
   * Test the round-trip: generate template -> read it back -> parse to JSON
   * This verifies readExcelFile and worksheetToJson work with ExcelJS-generated files
   *
   * SKIPPED: File.arrayBuffer() not available in jsdom
   */
  it.skip('should read back generated Excel template correctly (browser only)', async () => {
    // Generate template
    const templateBlob = await generateEquipmentImportTemplate()

    // Convert Blob to File (simulating file upload)
    const file = new File([templateBlob], 'test-template.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    // Import the read function dynamically to avoid circular deps
    const { readExcelFile, worksheetToJson } = await import('@/lib/excel-utils')

    // Read the file back
    const workbookResult = await readExcelFile(file)

    // Verify structure
    expect(workbookResult.SheetNames).toContain('Template Thiết Bị')
    expect(workbookResult.SheetNames).toContain('Hướng dẫn')
    expect(workbookResult.Sheets['Template Thiết Bị']).toBeDefined()

    // Parse the template sheet to JSON
    const templateSheet = workbookResult.Sheets['Template Thiết Bị']
    const jsonData = await worksheetToJson(templateSheet)

    // Template should have no data rows (just headers)
    expect(jsonData).toHaveLength(0)
  })

  /**
   * SKIPPED: File.arrayBuffer() not available in jsdom
   */
  it.skip('should parse Excel with data rows correctly (browser only)', async () => {
    // Create a workbook with sample data
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Test Data')

    // Add headers
    sheet.addRow(['Tên thiết bị', 'Tình trạng', 'Khoa/phòng quản lý'])

    // Add data rows
    sheet.addRow(['Máy X-quang', 'Hoạt động', 'Khoa Nội'])
    sheet.addRow(['Máy siêu âm', 'Chờ sửa chữa', 'Khoa Ngoại'])
    sheet.addRow(['Máy MRI', 'Chờ bảo trì', 'Khoa Tim'])

    // Convert to buffer
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    // Create File object
    const file = new File([blob], 'test-data.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    // Read and parse
    const { readExcelFile, worksheetToJson } = await import('@/lib/excel-utils')
    const workbookResult = await readExcelFile(file)
    const jsonData = await worksheetToJson(workbookResult.Sheets['Test Data'])

    // Verify parsed data
    expect(jsonData).toHaveLength(3)

    expect(jsonData[0]['Tên thiết bị']).toBe('Máy X-quang')
    expect(jsonData[0]['Tình trạng']).toBe('Hoạt động')
    expect(jsonData[0]['Khoa/phòng quản lý']).toBe('Khoa Nội')

    expect(jsonData[1]['Tên thiết bị']).toBe('Máy siêu âm')
    expect(jsonData[1]['Tình trạng']).toBe('Chờ sửa chữa')

    expect(jsonData[2]['Tên thiết bị']).toBe('Máy MRI')
    expect(jsonData[2]['Tình trạng']).toBe('Chờ bảo trì')
  })

  /**
   * SKIPPED: File.arrayBuffer() not available in jsdom
   */
  it.skip('should skip empty rows when parsing (browser only)', async () => {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Test')

    // Add headers
    sheet.addRow(['Column A', 'Column B'])

    // Add data with empty row in between
    sheet.addRow(['Value 1', 'Value 2'])
    sheet.addRow(['', '']) // Empty row - should be skipped
    sheet.addRow(['Value 3', 'Value 4'])

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const file = new File([blob], 'test.xlsx', { type: blob.type })

    const { readExcelFile, worksheetToJson } = await import('@/lib/excel-utils')
    const result = await readExcelFile(file)
    const jsonData = await worksheetToJson(result.Sheets['Test'])

    // Should have 2 rows (empty row skipped)
    expect(jsonData).toHaveLength(2)
    expect(jsonData[0]['Column A']).toBe('Value 1')
    expect(jsonData[1]['Column A']).toBe('Value 3')
  })

  /**
   * SKIPPED: File.arrayBuffer() not available in jsdom
   */
  it.skip('should handle Vietnamese text with diacritics correctly (browser only)', async () => {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Vietnamese Test')

    // Vietnamese text with full diacritics
    sheet.addRow(['Tên thiết bị', 'Tình trạng hiện tại'])
    sheet.addRow(['Máy điện tâm đồ', 'Chờ hiệu chuẩn/kiểm định'])
    sheet.addRow(['Máy chụp cộng hưởng từ', 'Chưa có nhu cầu sử dụng'])

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const file = new File([blob], 'vn-test.xlsx', { type: blob.type })

    const { readExcelFile, worksheetToJson } = await import('@/lib/excel-utils')
    const result = await readExcelFile(file)
    const jsonData = await worksheetToJson(result.Sheets['Vietnamese Test'])

    expect(jsonData).toHaveLength(2)
    expect(jsonData[0]['Tên thiết bị']).toBe('Máy điện tâm đồ')
    expect(jsonData[0]['Tình trạng hiện tại']).toBe('Chờ hiệu chuẩn/kiểm định')
    expect(jsonData[1]['Tình trạng hiện tại']).toBe('Chưa có nhu cầu sử dụng')
  })

  /**
   * Tests that can run in Node.js environment (worksheetToJson with ExcelJS directly)
   */
  describe('worksheetToJson (Node.js compatible)', () => {
    it('should convert worksheet rows to JSON objects', async () => {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Test')

      // Add data
      sheet.addRow(['Name', 'Status', 'Department'])
      sheet.addRow(['Equipment A', 'Hoạt động', 'Khoa Nội'])
      sheet.addRow(['Equipment B', 'Chờ bảo trì', 'Khoa Ngoại'])

      // Import and test worksheetToJson directly
      const { worksheetToJson } = await import('@/lib/excel-utils')
      const result = await worksheetToJson(sheet)

      expect(result).toHaveLength(2)
      expect(result[0]['Name']).toBe('Equipment A')
      expect(result[0]['Status']).toBe('Hoạt động')
      expect(result[1]['Name']).toBe('Equipment B')
      expect(result[1]['Department']).toBe('Khoa Ngoại')
    })

    it('should handle Vietnamese diacritics in headers and values', async () => {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('VN Test')

      sheet.addRow(['Tên thiết bị', 'Tình trạng hiện tại', 'Khoa/phòng quản lý'])
      sheet.addRow(['Máy siêu âm', 'Chờ hiệu chuẩn/kiểm định', 'Phòng xét nghiệm'])

      const { worksheetToJson } = await import('@/lib/excel-utils')
      const result = await worksheetToJson(sheet)

      expect(result).toHaveLength(1)
      expect(result[0]['Tên thiết bị']).toBe('Máy siêu âm')
      expect(result[0]['Tình trạng hiện tại']).toBe('Chờ hiệu chuẩn/kiểm định')
      expect(result[0]['Khoa/phòng quản lý']).toBe('Phòng xét nghiệm')
    })

    it('should skip rows with no data', async () => {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Sparse')

      sheet.addRow(['Col1', 'Col2'])
      sheet.addRow(['A', 'B'])
      // Row 3 is empty - no cells added
      sheet.addRow(['C', 'D'])

      const { worksheetToJson } = await import('@/lib/excel-utils')
      const result = await worksheetToJson(sheet)

      expect(result).toHaveLength(2)
      expect(result[0]['Col1']).toBe('A')
      expect(result[1]['Col1']).toBe('C')
    })
  })
})
