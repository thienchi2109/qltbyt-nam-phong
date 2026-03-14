/**
 * AI error sanitization utilities.
 * Ensures no sensitive information (API keys, file paths, stack traces)
 * leaks to the client.
 */

export const GENERIC_CHAT_ERROR_MESSAGE = 'Đã xảy ra lỗi. Vui lòng thử lại.'

/**
 * Patterns that indicate sensitive information in an error message.
 */
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]/i, // API keys
  /api[_-]?key/i, // API key references
  /secret/i, // Secret references
  /password/i, // Password references
  /[A-Z]:\\\\?[Uu]sers/i, // Windows file paths
  /\/home\//i, // Unix home paths
  /node_modules/i, // Node module paths
  /at\s+\S+\s+\(.*:\d+:\d+\)/i, // Stack trace frames
  /\.ts:\d+/i, // TypeScript file references
  /\.js:\d+/i, // JavaScript file references
]

/**
 * Extract a string message from an unknown error value.
 */
function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

/**
 * Returns a safe, client-facing error message.
 * If the error contains sensitive patterns, returns a generic Vietnamese message.
 * Otherwise returns the original message (which is assumed to be safe).
 */
export function sanitizeErrorForClient(error: unknown): string {
  const message = extractMessage(error)

  if (!message || message.trim() === '') {
    return GENERIC_CHAT_ERROR_MESSAGE
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
      return GENERIC_CHAT_ERROR_MESSAGE
    }
  }

  return message
}
