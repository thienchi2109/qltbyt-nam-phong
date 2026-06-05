/** Converts an empty input string to null and numeric input to a number. */
export function toNullableNumber(value: string): number | null {
  return value === "" ? null : Number(value)
}
