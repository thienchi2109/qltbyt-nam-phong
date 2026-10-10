/**
 * Tests for equipment import status validation.
 *
 * Validates that the equipment import function:
 * 1. Accepts all valid status values
 * 2. Rejects invalid status values with clear error messages
 * 3. Handles edge cases (whitespace, empty strings, null)
 */

import { describe, it, expect } from "vitest"
import { validateEquipmentData, REQUIRED_FIELDS } from "@/components/import-equipment-dialog"

const equipmentStatusOptions = [
  "Hoạt động",
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng",
]

type Equipment = {
  ma_thiet_bi?: string
  ten_thiet_bi?: string
  khoa_phong_quan_ly?: string
  nguoi_dang_truc_tiep_quan_ly?: string
  tinh_trang_hien_tai?: string
  vi_tri_lap_dat?: string
  ngay_ngung_su_dung?: string | null
  [key: string]: unknown
}

describe("Multiple Rows Validation", () => {
  it("should validate all rows and report all errors", () => {
    const data: Partial<Equipment>[] = [
      {
        khoa_phong_quan_ly: "Khoa Nội",
        nguoi_dang_truc_tiep_quan_ly: "Nguyễn Văn A",
        tinh_trang_hien_tai: "InvalidStatus1",
        vi_tri_lap_dat: "Phòng 101",
      },
      {
        khoa_phong_quan_ly: "Khoa Ngoại",
        nguoi_dang_truc_tiep_quan_ly: "Trần Thị B",
        tinh_trang_hien_tai: "Hoạt động", // Valid
        vi_tri_lap_dat: "Phòng 202",
      },
      {
        khoa_phong_quan_ly: "Khoa Tim",
        nguoi_dang_truc_tiep_quan_ly: "Lê Văn C",
        tinh_trang_hien_tai: "InvalidStatus2",
        vi_tri_lap_dat: "Phòng 303",
      },
    ]

    const result = validateEquipmentData(data, equipmentStatusOptions)
    expect(result.isValid).toBe(false)
    // Should have 2 invalid status errors
    const statusErrors = result.errors.filter((e) => e.includes("không hợp lệ"))
    expect(statusErrors).toHaveLength(2)
    expect(statusErrors[0]).toContain("Dòng 2")
    expect(statusErrors[0]).toContain("InvalidStatus1")
    expect(statusErrors[1]).toContain("Dòng 4")
    expect(statusErrors[1]).toContain("InvalidStatus2")
  })

  it("should pass validation when all rows have valid statuses", () => {
    const data: Partial<Equipment>[] = [
      {
        khoa_phong_quan_ly: "Khoa Nội",
        nguoi_dang_truc_tiep_quan_ly: "A",
        tinh_trang_hien_tai: "Hoạt động",
        vi_tri_lap_dat: "P1",
      },
      {
        khoa_phong_quan_ly: "Khoa Ngoại",
        nguoi_dang_truc_tiep_quan_ly: "B",
        tinh_trang_hien_tai: "Chờ sửa chữa",
        vi_tri_lap_dat: "P2",
      },
      {
        khoa_phong_quan_ly: "Khoa Tim",
        nguoi_dang_truc_tiep_quan_ly: "C",
        tinh_trang_hien_tai: "Ngưng sử dụng",
        vi_tri_lap_dat: "P3",
      },
    ]

    const result = validateEquipmentData(data, equipmentStatusOptions)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

describe("Row Number in Error Message", () => {
  it("should report Excel row number (index + 2 for header)", () => {
    const data: Partial<Equipment>[] = [
      {
        khoa_phong_quan_ly: "Khoa Nội",
        nguoi_dang_truc_tiep_quan_ly: "A",
        tinh_trang_hien_tai: "Hoạt động",
        vi_tri_lap_dat: "P1",
      },
      {
        khoa_phong_quan_ly: "Khoa Ngoại",
        nguoi_dang_truc_tiep_quan_ly: "B",
        tinh_trang_hien_tai: "Hoạt động",
        vi_tri_lap_dat: "P2",
      },
      {
        khoa_phong_quan_ly: "Khoa Tim",
        nguoi_dang_truc_tiep_quan_ly: "C",
        tinh_trang_hien_tai: "BadStatus", // This is row 4 in Excel (index 2 + 2)
        vi_tri_lap_dat: "P3",
      },
    ]

    const result = validateEquipmentData(data, equipmentStatusOptions)
    expect(result.errors[0]).toContain("Dòng 4")
  })
})

describe("Required Fields Validation", () => {
  it("should detect multiple missing required fields", () => {
    const data: Partial<Equipment>[] = [
      {
        // Missing all required fields
      },
    ]

    const result = validateEquipmentData(data, equipmentStatusOptions)
    expect(result.isValid).toBe(false)
    const missingError =
      result.errors.find((error) => error.includes(REQUIRED_FIELDS.khoa_phong_quan_ly)) ?? ""

    expect(missingError).not.toBe("")
    Object.values(REQUIRED_FIELDS).forEach((requiredField) => {
      expect(missingError).toContain(requiredField)
    })
  })

  it("should report both missing fields and invalid status", () => {
    const data: Partial<Equipment>[] = [
      {
        khoa_phong_quan_ly: "", // Missing
        nguoi_dang_truc_tiep_quan_ly: "Nguyễn Văn A",
        tinh_trang_hien_tai: "InvalidStatus", // Invalid
        vi_tri_lap_dat: "Phòng 101",
      },
    ]

    const result = validateEquipmentData(data, equipmentStatusOptions)
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
    expect(result.errors.some((e) => e.includes("không hợp lệ"))).toBe(true)
    expect(result.errors.some((e) => e.includes("Thiếu"))).toBe(true)
  })
})
