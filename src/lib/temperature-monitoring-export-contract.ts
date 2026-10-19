import { z } from "zod"

const calendarDate = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return (
      value.slice(0, 4) !== "0000" &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    )
  }, "Ngày không hợp lệ")

/** Validate recorded-reading filters within one calendar year, independently of the UI cap. */
export const temperatureExportSchema = z
  .object({
    from: calendarDate,
    to: calendarDate,
    equipment: z.number().int().positive().safe().nullable().optional(),
    shift: z.string().trim().min(1).max(100).optional(),
    status: z.enum(["Đã ghi", "Chờ xác nhận", "Bất thường"]).optional(),
  })
  .strict()
  .refine((value) => value.from <= value.to && value.from.slice(0, 4) === value.to.slice(0, 4), {
    message: "Mỗi lần xuất chỉ chọn ngày trong cùng một năm. Các năm khác xuất riêng.",
  })

export type TemperatureExportFilter = z.infer<typeof temperatureExportSchema>
/** Maximum completed XLSX size, enforced while writing and downloading. */
export const TEMPERATURE_EXPORT_MAX_BYTES = 25 * 1024 * 1024
/** Maximum total data rows across all export worksheets. */
export const TEMPERATURE_EXPORT_MAX_ROWS = 100_000
/** Ordered export datasets, with reading membership established before related history. */
export const TEMPERATURE_EXPORT_DATASETS = [
  "readings",
  "amendments",
  "reading_events",
  "deviations",
  "deviation_events",
] as const
/** Workbook disclosure of current page state and the absence of a transaction snapshot. */
export const TEMPERATURE_EXPORT_CONSISTENCY =
  "Bản ghi đã nhập; thành viên được chọn một lần. Trạng thái và dữ liệu liên quan được đọc tại từng trang, có thể thay đổi khi đang xuất; không phải snapshot giao dịch."
