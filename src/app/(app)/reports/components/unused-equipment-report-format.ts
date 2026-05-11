const NUMBER_FORMATTER = new Intl.NumberFormat("vi-VN")

export function formatReportNumber(value: number) {
  return NUMBER_FORMATTER.format(value)
}

export function formatReportCurrency(value: number | null | undefined) {
  if (value == null) return "-"
  return `${NUMBER_FORMATTER.format(value)} đ`
}
