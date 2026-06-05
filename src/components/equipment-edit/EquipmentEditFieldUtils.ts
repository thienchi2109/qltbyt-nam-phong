/** Converts an empty input string to null and numeric input to a number. */
export function toNullableNumber(value: string): number | null {
  if (value === "") return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
