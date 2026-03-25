import { describe, expect, it } from 'vitest'

import {
  FULL_DATE_ERROR_MESSAGE,
  isValidFullDate,
  normalizeDateForImport,
  normalizeFullDateForForm,
  normalizeFullDateForImport,
} from '../date-utils'

describe('date-utils full-date helpers', () => {
  describe('isValidFullDate', () => {
    it('accepts supported full date formats', () => {
      expect(isValidFullDate('15/01/2025')).toBe(true)
      expect(isValidFullDate('15-01-2025')).toBe(true)
      expect(isValidFullDate('2025-01-15')).toBe(true)
    })

    it('rejects partial and parser-only inputs', () => {
      expect(isValidFullDate('2025')).toBe(false)
      expect(isValidFullDate('03/2025')).toBe(false)
      expect(isValidFullDate('2025/01/15')).toBe(false)
      expect(isValidFullDate('January 15, 2025')).toBe(false)
    })

    it('rejects invalid calendar dates', () => {
      expect(isValidFullDate('32/01/2025')).toBe(false)
      expect(isValidFullDate('00/01/2025')).toBe(false)
      expect(isValidFullDate('29/02/2025')).toBe(false)
      expect(isValidFullDate('31/04/2025')).toBe(false)
      expect(isValidFullDate('2025-13-01')).toBe(false)
    })
  })

  describe('normalizeFullDateForForm', () => {
    it('normalizes supported full date formats to ISO', () => {
      expect(normalizeFullDateForForm('15/01/2025')).toBe('2025-01-15')
      expect(normalizeFullDateForForm('15-01-2025')).toBe('2025-01-15')
      expect(normalizeFullDateForForm('2025-01-15')).toBe('2025-01-15')
    })

    it('returns null for empty values', () => {
      expect(normalizeFullDateForForm(undefined)).toBeNull()
      expect(normalizeFullDateForForm(null)).toBeNull()
      expect(normalizeFullDateForForm('   ')).toBeNull()
    })
  })

  describe('normalizeFullDateForImport', () => {
    it('normalizes supported string formats and Excel serial dates', () => {
      expect(normalizeFullDateForImport('15/01/2025')).toEqual({
        value: '2025-01-15',
        rejected: false,
      })
      expect(normalizeFullDateForImport('15-01-2025')).toEqual({
        value: '2025-01-15',
        rejected: false,
      })
      expect(normalizeFullDateForImport('2025-01-15')).toEqual({
        value: '2025-01-15',
        rejected: false,
      })
      expect(normalizeFullDateForImport(45672)).toEqual({
        value: '2025-01-15',
        rejected: false,
      })
    })

    it('normalizes Date objects returned by ExcelJS to ISO full dates', () => {
      expect(normalizeFullDateForImport(new Date('2025-01-15T00:00:00.000Z'))).toEqual({
        value: '2025-01-15',
        rejected: false,
      })
    })

    it('rejects partial, parser-only, and invalid calendar inputs', () => {
      expect(normalizeFullDateForImport('2025')).toEqual({ value: null, rejected: false })
      expect(normalizeFullDateForImport('03/2025')).toEqual({ value: null, rejected: false })
      expect(normalizeFullDateForImport('2025/01/15')).toEqual({ value: null, rejected: false })
      expect(normalizeFullDateForImport('January 15, 2025')).toEqual({ value: null, rejected: false })
      expect(normalizeFullDateForImport('29/02/2025')).toEqual({ value: null, rejected: false })
      expect(normalizeFullDateForImport('31/04/2025')).toEqual({ value: null, rejected: false })
    })

    it('marks suspicious Excel serials as rejected', () => {
      expect(normalizeFullDateForImport(1)).toEqual({ value: null, rejected: true })
    })
  })

  describe('normalizeDateForImport', () => {
    it('normalizes Date objects returned by ExcelJS to ISO dates', () => {
      expect(normalizeDateForImport(new Date('2025-01-15T00:00:00.000Z'))).toEqual({
        value: '2025-01-15',
        rejected: false,
      })
    })
  })

  it('exports the strict validation error message', () => {
    expect(FULL_DATE_ERROR_MESSAGE).toBe('Định dạng ngày không hợp lệ. Sử dụng: DD/MM/YYYY')
  })
})
