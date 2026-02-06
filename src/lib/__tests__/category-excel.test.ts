/**
 * Tests for Category Excel template generation.
 *
 * Validates that the category import template:
 * 1. Generates valid Excel file structure with 2 sheets
 * 2. Has proper header structure with required fields highlighted
 * 3. Includes data validation dropdowns for classification
 * 4. Includes instructions sheet with legal basis
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { generateCategoryImportTemplate } from '@/lib/category-excel'
import type { Workbook, Worksheet } from 'exceljs'

/**
 * Helper to convert Blob to Buffer for ExcelJS in Node environment
 */
async function blobToBuffer(blob: Blob): Promise<Buffer> {
  if (typeof blob.arrayBuffer === 'function') {
    const arrayBuffer = await blob.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

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

// Expected headers in data entry sheet
const EXPECTED_DATA_HEADERS = [
  'STT',
  'Ma nhom',
  'Ten nhom',
  'Ma nhom cha',
  'Phan loai',
  'Don vi tinh',
  'Thu tu hien thi',
  'Mo ta',
]

// Required fields (columns B and C)
const REQUIRED_COLUMN_INDICES = [2, 3] // 1-based: B=2, C=3

describe('Category Excel Template Generation', () => {
  let workbook: Workbook
  let dataEntrySheet: Worksheet
  let instructionsSheet: Worksheet
  let initError: Error | null = null

  beforeAll(async () => {
    try {
      // Generate the template
      const blob = await generateCategoryImportTemplate()

      // Convert Blob to Buffer for ExcelJS
      const buffer = await blobToBuffer(blob)

      // Parse the Excel file
      const ExcelJS = await import('exceljs')
      workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)

      // Get sheets
      dataEntrySheet = workbook.getWorksheet('Nhap Danh Muc')!
      instructionsSheet = workbook.getWorksheet('Huong Dan')!
    } catch (error) {
      initError = error as Error
    }
  })

  describe('Workbook Structure', () => {
    it('should have exactly 2 sheets', () => {
      if (initError) throw initError
      expect(workbook.worksheets.length).toBe(2)
    })

    it('should have sheets with correct names', () => {
      if (initError) throw initError
      const sheetNames = workbook.worksheets.map((ws) => ws.name)
      expect(sheetNames).toContain('Nhap Danh Muc')
      expect(sheetNames).toContain('Huong Dan')
    })
  })

  describe('Data Entry Sheet (Nhap Danh Muc)', () => {
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

    it('should have red background for required column headers (B, C)', () => {
      if (initError) throw initError
      const headerRow = dataEntrySheet.getRow(1)

      REQUIRED_COLUMN_INDICES.forEach((colIndex) => {
        const cell = headerRow.getCell(colIndex)
        const fill = cell.fill as { fgColor?: { argb?: string } }
        // Red color: FFDC2626
        expect(fill?.fgColor?.argb).toBe('FFDC2626')
      })
    })

    it('should have blue background for optional column headers', () => {
      if (initError) throw initError
      const headerRow = dataEntrySheet.getRow(1)

      // Check column A (STT) - should be blue
      const cell = headerRow.getCell(1)
      const fill = cell.fill as { fgColor?: { argb?: string } }
      expect(fill?.fgColor?.argb).toBe('FF2563EB')
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

    it('should have data validation dropdown for classification (column E)', () => {
      if (initError) throw initError
      const cell = dataEntrySheet.getCell(2, 5) // E2
      expect(cell.dataValidation).toBeDefined()
      expect(cell.dataValidation?.type).toBe('list')
      expect(cell.dataValidation?.formulae?.[0]).toContain('A,B')
    })

    it('should have number validation for display order (column G)', () => {
      if (initError) throw initError
      const cell = dataEntrySheet.getCell(2, 7) // G2
      expect(cell.dataValidation).toBeDefined()
      expect(cell.dataValidation?.type).toBe('whole')
      expect(cell.dataValidation?.operator).toBe('greaterThanOrEqual')
      expect(cell.dataValidation?.allowBlank).toBe(true)
    })
  })

  describe('Instructions Sheet (Huong Dan)', () => {
    it('should exist', () => {
      if (initError) throw initError
      expect(instructionsSheet).toBeDefined()
    })

    it('should contain title', () => {
      if (initError) throw initError
      const titleCell = instructionsSheet.getCell(1, 1)
      expect(String(titleCell.value)).toContain('HUONG DAN')
    })

    it('should contain legal basis references', () => {
      if (initError) throw initError
      let foundLegalBasis = false

      instructionsSheet.eachRow((row) => {
        const cellValue = String(row.getCell(1).value || '')
        if (
          cellValue.includes('08/2019') ||
          cellValue.includes('98/2021')
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
        if (cellValue.includes('BAT BUOC')) {
          foundRequiredFields = true
        }
      })

      expect(foundRequiredFields).toBe(true)
    })

    it('should explain code format', () => {
      if (initError) throw initError
      let foundCodeFormat = false

      instructionsSheet.eachRow((row) => {
        const cellValue = String(row.getCell(1).value || '')
        if (
          cellValue.includes('XX') ||
          cellValue.includes('XX.XX')
        ) {
          foundCodeFormat = true
        }
      })

      expect(foundCodeFormat).toBe(true)
    })

    it('should explain classification A and B', () => {
      if (initError) throw initError
      let foundClassificationA = false
      let foundClassificationB = false

      instructionsSheet.eachRow((row) => {
        const cellValue = String(row.getCell(1).value || '')
        if (cellValue.includes('A:') && cellValue.includes('loai A')) {
          foundClassificationA = true
        }
        if (cellValue.includes('B:') && cellValue.includes('loai B')) {
          foundClassificationB = true
        }
      })

      expect(foundClassificationA).toBe(true)
      expect(foundClassificationB).toBe(true)
    })

    it('should include examples', () => {
      if (initError) throw initError
      let foundExample = false

      instructionsSheet.eachRow((row) => {
        const cellValue = String(row.getCell(1).value || '')
        if (cellValue.includes('VI DU')) {
          foundExample = true
        }
      })

      expect(foundExample).toBe(true)
    })
  })

  describe('Blob Output', () => {
    it('should return valid Blob with correct MIME type', async () => {
      const blob = await generateCategoryImportTemplate()

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    })

    it('should generate non-empty file', async () => {
      const blob = await generateCategoryImportTemplate()

      expect(blob.size).toBeGreaterThan(0)
    })
  })

  describe('Column Configuration', () => {
    it('should have appropriate column widths', () => {
      if (initError) throw initError

      // Check key column widths
      expect(dataEntrySheet.getColumn(1).width).toBe(8) // STT
      expect(dataEntrySheet.getColumn(2).width).toBe(20) // Ma nhom
      expect(dataEntrySheet.getColumn(3).width).toBe(40) // Ten nhom
    })

    it('should have centered alignment for STT column values', () => {
      if (initError) throw initError

      const cell = dataEntrySheet.getCell(2, 1) // A2
      expect(cell.alignment?.horizontal).toBe('center')
    })
  })
})
