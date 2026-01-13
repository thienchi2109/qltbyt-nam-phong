/**
 * Tests for equipment import status validation.
 *
 * Validates that the equipment import function:
 * 1. Accepts all valid status values
 * 2. Rejects invalid status values with clear error messages
 * 3. Handles edge cases (whitespace, empty strings, null)
 */

import { describe, it, expect } from 'vitest'

// Valid status values - the source of truth from equipment-table-columns.tsx
const EQUIPMENT_STATUS_OPTIONS = [
  "Hoạt động",
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng"
] as const

const VALID_STATUSES: Set<string> = new Set(EQUIPMENT_STATUS_OPTIONS)

// Required fields for equipment validation (same as in import-equipment-dialog.tsx)
const REQUIRED_FIELDS = {
  'khoa_phong_quan_ly': 'Khoa/phòng quản lý',
  'nguoi_dang_truc_tiep_quan_ly': 'Người sử dụng',
  'tinh_trang_hien_tai': 'Tình trạng',
  'vi_tri_lap_dat': 'Vị trí lắp đặt'
} as const

type Equipment = {
  ma_thiet_bi?: string
  ten_thiet_bi?: string
  khoa_phong_quan_ly?: string
  nguoi_dang_truc_tiep_quan_ly?: string
  tinh_trang_hien_tai?: string
  vi_tri_lap_dat?: string
  [key: string]: unknown
}

/**
 * Extracted validation function - mirrors import-equipment-dialog.tsx logic
 */
function validateEquipmentData(data: Partial<Equipment>[], headerMapping: Record<string, string>) {
  const errors: string[] = []
  const validationResults: { isValid: boolean; missingFields: string[] }[] = []

  data.forEach((item, index) => {
    const missingFields: string[] = []

    // Check each required field
    Object.entries(REQUIRED_FIELDS).forEach(([dbKey, displayName]) => {
      const value = item[dbKey as keyof Equipment]
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(displayName)
      }
    })

    // Validate status value if provided
    const status = item.tinh_trang_hien_tai
    if (status && typeof status === 'string') {
      const trimmedStatus = status.trim()
      if (trimmedStatus !== '' && !VALID_STATUSES.has(trimmedStatus)) {
        errors.push(`Dòng ${index + 2}: Tình trạng "${trimmedStatus}" không hợp lệ. Phải là một trong: ${EQUIPMENT_STATUS_OPTIONS.join(', ')}`)
      }
    }

    validationResults.push({
      isValid: missingFields.length === 0,
      missingFields
    })

    if (missingFields.length > 0) {
      errors.push(`Dòng ${index + 2}: Thiếu ${missingFields.join(', ')}`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    validationResults
  }
}

describe('Equipment Import Validation', () => {
  const headerMapping = {
    'Khoa/phòng quản lý': 'khoa_phong_quan_ly',
    'Người sử dụng': 'nguoi_dang_truc_tiep_quan_ly',
    'Tình trạng': 'tinh_trang_hien_tai',
    'Vị trí lắp đặt': 'vi_tri_lap_dat'
  }

  describe('Valid Status Values', () => {
    it('should accept all 6 valid status values', () => {
      EQUIPMENT_STATUS_OPTIONS.forEach((status) => {
        const data: Partial<Equipment>[] = [{
          khoa_phong_quan_ly: 'Khoa Nội',
          nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
          tinh_trang_hien_tai: status,
          vi_tri_lap_dat: 'Phòng 101'
        }]

        const result = validateEquipmentData(data, headerMapping)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })

    it('should accept "Hoạt động" status', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Tim Mạch',
        nguoi_dang_truc_tiep_quan_ly: 'Trần Thị B',
        tinh_trang_hien_tai: 'Hoạt động',
        vi_tri_lap_dat: 'Phòng 202'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(true)
    })

    it('should accept "Chờ sửa chữa" status', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Ngoại',
        nguoi_dang_truc_tiep_quan_ly: 'Lê Văn C',
        tinh_trang_hien_tai: 'Chờ sửa chữa',
        vi_tri_lap_dat: 'Kho 3'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(true)
    })

    it('should accept "Chờ hiệu chuẩn/kiểm định" status', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Phòng Xét nghiệm',
        nguoi_dang_truc_tiep_quan_ly: 'Phạm Thị D',
        tinh_trang_hien_tai: 'Chờ hiệu chuẩn/kiểm định',
        vi_tri_lap_dat: 'Phòng lab'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(true)
    })
  })

  describe('Invalid Status Values', () => {
    it('should reject unknown status value', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Nội',
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: 'Đang hoạt động', // Invalid - should be "Hoạt động"
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Dòng 2')
      expect(result.errors[0]).toContain('Đang hoạt động')
      expect(result.errors[0]).toContain('không hợp lệ')
    })

    it('should reject misspelled status', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Nội',
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: 'Hoat dong', // Missing diacritics
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('Hoat dong')
    })

    it('should reject completely invalid status', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Nội',
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: 'XYZ123',
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('XYZ123')
    })

    it('should reject status with different case', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Nội',
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: 'HOẠT ĐỘNG', // All uppercase
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(false)
    })

    it('should include all valid statuses in error message', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Nội',
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: 'Invalid',
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.errors[0]).toContain('Hoạt động')
      expect(result.errors[0]).toContain('Chờ sửa chữa')
      expect(result.errors[0]).toContain('Chờ bảo trì')
      expect(result.errors[0]).toContain('Chờ hiệu chuẩn/kiểm định')
      expect(result.errors[0]).toContain('Ngưng sử dụng')
      expect(result.errors[0]).toContain('Chưa có nhu cầu sử dụng')
    })
  })

  describe('Whitespace Handling', () => {
    it('should handle status with leading whitespace', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Nội',
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: '  Hoạt động', // Leading spaces should be trimmed
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      // After trimming, "Hoạt động" is valid
      // But current implementation checks trimmed value against Set
      // So leading/trailing whitespace should NOT cause rejection
      expect(result.isValid).toBe(true)
    })

    it('should handle status with trailing whitespace', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Nội',
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: 'Hoạt động  ', // Trailing spaces
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(true)
    })

    it('should handle status with both leading and trailing whitespace', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Nội',
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: '  Chờ bảo trì  ',
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(true)
    })

    it('should treat whitespace-only status as missing (not invalid status error)', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Nội',
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: '   ',
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(false)
      // Should have "Thiếu Tình trạng" error, NOT "Invalid status" error
      expect(result.errors.some(e => e.includes('Thiếu') && e.includes('Tình trạng'))).toBe(true)
      expect(result.errors.some(e => e.includes('không hợp lệ'))).toBe(false)
    })
  })

  describe('Empty and Null Status', () => {
    it('should treat empty string status as missing required field', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Nội',
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: '',
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('Thiếu')
      expect(result.errors[0]).toContain('Tình trạng')
    })

    it('should treat undefined status as missing required field', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Nội',
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: undefined,
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('Tình trạng')
    })

    it('should not trigger invalid status error for null status', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: 'Khoa Nội',
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: null as unknown as string,
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      // Should be missing field, not invalid status
      expect(result.errors.some(e => e.includes('không hợp lệ'))).toBe(false)
    })
  })

  describe('Multiple Rows Validation', () => {
    it('should validate all rows and report all errors', () => {
      const data: Partial<Equipment>[] = [
        {
          khoa_phong_quan_ly: 'Khoa Nội',
          nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
          tinh_trang_hien_tai: 'InvalidStatus1',
          vi_tri_lap_dat: 'Phòng 101'
        },
        {
          khoa_phong_quan_ly: 'Khoa Ngoại',
          nguoi_dang_truc_tiep_quan_ly: 'Trần Thị B',
          tinh_trang_hien_tai: 'Hoạt động', // Valid
          vi_tri_lap_dat: 'Phòng 202'
        },
        {
          khoa_phong_quan_ly: 'Khoa Tim',
          nguoi_dang_truc_tiep_quan_ly: 'Lê Văn C',
          tinh_trang_hien_tai: 'InvalidStatus2',
          vi_tri_lap_dat: 'Phòng 303'
        }
      ]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(false)
      // Should have 2 invalid status errors
      const statusErrors = result.errors.filter(e => e.includes('không hợp lệ'))
      expect(statusErrors).toHaveLength(2)
      expect(statusErrors[0]).toContain('Dòng 2')
      expect(statusErrors[0]).toContain('InvalidStatus1')
      expect(statusErrors[1]).toContain('Dòng 4')
      expect(statusErrors[1]).toContain('InvalidStatus2')
    })

    it('should pass validation when all rows have valid statuses', () => {
      const data: Partial<Equipment>[] = [
        {
          khoa_phong_quan_ly: 'Khoa Nội',
          nguoi_dang_truc_tiep_quan_ly: 'A',
          tinh_trang_hien_tai: 'Hoạt động',
          vi_tri_lap_dat: 'P1'
        },
        {
          khoa_phong_quan_ly: 'Khoa Ngoại',
          nguoi_dang_truc_tiep_quan_ly: 'B',
          tinh_trang_hien_tai: 'Chờ sửa chữa',
          vi_tri_lap_dat: 'P2'
        },
        {
          khoa_phong_quan_ly: 'Khoa Tim',
          nguoi_dang_truc_tiep_quan_ly: 'C',
          tinh_trang_hien_tai: 'Ngưng sử dụng',
          vi_tri_lap_dat: 'P3'
        }
      ]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Row Number in Error Message', () => {
    it('should report Excel row number (index + 2 for header)', () => {
      const data: Partial<Equipment>[] = [
        {
          khoa_phong_quan_ly: 'Khoa Nội',
          nguoi_dang_truc_tiep_quan_ly: 'A',
          tinh_trang_hien_tai: 'Hoạt động',
          vi_tri_lap_dat: 'P1'
        },
        {
          khoa_phong_quan_ly: 'Khoa Ngoại',
          nguoi_dang_truc_tiep_quan_ly: 'B',
          tinh_trang_hien_tai: 'Hoạt động',
          vi_tri_lap_dat: 'P2'
        },
        {
          khoa_phong_quan_ly: 'Khoa Tim',
          nguoi_dang_truc_tiep_quan_ly: 'C',
          tinh_trang_hien_tai: 'BadStatus', // This is row 4 in Excel (index 2 + 2)
          vi_tri_lap_dat: 'P3'
        }
      ]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.errors[0]).toContain('Dòng 4')
    })
  })

  describe('Required Fields Validation', () => {
    it('should detect multiple missing required fields', () => {
      const data: Partial<Equipment>[] = [{
        // Missing all required fields
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(false)
      expect(result.validationResults[0].missingFields).toContain('Khoa/phòng quản lý')
      expect(result.validationResults[0].missingFields).toContain('Người sử dụng')
      expect(result.validationResults[0].missingFields).toContain('Tình trạng')
      expect(result.validationResults[0].missingFields).toContain('Vị trí lắp đặt')
    })

    it('should report both missing fields and invalid status', () => {
      const data: Partial<Equipment>[] = [{
        khoa_phong_quan_ly: '', // Missing
        nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
        tinh_trang_hien_tai: 'InvalidStatus', // Invalid
        vi_tri_lap_dat: 'Phòng 101'
      }]

      const result = validateEquipmentData(data, headerMapping)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
      expect(result.errors.some(e => e.includes('không hợp lệ'))).toBe(true)
      expect(result.errors.some(e => e.includes('Thiếu'))).toBe(true)
    })
  })
})

describe('Equipment Status Options Integrity', () => {
  it('should have exactly 6 valid status options', () => {
    expect(EQUIPMENT_STATUS_OPTIONS).toHaveLength(6)
  })

  it('should have the correct status values', () => {
    expect(EQUIPMENT_STATUS_OPTIONS).toContain('Hoạt động')
    expect(EQUIPMENT_STATUS_OPTIONS).toContain('Chờ sửa chữa')
    expect(EQUIPMENT_STATUS_OPTIONS).toContain('Chờ bảo trì')
    expect(EQUIPMENT_STATUS_OPTIONS).toContain('Chờ hiệu chuẩn/kiểm định')
    expect(EQUIPMENT_STATUS_OPTIONS).toContain('Ngưng sử dụng')
    expect(EQUIPMENT_STATUS_OPTIONS).toContain('Chưa có nhu cầu sử dụng')
  })

  it('VALID_STATUSES Set should match EQUIPMENT_STATUS_OPTIONS', () => {
    expect(VALID_STATUSES.size).toBe(EQUIPMENT_STATUS_OPTIONS.length)
    EQUIPMENT_STATUS_OPTIONS.forEach(status => {
      expect(VALID_STATUSES.has(status)).toBe(true)
    })
  })
})
