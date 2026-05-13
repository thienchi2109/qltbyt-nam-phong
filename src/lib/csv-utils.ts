const FORMULA_PREFIX_PATTERN = /^[\s\u0000-\u001F]*[=+\-@]/

function stringifyCsvValue(value: unknown): string {
  if (value == null) return ""
  if (typeof value !== "object") return String(value)

  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return String(value)
  }
}

export function escapeCsvCell(value: unknown): string {
  const raw = stringifyCsvValue(value)
  const hardened = FORMULA_PREFIX_PATTERN.test(raw) ? `'${raw}` : raw

  return `"${hardened.replace(/"/g, '""')}"`
}

export function buildCsvContent<T extends object>(data: T[], headers: string[]): string {
  return [
    headers.map((header) => escapeCsvCell(header)).join(","),
    ...data.map((row) => {
      const rowRecord = row as Record<string, unknown>
      return headers.map((header) => escapeCsvCell(rowRecord[header])).join(",")
    }),
  ].join("\n")
}
