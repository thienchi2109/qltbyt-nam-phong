export class SuggestionRouteError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function parseStructuredDetails(details: unknown): unknown {
  if (typeof details !== "string") return details
  try {
    return JSON.parse(details) as unknown
  } catch {
    return details
  }
}

export function getPayloadMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback
  const record = payload as Record<string, unknown>
  for (const key of ["message", "details", "hint"]) {
    const value = record[key]
    if (typeof value === "string" && value.trim() !== "") return value
  }
  return fallback
}

export function getPayloadDetails(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined
  const record = payload as Record<string, unknown>
  return parseStructuredDetails(record.details)
}
