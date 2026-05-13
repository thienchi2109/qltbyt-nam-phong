const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh"

type DateInput = string | number | Date | null | undefined

const vietnamDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VIETNAM_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const vietnamDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VIETNAM_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

function parseDisplayDateInput(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function partsToRecord(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  return parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value
    return acc
  }, {})
}

export function formatVietnamDateTime(value: DateInput, fallback = "-"): string {
  const date = parseDisplayDateInput(value)
  if (!date) return fallback

  const parts = partsToRecord(vietnamDateTimeFormatter.formatToParts(date))
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`
}

export function formatVietnamDate(value: DateInput, fallback = "-"): string {
  const date = parseDisplayDateInput(value)
  if (!date) return fallback

  const parts = partsToRecord(vietnamDateFormatter.formatToParts(date))
  return `${parts.day}/${parts.month}/${parts.year}`
}
