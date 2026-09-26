const protocolMessages = {
  invalid_request: "Yêu cầu không hợp lệ.",
  capability_unavailable: "Tính năng trợ lý này hiện không khả dụng.",
  unauthorized: "Anh/chị không có quyền thực hiện yêu cầu này.",
  limit_exceeded: "Yêu cầu vượt quá giới hạn cho phép.",
  provider_failure: "Bộ mô hình không hoàn tất được yêu cầu. Vui lòng thử lại sau.",
  provider_quota: "Nhà cung cấp mô hình đang tạm thời quá tải. Vui lòng thử lại sau.",
  cancelled: "Yêu cầu đã được hủy.",
  tool_limit: "Yêu cầu vượt quá giới hạn sử dụng công cụ.",
} as const

export type GoProtocolErrorCode = keyof typeof protocolMessages

const fallbackCode: GoProtocolErrorCode = "invalid_request"
const requestIDPattern = /^[A-Za-z0-9._:-]{1,128}$/

export interface GoProtocolErrorBody {
  status?: unknown
  code?: unknown
  message?: unknown
  retryable?: unknown
  details?: unknown
  retry_after_ms?: unknown
  request_id?: unknown
}

export interface TranslatedGoProtocolError {
  httpStatus: number
  statusText: string
  headers: { "X-Request-ID": string }
  body: {
    error: {
      code: GoProtocolErrorCode
      message: string
      retryable: boolean
      requestId: string
    }
  }
}

export interface MappedGoAppQuotaError {
  status: 429
  requestId: string
  retryAfterSeconds: number
  body: {
    error: {
      code: "ai_usage_limited"
      reason: string
      message: string
      retryAfterMs: number
    }
  }
}

function isProtocolCode(value: unknown): value is GoProtocolErrorCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(protocolMessages, value)
}

function safeRequestID(value: unknown): string {
  return typeof value === "string" && requestIDPattern.test(value) ? value : ""
}

function httpStatusFor(code: GoProtocolErrorCode, status: unknown): number {
  if (typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599) {
    return status
  }
  switch (code) {
    case "unauthorized":
      return 401
    case "capability_unavailable":
      return 404
    case "limit_exceeded":
    case "tool_limit":
      return 400
    case "provider_quota":
      return 503
    case "provider_failure":
      return 502
    case "cancelled":
      return 499
    default:
      return 400
  }
}

function safeRetryAfterMs(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(Math.floor(value), 86_400_000)
    : 60_000
}

/** Maps the QLTBYT application quota boundary to the existing browser contract. */
export function mapGoAppQuotaError(
  payload: GoProtocolErrorBody,
  headerRequestID?: string | null
): MappedGoAppQuotaError | null {
  if (payload.code !== "limit_exceeded" || payload.status !== 429) {
    return null
  }
  const requestId = safeRequestID(headerRequestID) || safeRequestID(payload.request_id)
  const retryAfterMs = safeRetryAfterMs(payload.retry_after_ms)
  return {
    status: 429,
    requestId,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    body: {
      error: {
        code: "ai_usage_limited",
        reason: "quota",
        message: "Anh/chị đã dùng hết lượt trợ lý trong kỳ này.",
        retryAfterMs,
      },
    },
  }
}

/**
 * Maps a Go protocol error into a BFF response.
 * The Vietnamese message is fixed per code. Upstream message text and details are dropped.
 * provider_quota stays provider_quota; app quota is handled by mapGoAppQuotaError.
 */
export function translateGoProtocolError(
  payload: GoProtocolErrorBody,
  headerRequestID?: string | null
): TranslatedGoProtocolError {
  const code = isProtocolCode(payload.code) ? payload.code : fallbackCode
  const message = protocolMessages[code]
  const requestId = safeRequestID(headerRequestID) || safeRequestID(payload.request_id)
  return {
    httpStatus: httpStatusFor(code, payload.status),
    statusText: message,
    headers: { "X-Request-ID": requestId },
    body: {
      error: {
        code,
        message,
        retryable: payload.retryable === true,
        requestId,
      },
    },
  }
}
