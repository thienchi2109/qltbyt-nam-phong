const FORMULA_PREFIX_PATTERN = /^[=+\-@]/

export function escapeCsvCell(value: unknown): string {
  const raw =
    value == null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value)
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
