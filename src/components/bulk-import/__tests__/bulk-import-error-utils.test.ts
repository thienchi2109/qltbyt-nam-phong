/**
 * Tests for bulk-import-error-utils.ts
 *
 * Validates:
 * 1. translateBulkImportError - PostgreSQL error translation to Vietnamese
 * 2. formatImportResultErrors - Error formatting with line numbers
 * 3. buildImportToastMessage - Toast message generation for import results
 */

import { describe, it, expect } from 'vitest'
import {
  translateBulkImportError,
  formatImportResultErrors,
  buildImportToastMessage,
} from '../bulk-import-error-utils'
import type { BulkImportDetailItem } from '../bulk-import-types'

describe('translateBulkImportError', () => {
  describe('Empty/null inputs', () => {
    it('should return default message for empty string', () => {
      expect(translateBulkImportError('')).toBe('Loi khong xac dinh')
    })

    it('should return default message for undefined-like inputs', () => {
      // Empty string is falsy, should return default
      expect(translateBulkImportError('')).toBe('Loi khong xac dinh')
    })
  })

  describe('Duplicate key errors', () => {
    it('should translate duplicate ma_thiet_bi error', () => {
      const error = 'duplicate key value violates unique constraint on ma_thiet_bi'
      expect(translateBulkImportError(error)).toBe('Ma thiet bi da ton tai (trung lap)')
    })

    it('should translate generic duplicate key error', () => {
      const error = 'duplicate key value violates unique constraint'
      expect(translateBulkImportError(error)).toBe('Du lieu trung lap')
    })

    it('should translate already exists error', () => {
      const error = 'record already exists in table'
      expect(translateBulkImportError(error)).toBe('Du lieu trung lap')
    })
  })

  describe('Category errors', () => {
    it('should translate Category not found error', () => {
      expect(translateBulkImportError('Category not found: ABC'))
        .toBe('Khong tim thay ma nhom trong danh muc')
    })

    it('should translate nhom_thiet_bi error', () => {
      expect(translateBulkImportError('Foreign key error on nhom_thiet_bi'))
        .toBe('Khong tim thay ma nhom trong danh muc')
    })

    it('should translate parent category error', () => {
      expect(translateBulkImportError('Category is a parent category, cannot use'))
        .toBe('Ma nhom la nhom cha, chi duoc nhap nhom la (nhom khong co nhom con)')
    })

    it('should translate Vietnamese parent category error', () => {
      expect(translateBulkImportError('Ma nhom la nhom cha'))
        .toBe('Ma nhom la nhom cha, chi duoc nhap nhom la (nhom khong co nhom con)')
    })
  })

  describe('Quantity validation errors', () => {
    it('should translate must be greater than 0 error', () => {
      expect(translateBulkImportError('Value must be greater than 0'))
        .toBe('So luong phai lon hon 0')
    })

    it('should translate Vietnamese greater than 0 error', () => {
      expect(translateBulkImportError('So luong phai lon hon 0'))
        .toBe('So luong phai lon hon 0')
    })

    it('should translate must be greater than or equal to 0 error', () => {
      expect(translateBulkImportError('minimum must be greater than or equal to 0'))
        .toBe('So luong phai >= 0')
    })

    it('should translate minimum exceeds quota error', () => {
      expect(translateBulkImportError('minimum quantity cannot exceed quota'))
        .toBe('So luong toi thieu khong duoc lon hon so luong dinh muc')
    })
  })

  describe('Permission errors', () => {
    it('should translate permission denied error (lowercase)', () => {
      expect(translateBulkImportError('permission denied for table'))
        .toBe('Khong co quyen thuc hien')
    })

    it('should translate Permission Denied error (mixed case)', () => {
      expect(translateBulkImportError('Permission Denied: insufficient privileges'))
        .toBe('Khong co quyen thuc hien')
    })
  })

  describe('Decision status errors', () => {
    it('should translate draft-only import error', () => {
      expect(translateBulkImportError('can only import for draft decisions'))
        .toBe('Chi duoc nhap cho quyet dinh o trang thai nhap')
    })
  })

  describe('Null value errors', () => {
    it('should translate null value error with field name', () => {
      const error = 'null value in column "ma_nhom" violates not-null constraint'
      expect(translateBulkImportError(error)).toBe('Thieu gia tri bat buoc: ma_nhom')
    })

    it('should handle null value error without field match', () => {
      const error = 'null value in column violates constraint'
      expect(translateBulkImportError(error)).toBe('Thieu gia tri bat buoc: khong xac dinh')
    })
  })

  describe('Data type errors', () => {
    it('should translate invalid integer syntax error', () => {
      expect(translateBulkImportError('invalid input syntax for type integer'))
        .toBe('Dinh dang so khong hop le')
    })

    it('should translate invalid date syntax error', () => {
      expect(translateBulkImportError('invalid input syntax for type date'))
        .toBe('Dinh dang ngay khong hop le (dung DD/MM/YYYY)')
    })

    it('should translate invalid numeric syntax error', () => {
      expect(translateBulkImportError('invalid input syntax for type numeric'))
        .toBe('Dinh dang so thap phan khong hop le')
    })

    it('should translate generic invalid input syntax error', () => {
      expect(translateBulkImportError('invalid input syntax for type boolean'))
        .toBe('Dinh dang du lieu khong hop le')
    })
  })

  describe('Constraint errors', () => {
    it('should translate check constraint violation', () => {
      expect(translateBulkImportError('violates check constraint "positive_quantity"'))
        .toBe('Gia tri khong hop le theo rang buoc')
    })

    it('should translate foreign key constraint violation', () => {
      expect(translateBulkImportError('violates foreign key constraint'))
        .toBe('Tham chieu khong hop le')
    })
  })

  describe('Unknown errors', () => {
    it('should return original error if no translation found', () => {
      const error = 'Some unknown database error'
      expect(translateBulkImportError(error)).toBe('Some unknown database error')
    })

    it('should truncate long errors to 80 characters', () => {
      const longError = 'A'.repeat(100)
      const result = translateBulkImportError(longError)
      expect(result).toBe('A'.repeat(80) + '...')
    })

    it('should not truncate errors at exactly 80 characters', () => {
      const error = 'A'.repeat(80)
      expect(translateBulkImportError(error)).toBe(error)
    })
  })
})

describe('formatImportResultErrors', () => {
  const makeDetail = (index: number, success: boolean, error?: string): BulkImportDetailItem => ({
    index,
    success,
    error,
  })

  describe('Empty results', () => {
    it('should return empty string for empty array', () => {
      expect(formatImportResultErrors([])).toBe('')
    })

    it('should return empty string when all items succeeded', () => {
      const details = [
        makeDetail(0, true),
        makeDetail(1, true),
      ]
      expect(formatImportResultErrors(details)).toBe('')
    })

    it('should return empty string when failed items have no error message', () => {
      const details = [
        makeDetail(0, false),
        makeDetail(1, false, undefined),
      ]
      expect(formatImportResultErrors(details)).toBe('')
    })
  })

  describe('Error formatting', () => {
    it('should format single error with correct line number (Excel row = index + 2)', () => {
      const details = [makeDetail(0, false, 'duplicate key')]
      const result = formatImportResultErrors(details)
      expect(result).toBe('Dong 2: Du lieu trung lap')
    })

    it('should format multiple errors', () => {
      const details = [
        makeDetail(0, false, 'duplicate key'),
        makeDetail(2, false, 'permission denied'),
      ]
      const result = formatImportResultErrors(details)
      expect(result).toContain('Dong 2: Du lieu trung lap')
      expect(result).toContain('Dong 4: Khong co quyen thuc hien')
    })

    it('should skip successful items', () => {
      const details = [
        makeDetail(0, true),
        makeDetail(1, false, 'duplicate key'),
        makeDetail(2, true),
      ]
      const result = formatImportResultErrors(details)
      expect(result).toBe('Dong 3: Du lieu trung lap')
    })
  })

  describe('Max errors limit', () => {
    it('should limit to 5 errors by default', () => {
      const details = Array.from({ length: 10 }, (_, i) =>
        makeDetail(i, false, 'duplicate key')
      )
      const result = formatImportResultErrors(details)

      // Should have 5 error lines + "...va 5 loi khac"
      const lines = result.split('\n')
      expect(lines.length).toBe(6)
      expect(lines[5]).toBe('...va 5 loi khac')
    })

    it('should respect custom maxErrors parameter', () => {
      const details = Array.from({ length: 10 }, (_, i) =>
        makeDetail(i, false, 'duplicate key')
      )
      const result = formatImportResultErrors(details, 3)

      const lines = result.split('\n')
      expect(lines.length).toBe(4)
      expect(lines[3]).toBe('...va 7 loi khac')
    })

    it('should not show "more errors" message when errors equal maxErrors', () => {
      const details = Array.from({ length: 5 }, (_, i) =>
        makeDetail(i, false, 'duplicate key')
      )
      const result = formatImportResultErrors(details, 5)
      expect(result).not.toContain('loi khac')
    })
  })
})

describe('buildImportToastMessage', () => {
  describe('Success case (no failures)', () => {
    it('should return success variant for insert only', () => {
      const result = buildImportToastMessage({
        inserted: 10,
        failed: 0,
        total: 10,
      })

      expect(result.variant).toBe('default')
      expect(result.title).toBe('Thanh cong')
      expect(result.description).toContain('Da nhap 10 moi')
    })

    it('should include update count when provided', () => {
      const result = buildImportToastMessage({
        inserted: 5,
        updated: 3,
        failed: 0,
        total: 8,
      })

      expect(result.description).toContain('Da nhap 5 moi')
      expect(result.description).toContain('cap nhat 3')
    })

    it('should use custom entity name', () => {
      const result = buildImportToastMessage({
        inserted: 10,
        failed: 0,
        total: 10,
        entityName: 'danh muc',
      })

      expect(result.description).toContain('danh muc')
    })
  })

  describe('Partial failure with details', () => {
    it('should return destructive variant with error details', () => {
      const details: BulkImportDetailItem[] = [
        { index: 0, success: true },
        { index: 1, success: false, error: 'duplicate key' },
      ]

      const result = buildImportToastMessage({
        inserted: 1,
        failed: 1,
        total: 2,
        details,
      })

      expect(result.variant).toBe('destructive')
      expect(result.title).toContain('1 loi')
      expect(result.description).toContain('Chi tiet loi')
      expect(result.duration).toBe(10000)
    })
  })

  describe('Partial failure without details', () => {
    it('should return destructive variant without error details', () => {
      const result = buildImportToastMessage({
        inserted: 8,
        failed: 2,
        total: 10,
        details: [], // No details provided
      })

      expect(result.variant).toBe('destructive')
      expect(result.title).toBe('Nhap hoan tat voi mot so loi')
      expect(result.description).toContain('Da nhap 8/10')
      expect(result.description).toContain('2 ban ghi loi')
    })
  })

  describe('Default values', () => {
    it('should default updated to 0', () => {
      const result = buildImportToastMessage({
        inserted: 10,
        failed: 0,
        total: 10,
      })

      // Should not mention update when updated is 0
      expect(result.description).not.toContain('cap nhat')
    })

    it('should default entityName to "ban ghi"', () => {
      const result = buildImportToastMessage({
        inserted: 10,
        failed: 0,
        total: 10,
      })

      expect(result.description).toContain('ban ghi')
    })
  })
})
