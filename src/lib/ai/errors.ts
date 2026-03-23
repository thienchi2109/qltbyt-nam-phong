/**
 * AI error sanitization utilities.
 * Deny-by-default: unexpected errors always produce a generic client message.
 * The raw error text is only used for server-side logging.
 */

export const GENERIC_CHAT_ERROR_MESSAGE = 'Đã xảy ra lỗi. Vui lòng thử lại.'
export const MODEL_PROVIDER_QUOTA_MESSAGE =
  'Model AI đang vượt hạn mức sử dụng của nhà cung cấp.'
const UNSUPPORTED_AI_PROVIDER_PATTERN = /^Unsupported AI provider:\s*([a-z0-9_-]+)\b/i
const MISSING_GROQ_MODEL_CONFIGURATION_PATTERN =
  /^Missing Groq model configuration: set GROQ_MODEL\b/i

const PROVIDER_QUOTA_PATTERNS = [
  /exceeded your current quota/i,
  /quota exceeded for metric/i,
  /rate-limits/i,
  /generate_content_free_tier_requests/i,
]

const RETRY_IN_SECONDS_PATTERN = /retry in\s+([0-9]+(?:\.[0-9]+)?)s/i

const SAFE_CLIENT_MESSAGE_RULES: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /^AI usage quota exceeded for this user\b/i,
    message: 'AI usage quota exceeded for this user.',
  },
  {
    pattern: /^AI usage quota exceeded for this facility\b/i,
    message: 'AI usage quota exceeded for this facility.',
  },
  {
    pattern: /^Too many requests\. Please try again later\b/i,
    message: 'Too many requests. Please try again later.',
  },
  {
    pattern: /^Please select a facility before using assistant tools\b/i,
    message: 'Please select a facility before using assistant tools.',
  },
  {
    pattern: /^Unable to resolve facility context for tool execution\b/i,
    message: 'Unable to resolve facility context for tool execution.',
  },
  { pattern: /^Unauthorized\b/i, message: 'Unauthorized' },
  { pattern: /^Forbidden\b/i, message: 'Forbidden' },
  { pattern: /^Invalid request payload\b/i, message: 'Invalid request payload' },
  { pattern: /^Invalid messages payload\b/i, message: 'Invalid messages payload' },
  {
    pattern: /^Request exceeds message limit\b/i,
    message: 'Request exceeds message limit',
  },
  {
    pattern: /^Request exceeds input size limit\b/i,
    message: 'Request exceeds input size limit',
  },
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

/**
 * Returns `true` if the error looks like a provider quota/rate-limit error.
 * Used by the chat route to decide whether to attempt API-key rotation.
 */
export function isProviderQuotaError(error: unknown): boolean {
  const raw = extractErrorMessage(error)
  return PROVIDER_QUOTA_PATTERNS.some(pattern => pattern.test(raw))
}

function extractSafeClientMessage(raw: string): string | null {
  for (const rule of SAFE_CLIENT_MESSAGE_RULES) {
    if (rule.pattern.test(raw)) {
      return rule.message
    }
  }

  if (raw.startsWith(MODEL_PROVIDER_QUOTA_MESSAGE)) {
    const retryMatch = raw.match(/khoảng\s+(\d+)\s+giây/i)
    if (retryMatch) {
      return `${MODEL_PROVIDER_QUOTA_MESSAGE} Vui lòng chờ khoảng ${retryMatch[1]} giây rồi thử lại.`
    }

    return `${MODEL_PROVIDER_QUOTA_MESSAGE} Vui lòng thử lại sau hoặc liên hệ quản trị viên nếu lỗi tiếp diễn.`
  }

  return formatProviderQuotaMessage(raw)
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

export function sanitizeProviderConfigurationError(error: unknown): string {
  const raw = extractErrorMessage(error)
  const unsupportedProviderMatch = raw.match(UNSUPPORTED_AI_PROVIDER_PATTERN)
  if (unsupportedProviderMatch) {
    return `Unsupported AI provider: ${unsupportedProviderMatch[1].toLowerCase()}`
  }

  if (MISSING_GROQ_MODEL_CONFIGURATION_PATTERN.test(raw)) {
    return 'Missing Groq model configuration: set GROQ_MODEL'
  }

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

  return GENERIC_CHAT_ERROR_MESSAGE
}
