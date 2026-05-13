import { z } from "zod"

/**
 * Parse a YYYY-MM-DD date string as a local date (not UTC).
 * Using new Date("2024-01-15") parses as UTC midnight, which can shift
 * the day in non-UTC timezones. This function creates a local date.
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number)
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return new Date(Number.NaN)
  }

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return new Date(Number.NaN)
  }

  return date
}

export const decisionFormSchema = z.object({
  so_quyet_dinh: z.string().min(1, "Số quyết định không được để trống"),
  ngay_ban_hanh: z.date({
    required_error: "Vui lòng chọn ngày ban hành",
  }),
  ngay_hieu_luc: z.date({
    required_error: "Vui lòng chọn ngày hiệu lực",
  }),
  ngay_het_hieu_luc: z.date().optional().nullable(),
  nguoi_ky: z.string().min(1, "Người ký không được để trống"),
  chuc_vu_nguoi_ky: z.string().min(1, "Chức vụ người ký không được để trống"),
  ghi_chu: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.ngay_hieu_luc && data.ngay_ban_hanh) {
      return data.ngay_hieu_luc >= data.ngay_ban_hanh
    }
    return true
  },
  {
    message: "Ngày hiệu lực phải sau hoặc bằng ngày ban hành",
    path: ["ngay_hieu_luc"],
  }
).refine(
  (data) => {
    if (data.ngay_het_hieu_luc && data.ngay_hieu_luc) {
      return data.ngay_het_hieu_luc > data.ngay_hieu_luc
    }
    return true
  },
  {
    message: "Ngày hết hiệu lực phải sau ngày hiệu lực",
    path: ["ngay_het_hieu_luc"],
  }
)

export type DecisionFormValues = z.infer<typeof decisionFormSchema>
