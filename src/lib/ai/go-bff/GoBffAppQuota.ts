/**
 * App-quota client shape retained for callers that already have a local quota
 * decision. Provider quota is a separate protocol error.
 */
export interface GoBffAppQuotaPayload {
  code: "ai_usage_limited"
  reason: string
  message: string
  retryAfterMs: number
}

/** Builds the app-quota payload without changing provider_quota semantics. */
export function mapUnusedAppQuotaPayload(retryAfterMs: number): GoBffAppQuotaPayload {
  return {
    code: "ai_usage_limited",
    reason: "quota",
    message: "Anh/chị đã dùng hết lượt trợ lý trong kỳ này.",
    retryAfterMs,
  }
}
