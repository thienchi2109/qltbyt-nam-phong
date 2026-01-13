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
