import { FULL_DATE_ERROR_MESSAGE, normalizeFullDateForImport } from "@/lib/date-utils"
import type { Equipment } from "@/lib/data"
import {
  DECOMMISSION_DATE_CHRONOLOGICAL_ERROR_MESSAGE,
  DECOMMISSION_DATE_STATUS_ERROR_MESSAGE,
} from "@/components/equipment-decommission-form"
import type { ValidationResult } from "@/components/bulk-import"

// Required fields for equipment validation
/** Display labels for fields required during equipment import. */
export const REQUIRED_FIELDS = {
  khoa_phong_quan_ly: "Khoa/phòng quản lý",
  nguoi_dang_truc_tiep_quan_ly: "Người sử dụng",
  tinh_trang_hien_tai: "Tình trạng",
  vi_tri_lap_dat: "Vị trí lắp đặt",
} as const

/** Stores normalized commission dates associated with imported rows. */
export const strictCommissionDateByRow = new WeakMap<Partial<Equipment>, string | null>()

/** Normalizes an imported commission date, rejecting invalid values. */
export function getStrictImportFullDate(value: unknown): string | null {
  const normalized = normalizeFullDateForImport(value)
  return normalized.rejected ? null : normalized.value
}

// Validation function for equipment data
/** Validates imported equipment rows against required fields and active statuses. */
export const validateEquipmentData = (
  data: Partial<Equipment>[],
  activeValues: readonly string[] = []
): ValidationResult<Partial<Equipment>> => {
  const validStatuses = new Set(activeValues)
  const errors: string[] = []
  const validRecords: Partial<Equipment>[] = []

  data.forEach((item, index) => {
    const missingFields: string[] = []
    const normalizedItem: Partial<Equipment> = { ...item }
    let hasRowError = false

    // Check each required field
    Object.entries(REQUIRED_FIELDS).forEach(([dbKey, displayName]) => {
      const value = item[dbKey as keyof Equipment]
      if (!value || (typeof value === "string" && value.trim() === "")) {
        missingFields.push(displayName)
      }
    })

    // Validate status value if provided
    const status =
      typeof item.tinh_trang_hien_tai === "string"
        ? item.tinh_trang_hien_tai.trim()
        : item.tinh_trang_hien_tai
    if (typeof status === "string" && status !== "") {
      normalizedItem.tinh_trang_hien_tai = status as Equipment["tinh_trang_hien_tai"]
    }
    const hasInvalidStatus = Boolean(
      status && typeof status === "string" && status !== "" && !validStatuses.has(status)
    )
    if (hasInvalidStatus) {
      errors.push(
        `Dòng ${index + 2}: Tình trạng "${status}" không hợp lệ. Phải là một trong: ${activeValues.join(", ")}`
      )
      hasRowError = true
    }

    if (missingFields.length > 0) {
      errors.push(`Dòng ${index + 2}: Thiếu ${missingFields.join(", ")}`)
      hasRowError = true
    }

    const stopDateValue = (item as Partial<Equipment> & { ngay_ngung_su_dung?: unknown })
      .ngay_ngung_su_dung
    const hasStopDateValue =
      stopDateValue !== undefined &&
      stopDateValue !== null &&
      !(typeof stopDateValue === "string" && stopDateValue.trim() === "")

    if (hasStopDateValue) {
      const normalizedFullDate = normalizeFullDateForImport(stopDateValue)
      const normalizedUsageStartDate = strictCommissionDateByRow.has(item)
        ? (strictCommissionDateByRow.get(item) ?? null)
        : getStrictImportFullDate(item.ngay_dua_vao_su_dung)

      if (status !== "Ngưng sử dụng") {
        errors.push(`Dòng ${index + 2}: ${DECOMMISSION_DATE_STATUS_ERROR_MESSAGE}`)
        hasRowError = true
      } else if (normalizedFullDate.rejected || !normalizedFullDate.value) {
        errors.push(
          `Dòng ${index + 2}: Ngày ngừng sử dụng không hợp lệ. ${FULL_DATE_ERROR_MESSAGE}`
        )
        hasRowError = true
      } else if (normalizedUsageStartDate && normalizedFullDate.value < normalizedUsageStartDate) {
        errors.push(`Dòng ${index + 2}: ${DECOMMISSION_DATE_CHRONOLOGICAL_ERROR_MESSAGE}`)
        hasRowError = true
      } else {
        normalizedItem.ngay_ngung_su_dung = normalizedFullDate.value
        normalizedItem.tinh_trang_hien_tai = status as Equipment["tinh_trang_hien_tai"]
      }
    }

    if (!hasRowError) {
      validRecords.push(normalizedItem)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    validRecords:
      errors.length === 0
        ? data.map((item, index) => ({
            ...item,
            tinh_trang_hien_tai: validRecords[index].tinh_trang_hien_tai,
          }))
        : validRecords,
  }
}
