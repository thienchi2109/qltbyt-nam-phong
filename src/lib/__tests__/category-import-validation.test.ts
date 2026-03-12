import { describe, expect, it } from "vitest"

import { validateParsedRows } from "@/lib/category-import-validation"

describe("category-import-validation", () => {
  it("rejects dinh_muc_toi_da = 0 when quota value is provided", () => {
    const { validRows, errors } = validateParsedRows(
      [
        {
          ma_nhom: "01",
          ten_nhom: "May X quang",
          dinh_muc_toi_da: 0,
        },
      ],
      new Set<string>()
    )

    expect(validRows).toHaveLength(0)
    expect(errors.some((err) => err.includes("Dinh muc phai la so nguyen > 0"))).toBe(true)
  })

  it("accepts positive dinh_muc_toi_da values", () => {
    const { validRows, errors } = validateParsedRows(
      [
        {
          ma_nhom: "01",
          ten_nhom: "May X quang",
          dinh_muc_toi_da: 2,
          toi_thieu: 1,
        },
      ],
      new Set<string>()
    )

    expect(errors).toHaveLength(0)
    expect(validRows).toHaveLength(1)
    expect(validRows[0].dinh_muc_toi_da).toBe(2)
    expect(validRows[0].toi_thieu).toBe(1)
  })

  it("keeps quota optional when columns are empty", () => {
    const { validRows, errors } = validateParsedRows(
      [
        {
          ma_nhom: "01",
          ten_nhom: "May X quang",
        },
      ],
      new Set<string>()
    )

    expect(errors).toHaveLength(0)
    expect(validRows).toHaveLength(1)
    expect(validRows[0].dinh_muc_toi_da).toBeNull()
    expect(validRows[0].toi_thieu).toBeNull()
  })
})
