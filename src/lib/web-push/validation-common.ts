const DECIMAL = /^[1-9][0-9]*$/
const MAX_BIGINT = BigInt("9223372036854775807")

/** Narrows unknown JSON input to a non-array record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Checks that an object contains exactly the expected keys. */
export function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  )
}

/** Checks the version-one wire marker. */
export function versionIsOne(value: unknown): value is 1 {
  return typeof value === "number" && Number.isInteger(value) && value === 1
}

/** Parses a positive integer value into its canonical decimal string. */
export function parsePositiveBigint(value: unknown): string | null {
  if (typeof value !== "string" || !DECIMAL.test(value)) return null
  try {
    const parsed = BigInt(value)
    return parsed <= MAX_BIGINT ? value : null
  } catch {
    return null
  }
}
