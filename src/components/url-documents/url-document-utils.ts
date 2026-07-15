export type ParsedAbsoluteUrl = Readonly<{
  raw: string
  protocol: string
}>

/** Parses an absolute URL while preserving the exact input string as `raw`. */
export function parseAbsoluteUrl(value: string): ParsedAbsoluteUrl | null {
  if (/[\t\r\n]/.test(value)) return null

  try {
    const parsed = new URL(value)
    return {
      raw: value,
      protocol: parsed.protocol,
    }
  } catch {
    return null
  }
}

/** Checks whether a parsed URL satisfies the shared HTTP(S) document policy. */
export function isAllowedDocumentUrl(
  parsed: ParsedAbsoluteUrl | null
): parsed is ParsedAbsoluteUrl & { protocol: "http:" | "https:" } {
  return (
    parsed !== null &&
    /^https?:\/\//i.test(parsed.raw) &&
    !parsed.raw.includes("\\") &&
    (parsed.protocol === "http:" || parsed.protocol === "https:")
  )
}
