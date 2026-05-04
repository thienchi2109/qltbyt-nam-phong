const SENSITIVE_LOG_KEYS = [
  "password",
  "token",
  "secret",
  "mat_khau",
  "p_password",
  "api_key",
  "apikey",
  "authorization",
  "credential",
] as const

function isPlainObject(value: object): value is Record<string, unknown> {
  return Object.getPrototypeOf(value) === Object.prototype
}

export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > 10) {
    return "[MAX_DEPTH]"
  }

  if (value === null || value === undefined) {
    return value
  }

  if (typeof value !== "object") {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, depth + 1))
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    }
  }

  if (!isPlainObject(value)) {
    return value
  }

  const sanitized: Record<string, unknown> = {}

  for (const [key, nestedValue] of Object.entries(value)) {
    const keyLower = key.toLowerCase()

    if (SENSITIVE_LOG_KEYS.some((sensitiveKey) => keyLower.includes(sensitiveKey))) {
      sanitized[key] = "[REDACTED]"
      continue
    }

    sanitized[key] =
      typeof nestedValue === "object" && nestedValue !== null
        ? sanitizeForLog(nestedValue, depth + 1)
        : nestedValue
  }

  return sanitized
}
