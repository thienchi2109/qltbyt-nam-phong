/**
 * Date utility functions for Vietnamese Medical Equipment Management System
 * Centralizes date parsing, normalization, and validation logic
 */

/** Threshold year for suspicious dates (likely Excel import errors) */
export const SUSPICIOUS_YEAR_THRESHOLD = 1970

/** Warning message for suspicious dates (Vietnamese) */
export const SUSPICIOUS_DATE_WARNING =
  "Định dạng ngày có thể không chính xác. Vui lòng kiểm tra lại ngày đưa vào sử dụng của thiết bị"

/**
 * Detects suspicious dates with year < 1970 (likely Excel import errors)
 * Handles both YYYY-MM-DD (database format) and DD/MM/YYYY (user input)
 */
export const isSuspiciousDate = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return false
  const s = String(dateStr).trim()

  // Match YYYY-MM-DD or YYYY/MM/DD (database/ISO format)
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    return year < SUSPICIOUS_YEAR_THRESHOLD
  }

  // Match DD/MM/YYYY or DD-MM-YYYY (Vietnamese format)
  const vietMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (vietMatch) {
    const year = parseInt(vietMatch[3], 10)
    return year < SUSPICIOUS_YEAR_THRESHOLD
  }

  return false
}

/**
 * Normalizes date strings for form schema transforms
 * Converts DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD format
 * Used in Zod schema transforms for equipment forms
 */
export const normalizeDateForForm = (v: string | null | undefined): string | null => {
  if (!v) return null
  const s = String(v).trim()
  if (s === "") return null
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const d = m[1].padStart(2, "0")
    const mo = m[2].padStart(2, "0")
    const y = m[3]
    return `${y}-${mo}-${d}`
  }
  return s
}

/** Result type for Excel date normalization with rejection tracking */
export interface NormalizeDateResult {
  value: string | null
  rejected: boolean
}

/**
 * Normalizes Excel date values (serial numbers or strings) to ISO format
 * Tracks rejected dates (year < 1970) for user feedback
 * Used during Excel import to handle various date formats
 */
export function normalizeDateForImport(val: unknown): NormalizeDateResult {
  if (val === undefined || val === null || val === "") {
    return { value: null, rejected: false }
  }

  // Handle string dates
  if (typeof val === "string") {
    const s = val.trim()

    // Try YYYY-MM-DD (ISO format)
    const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/
    if (yyyymmdd.test(s)) {
      return { value: s, rejected: false }
    }

    // Try DD/MM/YYYY or DD-MM-YYYY (Vietnamese format)
    const ddmmyyyy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
    const m = s.match(ddmmyyyy)
    if (m) {
      const d = m[1].padStart(2, "0")
      const mo = m[2].padStart(2, "0")
      const y = m[3]
      return { value: `${y}-${mo}-${d}`, rejected: false }
    }

    // Fallback: try Date parse
    const parsed = new Date(s)
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear()
      const mo = String(parsed.getMonth() + 1).padStart(2, "0")
      const d = String(parsed.getDate()).padStart(2, "0")
      return { value: `${y}-${mo}-${d}`, rejected: false }
    }

    return { value: null, rejected: false }
  }

  // Handle Excel serial dates (numbers)
  if (typeof val === "number") {
    // Excel serial date (1900 system): epoch 1899-12-30
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const ms = val * 24 * 60 * 60 * 1000
    const dt = new Date(epoch.getTime() + ms)
    const y = dt.getUTCFullYear()

    // Sanity check: reject dates before threshold (likely invalid Excel serial)
    if (y < SUSPICIOUS_YEAR_THRESHOLD) {
      return { value: null, rejected: true }
    }

    const mo = String(dt.getUTCMonth() + 1).padStart(2, "0")
    const d = String(dt.getUTCDate()).padStart(2, "0")
    return { value: `${y}-${mo}-${d}`, rejected: false }
  }

  return { value: null, rejected: false }
}

/** Set of TEXT date fields that may contain suspicious dates from Excel import */
export const TEXT_DATE_FIELDS = new Set([
  "ngay_dua_vao_su_dung",
  "ngay_nhap",
  "han_bao_hanh",
])
