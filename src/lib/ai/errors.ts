/**
 * AI error sanitization utilities.
 * Deny-by-default: unexpected errors always produce a generic client message.
 * The raw error text is only used for server-side logging.
 */

export const GENERIC_CHAT_ERROR_MESSAGE = 'Đã xảy ra lỗi. Vui lòng thử lại.'
export const MODEL_PROVIDER_QUOTA_MESSAGE =
  'Model AI đang vượt hạn mức sử dụng của nhà cung cấp.'

const PROVIDER_QUOTA_PATTERNS = [
  /quota exceeded/i,
  /exceeded your current quota/i,
  /rate-limits/i,
  /generate_content_free_tier_requests/i,
]

const RETRY_IN_SECONDS_PATTERN = /retry in\s+([0-9]+(?:\.[0-9]+)?)s/i

const SAFE_JSON_ERROR_PATTERNS = [
  /^AI usage quota exceeded\b/i,
  /^Too many requests\b/i,
  /^Please select a facility\b/i,
  /^Unable to resolve facility context\b/i,
  /^Unauthorized$/i,
  /^Forbidden$/i,
  /^Invalid request payload$/i,
  /^Invalid messages payload$/i,
  /^Request exceeds\b/i,
  /^Model AI đang vượt hạn mức sử dụng của nhà cung cấp\./,
]

function formatProviderQuotaMessage(raw: string): string | null {
  if (!PROVIDER_QUOTA_PATTERNS.some(pattern => pattern.test(raw))) {
    return null
  }

  const retryMatch = raw.match(RETRY_IN_SECONDS_PATTERN)
  if (retryMatch) {
    const parsedSeconds = Number(retryMatch[1])
    if (Number.isFinite(parsedSeconds) && parsedSeconds > 0) {
      const retrySeconds = Math.max(1, Math.ceil(parsedSeconds))
      return `${MODEL_PROVIDER_QUOTA_MESSAGE} Vui lòng chờ khoảng ${retrySeconds} giây rồi thử lại.`
    }
  }

  return `${MODEL_PROVIDER_QUOTA_MESSAGE} Vui lòng thử lại sau hoặc liên hệ quản trị viên nếu lỗi tiếp diễn.`
}

function extractSafeClientMessage(raw: string): string | null {
  const providerQuotaMessage = formatProviderQuotaMessage(raw)
  if (providerQuotaMessage) {
    return providerQuotaMessage
  }

  if (SAFE_JSON_ERROR_PATTERNS.some(pattern => pattern.test(raw))) {
    return raw
  }

  return null
}

/**
 * Extract a string message from an unknown error value.
 * Used server-side for logging — never expose the return value to clients.
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

/**
 * Returns a safe, client-facing error message.
 *
 * Deny-by-default: always returns the generic Vietnamese message.
 * This function exists as a single chokepoint so that callers
 * never accidentally leak raw exception text to the client.
 */
export function sanitizeErrorForClient(_error: unknown): string {
  const raw = extractErrorMessage(_error)
  return extractSafeClientMessage(raw) ?? GENERIC_CHAT_ERROR_MESSAGE
}

/**
 * Client-side defense: extract a clean display message from a potentially
 * JSON-wrapped error string (e.g. '{"error":"msg"}' → 'msg').
 * Falls back to generic Vietnamese message if input is empty/falsy.
 */
export function parseErrorMessage(raw: string | undefined): string {
  if (!raw || raw.trim() === '') {
    return GENERIC_CHAT_ERROR_MESSAGE
  }

  const safeRawMessage = extractSafeClientMessage(raw)
  if (safeRawMessage) {
    return safeRawMessage
  }

  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.error === 'string' && parsed.error.trim() !== '') {
      return extractSafeClientMessage(parsed.error) ?? GENERIC_CHAT_ERROR_MESSAGE
    }
  } catch {
    // Not JSON — use raw string (already sanitized by server-side deny-by-default)
  }

  return raw
}
