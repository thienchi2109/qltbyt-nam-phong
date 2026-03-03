/**
 * Category import validation and header mapping utilities.
 *
 * Extracts validation logic from DeviceQuotaCategoryImportDialog to keep
 * that component focused on UI concerns. Handles:
 * - Vietnamese diacritic normalization for header matching
 * - Header-to-database field name mapping
 * - Row-level validation (required fields, format, duplicates, quotas)
 */

// ============================================
// Types
// ============================================

export interface ParsedCategoryRow {
  ma_nhom: string
  ten_nhom: string
  parent_ma_nhom: string | null
  phan_loai: string | null
  don_vi_tinh: string | null
  thu_tu_hien_thi: number | null
  mo_ta: string | null
  dinh_muc_toi_da: number | null
  toi_thieu: number | null
}

export interface ImportResultDetail {
  ma_nhom: string
  success: boolean
  error?: string
}

export interface ImportResult {
  success: boolean
  inserted: number
  failed: number
  total: number
  details: ImportResultDetail[]
}

export type ImportStatus = "idle" | "parsing" | "parsed" | "success" | "error"

// ============================================
// Header Mapping with Diacritic Support
// ============================================

/**
 * Normalize Vietnamese text by removing diacritics for header matching.
 * This allows Excel files with either diacritic or non-diacritic headers to work.
 */
export function normalizeVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/đ/gi, "d") // Handle đ separately
    .toLowerCase()
    .trim()
}

/**
 * Map normalized Vietnamese headers to database field names.
 * Supports both with and without diacritics.
 */
export const HEADER_TO_DB_MAP: Record<string, string> = {
  "stt": "_stt", // Ignored
  "ma nhom": "ma_nhom",
  "ten nhom": "ten_nhom",
  "ma nhom cha": "parent_ma_nhom",
  "phan loai": "phan_loai",
  "don vi tinh": "don_vi_tinh",
  "thu tu hien thi": "thu_tu_hien_thi",
  "mo ta": "mo_ta",
  "dinh muc (sl toi da)": "dinh_muc_toi_da",
  "dinh muc": "dinh_muc_toi_da", // Short alias
  "toi thieu": "toi_thieu",
}

// ============================================
// Validation
// ============================================

// ma_nhom format pattern: XX, XX.XX, XX.XX.XX, XX.XX.XX.XX (1-4 levels, alphanumeric)
const MA_NHOM_PATTERN = /^[A-Za-z0-9]+(\.[A-Za-z0-9]+){0,3}$/

/**
 * Validate parsed rows from Excel, returning valid rows, errors, and warnings.
 * Performs: required field checks, format validation, duplicate detection,
 * classification validation, display order validation, and quota validation.
 */
export function validateParsedRows(
  rows: Record<string, unknown>[],
  existingCodes: Set<string>
): { validRows: ParsedCategoryRow[]; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const validRows: ParsedCategoryRow[] = []
  const seenCodes = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // Excel row (1-indexed, header is row 1)
    const rowErrors: string[] = []
    const rowWarnings: string[] = []

    // Get values
    const maNhom = String(row.ma_nhom ?? "").trim()
    const tenNhom = String(row.ten_nhom ?? "").trim()
    const parentMaNhom = row.parent_ma_nhom ? String(row.parent_ma_nhom).trim() : null
    const phanLoai = row.phan_loai ? String(row.phan_loai).trim().toUpperCase() : null
    const donViTinh = row.don_vi_tinh ? String(row.don_vi_tinh).trim() : null
    const thuTuRaw = row.thu_tu_hien_thi
    const moTa = row.mo_ta ? String(row.mo_ta).trim() : null

    // Skip empty rows
    if (!maNhom && !tenNhom) {
      continue
    }

    // Required field validation (blocking errors)
    if (!maNhom) {
      rowErrors.push(`Dong ${rowNum}: Thieu ma nhom (bat buoc)`)
    }
    if (!tenNhom) {
      rowErrors.push(`Dong ${rowNum}: Thieu ten nhom (bat buoc)`)
    }

    // ma_nhom format validation (blocking error)
    if (maNhom && !MA_NHOM_PATTERN.test(maNhom)) {
      rowErrors.push(`Dong ${rowNum}: Ma nhom "${maNhom}" khong dung dinh dang (VD: XX, XX.XX, XX.XX.XX)`)
    }

    // Duplicate check within file (blocking error)
    if (maNhom && seenCodes.has(maNhom)) {
      rowErrors.push(`Dong ${rowNum}: Ma nhom "${maNhom}" bi trung trong file`)
    }

    // Duplicate check against existing categories (warning - server will handle per-item)
    if (maNhom && existingCodes.has(maNhom)) {
      rowWarnings.push(`Dong ${rowNum}: Ma nhom "${maNhom}" da ton tai - se bi bo qua`)
    }

    // Classification validation (blocking error for invalid values)
    if (phanLoai && phanLoai !== "A" && phanLoai !== "B") {
      rowErrors.push(`Dong ${rowNum}: Phan loai phai la "A" hoac "B", khong phai "${phanLoai}"`)
    }

    // Display order validation (must be integer >= 0)
    let thuTuHienThi: number | null = null
    if (thuTuRaw !== null && thuTuRaw !== undefined && thuTuRaw !== "") {
      const parsed = Number(thuTuRaw)
      if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0) {
        rowErrors.push(`Dong ${rowNum}: Thu tu hien thi phai la so nguyen >= 0`)
      } else {
        thuTuHienThi = parsed
      }
    }

    // Quota validation (optional columns)
    const dinhMucRaw = row.dinh_muc_toi_da
    const toiThieuRaw = row.toi_thieu
    let dinhMucToiDa: number | null = null
    let toiThieu: number | null = null

    if (dinhMucRaw !== null && dinhMucRaw !== undefined && dinhMucRaw !== "") {
      const parsed = Number(dinhMucRaw)
      if (isNaN(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        rowErrors.push(`Dong ${rowNum}: Dinh muc phai la so nguyen > 0`)
      } else {
        dinhMucToiDa = parsed
      }
    }

    if (toiThieuRaw !== null && toiThieuRaw !== undefined && toiThieuRaw !== "") {
      const parsed = Number(toiThieuRaw)
      if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0) {
        rowErrors.push(`Dong ${rowNum}: Toi thieu phai la so nguyen >= 0`)
      } else {
        toiThieu = parsed
      }
    }

    // Cross-field validation: toi_thieu <= dinh_muc_toi_da
    if (dinhMucToiDa !== null && toiThieu !== null && toiThieu > dinhMucToiDa) {
      rowErrors.push(`Dong ${rowNum}: Toi thieu (${toiThieu}) khong duoc lon hon dinh muc (${dinhMucToiDa})`)
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
      // Row with errors won't be added to validRows
    } else if (maNhom) {
      // Add warnings but still include the row
      warnings.push(...rowWarnings)
      seenCodes.add(maNhom)
      validRows.push({
        ma_nhom: maNhom,
        ten_nhom: tenNhom,
        parent_ma_nhom: parentMaNhom || null,
        phan_loai: phanLoai,
        don_vi_tinh: donViTinh,
        thu_tu_hien_thi: thuTuHienThi,
        mo_ta: moTa,
        dinh_muc_toi_da: dinhMucToiDa,
        toi_thieu: toiThieu,
      })
    }
  }

  return { validRows, errors, warnings }
}

/**
 * Transform raw Excel JSON rows to database field names using normalized header matching.
 */
export function transformExcelHeaders(jsonData: Record<string, unknown>[]): Record<string, unknown>[] {
  return jsonData.map(row => {
    const newRow: Record<string, unknown> = {}
    for (const header in row) {
      const normalizedHeader = normalizeVietnamese(header)
      if (Object.prototype.hasOwnProperty.call(HEADER_TO_DB_MAP, normalizedHeader)) {
        const dbKey = HEADER_TO_DB_MAP[normalizedHeader]
        const rawVal = row[header]
        let value: unknown = (rawVal === "" || rawVal === undefined) ? null : rawVal

        // Trim string values
        if (typeof rawVal === "string") {
          value = rawVal.trim() === "" ? null : rawVal.trim()
        }

        newRow[dbKey] = value
      }
    }
    return newRow
  })
}
