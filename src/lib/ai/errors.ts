/**
 * AI error sanitization utilities.
 * Deny-by-default: unexpected errors always produce a generic client message.
 * The raw error text is only used for server-side logging.
 */

export const GENERIC_CHAT_ERROR_MESSAGE = 'Đã xảy ra lỗi. Vui lòng thử lại.'

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
  return GENERIC_CHAT_ERROR_MESSAGE
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

  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.error === 'string') {
      return parsed.error
    }
  } catch {
    // Not JSON — use raw string
  }

  return raw
}
