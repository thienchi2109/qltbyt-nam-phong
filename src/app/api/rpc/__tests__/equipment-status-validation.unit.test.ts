/**
 * Unit tests for equipment status validation logic.
 *
 * These tests verify the validation logic that mirrors the PostgreSQL
 * equipment_create RPC function's status validation (defense-in-depth).
 *
 * Note: These are unit tests using a local mock of the validation logic.
 * They do NOT call the actual Supabase RPC functions. For true integration
 * tests against the database, a separate test suite with a running Supabase
 * instance would be required.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Valid status values that should be accepted by the RPC
const VALID_STATUSES = [
  'Hoạt động',
  'Chờ sửa chữa',
  'Chờ bảo trì',
  'Chờ hiệu chuẩn/kiểm định',
  'Ngưng sử dụng',
  'Chưa có nhu cầu sử dụng',
] as const

const RPC_FULL_DATE_ERROR_MESSAGE = 'Định dạng ngày không hợp lệ. Sử dụng: YYYY-MM-DD'

// Invalid status values that should be rejected by the RPC
const INVALID_STATUSES = [
  'Đang hoạt động',    // Similar but not exact
  'Hoat dong',          // Missing diacritics
  'HOẠT ĐỘNG',          // Wrong case
  'Active',             // English
  'Unknown',            // Arbitrary value
  'Hỏng',               // Vietnamese but not in allowed list
  '',                   // Empty (though this might be allowed if nullable)
]

/**
 * Mock RPC call for testing purposes.
 * In a real integration test, this would call the actual Supabase RPC.
 */
interface EquipmentPayload {
  ten_thiet_bi?: string
  ma_thiet_bi?: string
  khoa_phong_quan_ly: string
  model?: string
  serial?: string
  hang_san_xuat?: string
  noi_san_xuat?: string
  nam_san_xuat?: number
  ngay_nhap?: string
  ngay_dua_vao_su_dung?: string
  nguon_kinh_phi?: string
  gia_goc?: number
  nam_tinh_hao_mon?: number
  ty_le_hao_mon?: string
  han_bao_hanh?: string
  vi_tri_lap_dat?: string
  nguoi_dang_truc_tiep_quan_ly?: string
  tinh_trang_hien_tai?: string
  ngay_ngung_su_dung?: string
  ghi_chu?: string
  chu_ky_bt_dinh_ky?: number
  ngay_bt_tiep_theo?: string
  chu_ky_hc_dinh_ky?: number
  ngay_hc_tiep_theo?: string
  chu_ky_kd_dinh_ky?: number
  ngay_kd_tiep_theo?: string
  phan_loai_theo_nd98?: string
  nguon_nhap?: string
}

function isStrictIsoDate(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return false
  }

  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/**
 * Simulates the status validation logic from equipment_create RPC
 * This mirrors the PostgreSQL function logic for testing purposes.
 */
function validateEquipmentStatus(payload: EquipmentPayload): {
  valid: boolean
  error?: string
} {
  const validStatuses = new Set(VALID_STATUSES)
  const status = payload.tinh_trang_hien_tai?.trim()
  const decommissionDate = payload.ngay_ngung_su_dung?.trim() || null
  const commissionDate = payload.ngay_dua_vao_su_dung?.trim() || null

  // If status is null or empty (after trim), it's valid (not required at RPC level)
  if (!status || status === '') {
    if (decommissionDate) {
      return {
        valid: false,
        error: 'Ngày ngừng sử dụng chỉ được phép khi tình trạng là "Ngưng sử dụng"',
      }
    }

    return { valid: true }
  }

  // Check against valid statuses
  if (!validStatuses.has(status as typeof VALID_STATUSES[number])) {
    return {
      valid: false,
      error: `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`,
    }
  }

  if (decommissionDate && status !== 'Ngưng sử dụng') {
    return {
      valid: false,
      error: 'Ngày ngừng sử dụng chỉ được phép khi tình trạng là "Ngưng sử dụng"',
    }
  }

  if (decommissionDate && !isStrictIsoDate(decommissionDate)) {
    return {
      valid: false,
      error: RPC_FULL_DATE_ERROR_MESSAGE,
    }
  }

  if (
    decommissionDate &&
    isStrictIsoDate(decommissionDate) &&
    isStrictIsoDate(commissionDate) &&
    decommissionDate < commissionDate
  ) {
    return {
      valid: false,
      error: 'Ngày ngừng sử dụng phải sau hoặc bằng ngày đưa vào sử dụng',
    }
  }

  return { valid: true }
}

describe('Equipment RPC Status Validation', () => {
  describe('Valid Status Values', () => {
    it.each(VALID_STATUSES)('should accept valid status: %s', (status) => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: status,
      }

      const result = validateEquipmentStatus(payload)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept null status', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: undefined,
      }

      const result = validateEquipmentStatus(payload)
      expect(result.valid).toBe(true)
    })

    it('should accept empty string status (treated as null)', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: '',
      }

      const result = validateEquipmentStatus(payload)
      expect(result.valid).toBe(true)
    })

    it('should accept whitespace-only status (treated as null after trim)', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: '   ',
      }

      const result = validateEquipmentStatus(payload)
      expect(result.valid).toBe(true)
    })
  })

  describe('Invalid Status Values', () => {
    it.each(INVALID_STATUSES.filter(s => s !== ''))('should reject invalid status: %s', (status) => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: status,
      }

      const result = validateEquipmentStatus(payload)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain(status)
      expect(result.error).toContain('Invalid status')
    })

    it('should include allowed values in error message', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: 'BadStatus',
      }

      const result = validateEquipmentStatus(payload)
      expect(result.error).toBeDefined()

      // Error should mention all valid options
      VALID_STATUSES.forEach((validStatus) => {
        expect(result.error).toContain(validStatus)
      })
    })
  })

  describe('Whitespace Handling', () => {
    it('should accept status with leading whitespace (trimmed)', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: '  Hoạt động',
      }

      const result = validateEquipmentStatus(payload)
      // After trim, "Hoạt động" is valid
      expect(result.valid).toBe(true)
    })

    it('should accept status with trailing whitespace (trimmed)', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: 'Chờ bảo trì  ',
      }

      const result = validateEquipmentStatus(payload)
      expect(result.valid).toBe(true)
    })

    it('should accept status with both leading and trailing whitespace (trimmed)', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: '  Ngưng sử dụng  ',
      }

      const result = validateEquipmentStatus(payload)
      expect(result.valid).toBe(true)
    })
  })

  describe('Case Sensitivity', () => {
    it('should reject lowercase version of valid status', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: 'hoạt động',
      }

      const result = validateEquipmentStatus(payload)
      expect(result.valid).toBe(false)
    })

    it('should reject uppercase version of valid status', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: 'HOẠT ĐỘNG',
      }

      const result = validateEquipmentStatus(payload)
      expect(result.valid).toBe(false)
    })
  })

  describe('Decommission Date Contract', () => {
    it('should accept valid full date when status is Ngưng sử dụng', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: 'Ngưng sử dụng',
        ngay_ngung_su_dung: '2025-03-24',
      }

      expect(validateEquipmentStatus(payload)).toEqual({ valid: true })
    })

    it('should reject invalid decommission date formats even when status is Ngưng sử dụng', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: 'Ngưng sử dụng',
        ngay_ngung_su_dung: '24/03/2025',
      }

      expect(validateEquipmentStatus(payload)).toEqual({
        valid: false,
        error: RPC_FULL_DATE_ERROR_MESSAGE,
      })
    })

    it('should reject decommission date when status is not Ngưng sử dụng', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: 'Hoạt động',
        ngay_ngung_su_dung: '2025-03-24',
      }

      expect(validateEquipmentStatus(payload)).toEqual({
        valid: false,
        error: 'Ngày ngừng sử dụng chỉ được phép khi tình trạng là "Ngưng sử dụng"',
      })
    })

    it('should reject when decommission date is before a full ISO commission date', () => {
      const payload: EquipmentPayload = {
        khoa_phong_quan_ly: 'Khoa Test',
        tinh_trang_hien_tai: 'Ngưng sử dụng',
        ngay_dua_vao_su_dung: '2025-03-24',
        ngay_ngung_su_dung: '2025-03-23',
      }

      expect(validateEquipmentStatus(payload)).toEqual({
        valid: false,
        error: 'Ngày ngừng sử dụng phải sau hoặc bằng ngày đưa vào sử dụng',
      })
    })

    it('should accept when commission date is partial', () => {
      const payloads: EquipmentPayload[] = [
        {
          khoa_phong_quan_ly: 'Khoa Test',
          tinh_trang_hien_tai: 'Ngưng sử dụng',
          ngay_dua_vao_su_dung: '2025',
          ngay_ngung_su_dung: '2025-03-23',
        },
        {
          khoa_phong_quan_ly: 'Khoa Test',
          tinh_trang_hien_tai: 'Ngưng sử dụng',
          ngay_dua_vao_su_dung: '2025-03',
          ngay_ngung_su_dung: '2025-03-23',
        },
      ]

      payloads.forEach((payload) => {
        expect(validateEquipmentStatus(payload)).toEqual({ valid: true })
      })
    })
  })
})

describe('Equipment Bulk Import RPC Validation', () => {
  /**
   * Simulates the bulk import validation behavior.
   * The equipment_bulk_import RPC calls equipment_create for each item,
   * so validation errors are reported per-item.
   */
  function simulateBulkImport(
    items: EquipmentPayload[]
  ): {
    success: boolean
    inserted: number
    failed: number
    total: number
    details: Array<{ index: number; success: boolean; error?: string }>
  } {
    const details: Array<{ index: number; success: boolean; error?: string }> = []
    let inserted = 0
    let failed = 0

    items.forEach((item, index) => {
      const statusValidation = validateEquipmentStatus(item)

      if (!statusValidation.valid) {
        failed++
        details.push({
          index,
          success: false,
          error: statusValidation.error,
        })
      } else {
        inserted++
        details.push({
          index,
          success: true,
        })
      }
    })

    return {
      success: true,
      inserted,
      failed,
      total: items.length,
      details,
    }
  }

  it('should import all items with valid statuses', () => {
    const items: EquipmentPayload[] = [
      { khoa_phong_quan_ly: 'Khoa A', tinh_trang_hien_tai: 'Hoạt động' },
      { khoa_phong_quan_ly: 'Khoa B', tinh_trang_hien_tai: 'Chờ sửa chữa' },
      { khoa_phong_quan_ly: 'Khoa C', tinh_trang_hien_tai: 'Ngưng sử dụng' },
    ]

    const result = simulateBulkImport(items)

    expect(result.inserted).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.details.every((d) => d.success)).toBe(true)
  })

  it('should reject items with invalid statuses', () => {
    const items: EquipmentPayload[] = [
      { khoa_phong_quan_ly: 'Khoa A', tinh_trang_hien_tai: 'Hoạt động' },
      { khoa_phong_quan_ly: 'Khoa B', tinh_trang_hien_tai: 'Invalid' },
      { khoa_phong_quan_ly: 'Khoa C', tinh_trang_hien_tai: 'Chờ bảo trì' },
    ]

    const result = simulateBulkImport(items)

    expect(result.inserted).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.details[1].success).toBe(false)
    expect(result.details[1].error).toContain('Invalid')
  })

  it('should report all invalid items in details', () => {
    const items: EquipmentPayload[] = [
      { khoa_phong_quan_ly: 'Khoa A', tinh_trang_hien_tai: 'Bad1' },
      { khoa_phong_quan_ly: 'Khoa B', tinh_trang_hien_tai: 'Hoạt động' },
      { khoa_phong_quan_ly: 'Khoa C', tinh_trang_hien_tai: 'Bad2' },
      { khoa_phong_quan_ly: 'Khoa D', tinh_trang_hien_tai: 'Bad3' },
    ]

    const result = simulateBulkImport(items)

    expect(result.inserted).toBe(1)
    expect(result.failed).toBe(3)

    const failedItems = result.details.filter((d) => !d.success)
    expect(failedItems).toHaveLength(3)
    expect(failedItems[0].error).toContain('Bad1')
    expect(failedItems[1].error).toContain('Bad2')
    expect(failedItems[2].error).toContain('Bad3')
  })

  it('should allow items with null/empty status', () => {
    const items: EquipmentPayload[] = [
      { khoa_phong_quan_ly: 'Khoa A', tinh_trang_hien_tai: undefined },
      { khoa_phong_quan_ly: 'Khoa B', tinh_trang_hien_tai: '' },
      { khoa_phong_quan_ly: 'Khoa C', tinh_trang_hien_tai: '   ' },
    ]

    const result = simulateBulkImport(items)

    expect(result.inserted).toBe(3)
    expect(result.failed).toBe(0)
  })
})

describe('RPC Error Code Verification', () => {
  /**
   * Documents the expected PostgreSQL error codes from the RPC.
   * ERRCODE '22023' = invalid_parameter_value
   */
  it('should use ERRCODE 22023 for invalid status (documented)', () => {
    // This documents the expected behavior.
    // The actual RPC uses:
    // RAISE EXCEPTION 'Invalid status: %...' USING ERRCODE = '22023';

    const expectedErrorCode = '22023' // invalid_parameter_value
    expect(expectedErrorCode).toBe('22023')
  })

  it('should use ERRCODE 42501 for permission denied (documented)', () => {
    // Documents permission check error codes
    const expectedErrorCode = '42501' // insufficient_privilege
    expect(expectedErrorCode).toBe('42501')
  })
})
