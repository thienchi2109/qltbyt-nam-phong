/**
 * Date utility functions for Vietnamese Medical Equipment Management System
 * Centralizes date parsing, normalization, and validation logic
 */

/** Threshold year for suspicious dates (likely Excel import errors) */
export const SUSPICIOUS_YEAR_THRESHOLD = 1970

/** Warning message for suspicious dates (Vietnamese) */
export const SUSPICIOUS_DATE_WARNING =
  "Định dạng ngày có thể không chính xác. Vui lòng kiểm tra lại ngày đưa vào sử dụng của thiết bị"

const FULL_DATE_VIETNAMESE_PATTERN = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
const FULL_DATE_ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function isValidCalendarDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function formatIsoFullDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function parseStrictFullDate(value: string | null | undefined): string | null {
  if (!value) return null

  const s = String(value).trim()
  if (s === "") return null

  const isoMatch = s.match(FULL_DATE_ISO_PATTERN)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10)
    const day = parseInt(isoMatch[3], 10)
    return isValidCalendarDateParts(year, month, day)
      ? formatIsoFullDate(year, month, day)
      : null
  }

  const vietnameseMatch = s.match(FULL_DATE_VIETNAMESE_PATTERN)
  if (vietnameseMatch) {
    const day = parseInt(vietnameseMatch[1], 10)
    const month = parseInt(vietnameseMatch[2], 10)
    const year = parseInt(vietnameseMatch[3], 10)
    return isValidCalendarDateParts(year, month, day)
      ? formatIsoFullDate(year, month, day)
      : null
  }

  return null
}

function normalizeExcelSerialToFullDate(value: number): NormalizeDateResult {
  if (!Number.isFinite(value)) {
    return { value: null, rejected: false }
  }

  const epoch = new Date(Date.UTC(1899, 11, 30))
  const milliseconds = Math.round(value * 24 * 60 * 60 * 1000)
  const date = new Date(epoch.getTime() + milliseconds)
  const year = date.getUTCFullYear()

  if (year < SUSPICIOUS_YEAR_THRESHOLD) {
    return { value: null, rejected: true }
  }

  return {
    value: formatIsoFullDate(year, date.getUTCMonth() + 1, date.getUTCDate()),
    rejected: false,
  }
}

function normalizeDateObjectToFullDate(value: Date): NormalizeDateResult {
  if (Number.isNaN(value.getTime())) {
    return { value: null, rejected: false }
  }

  const year = value.getFullYear()
  if (year < SUSPICIOUS_YEAR_THRESHOLD) {
    return { value: null, rejected: true }
  }

  return {
    value: formatIsoFullDate(year, value.getMonth() + 1, value.getDate()),
    rejected: false,
  }
}

/** Error message for invalid full date format (Vietnamese) */
export const FULL_DATE_ERROR_MESSAGE =
  "Định dạng ngày không hợp lệ. Sử dụng: DD/MM/YYYY"

/**
 * Validates full date input used by strict full-date fields.
 * Empty values are allowed for optional form fields.
 */
export function isValidFullDate(value: string | null | undefined): boolean {
  if (!value) return true
  const s = String(value).trim()
  if (s === "") return true
  return parseStrictFullDate(s) !== null
}

/**
 * Normalizes strict full-date form input to ISO storage format.
 */
export function normalizeFullDateForForm(value: string | null | undefined): string | null {
  return parseStrictFullDate(value)
}

/**
 * Normalizes strict full-date import input without permissive parser fallback.
 */
export function normalizeFullDateForImport(value: unknown): NormalizeDateResult {
  if (value === undefined || value === null || value === "") {
    return { value: null, rejected: false }
  }

  if (value instanceof Date) {
    return normalizeDateObjectToFullDate(value)
  }

  if (typeof value === "string") {
    return { value: parseStrictFullDate(value), rejected: false }
  }

  if (typeof value === "number") {
    return normalizeExcelSerialToFullDate(value)
  }

  return { value: null, rejected: false }
}

/**
 * Formats strict full-date values for UI display.
 * Supports ISO storage format and Vietnamese full-date input.
 */
export function formatFullDateToDisplay(value: string | null | undefined): string {
  if (!value) return ""

  const s = String(value).trim()
  if (s === "") return ""

  const isoMatch = s.match(FULL_DATE_ISO_PATTERN)
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`
  }

  const vietnameseMatch = s.match(FULL_DATE_VIETNAMESE_PATTERN)
  if (vietnameseMatch) {
    const day = vietnameseMatch[1].padStart(2, "0")
    const month = vietnameseMatch[2].padStart(2, "0")
    return `${day}/${month}/${vietnameseMatch[3]}`
  }

  return s
}

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

  if (val instanceof Date) {
    return normalizeDateObjectToFullDate(val)
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

// =============================================================================
// PARTIAL DATE UTILITIES
// Supports flexible date input: YYYY, MM/YYYY, or DD/MM/YYYY
// Stored as ISO format: YYYY, YYYY-MM, or YYYY-MM-DD
// =============================================================================

/**
 * Formats a partial ISO date string to Vietnamese display format
 * @param iso - ISO format: "2020", "2020-03", or "2020-03-15"
 * @returns Vietnamese format: "2020", "03/2020", or "15/03/2020"
 */
export function formatPartialDateToDisplay(iso: string | null | undefined): string {
  if (!iso) return ""
  const s = String(iso).trim()
  if (s === "") return ""

  const parts = s.split("-")
  if (parts.length === 1) return parts[0] // "2020"
  if (parts.length === 2) return `${parts[1]}/${parts[0]}` // "03/2020"
  return `${parts[2]}/${parts[1]}/${parts[0]}` // "15/03/2020"
}

/**
 * Parses a Vietnamese partial date string to ISO storage format
 * @param vn - Vietnamese format: "2020", "03/2020", or "15/03/2020"
 * @returns ISO format: "2020", "2020-03", or "2020-03-15" (or null if invalid)
 */
export function parsePartialDateToISO(vn: string | null | undefined): string | null {
  if (!vn) return null
  const s = String(vn).trim()
  if (s === "") return null

  // Year only: "2020"
  if (/^\d{4}$/.test(s)) {
    return s
  }

  // Month/Year: "03/2020" or "3/2020"
  const mmyyyyMatch = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (mmyyyyMatch) {
    const monthNum = parseInt(mmyyyyMatch[1], 10)
    if (monthNum < 1 || monthNum > 12) return null // Invalid month
    const month = String(monthNum).padStart(2, "0")
    const year = mmyyyyMatch[2]
    return `${year}-${month}`
  }

  // Full date: "15/03/2020" or "15-03-2020"
  const ddmmyyyyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (ddmmyyyyMatch) {
    const dayNum = parseInt(ddmmyyyyMatch[1], 10)
    const monthNum = parseInt(ddmmyyyyMatch[2], 10)
    if (monthNum < 1 || monthNum > 12) return null // Invalid month
    if (dayNum < 1 || dayNum > 31) return null // Invalid day
    const day = String(dayNum).padStart(2, "0")
    const month = String(monthNum).padStart(2, "0")
    const year = ddmmyyyyMatch[3]
    return `${year}-${month}-${day}`
  }

  // Already in valid ISO format? Validate month/day ranges before passing through
  const isoMatch = s.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/)
  if (isoMatch) {
    const monthNum = isoMatch[2] ? parseInt(isoMatch[2], 10) : null
    const dayNum = isoMatch[3] ? parseInt(isoMatch[3], 10) : null
    if (monthNum !== null && (monthNum < 1 || monthNum > 12)) return null
    if (dayNum !== null && (dayNum < 1 || dayNum > 31)) return null
    return s
  }

  // Invalid format - return null
  return null
}

/**
 * Normalizes partial date for form submission (Zod transform)
 * Converts Vietnamese input to ISO storage format
 * Supports: YYYY, MM/YYYY, DD/MM/YYYY
 */
export const normalizePartialDateForForm = (v: string | null | undefined): string | null => {
  return parsePartialDateToISO(v)
}

/** Error message for invalid partial date format (Vietnamese) */
export const PARTIAL_DATE_ERROR_MESSAGE =
  "Định dạng ngày không hợp lệ. Sử dụng: DD/MM/YYYY, MM/YYYY hoặc YYYY"

/**
 * Validates partial date format and semantic correctness
 * @returns true if valid format (YYYY, MM/YYYY, DD/MM/YYYY, or ISO equivalents) with valid month/day values
 */
export function isValidPartialDate(value: string | null | undefined): boolean {
  if (!value) return true // Empty is valid (optional field)
  const s = String(value).trim()
  if (s === "") return true

  // Year only: YYYY
  if (/^\d{4}$/.test(s)) return true

  // Month/Year: MM/YYYY - validate month range
  const mmyyyyMatch = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (mmyyyyMatch) {
    const monthNum = parseInt(mmyyyyMatch[1], 10)
    return monthNum >= 1 && monthNum <= 12
  }

  // Full date: DD/MM/YYYY or DD-MM-YYYY - validate month and day range
  const ddmmyyyyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (ddmmyyyyMatch) {
    const dayNum = parseInt(ddmmyyyyMatch[1], 10)
    const monthNum = parseInt(ddmmyyyyMatch[2], 10)
    return monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31
  }

  // ISO formats (already stored) - validate month/day ranges
  const isoMatch = s.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/)
  if (isoMatch) {
    const monthNum = isoMatch[2] ? parseInt(isoMatch[2], 10) : null
    const dayNum = isoMatch[3] ? parseInt(isoMatch[3], 10) : null
    if (monthNum !== null && (monthNum < 1 || monthNum > 12)) return false
    if (dayNum !== null && (dayNum < 1 || dayNum > 31)) return false
    return true
  }

  return false
}
