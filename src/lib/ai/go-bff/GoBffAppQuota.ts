/**
 * Future app-quota client shape. Phase 2 does not call this from chat.
 * provider_quota must not be relabeled as ai_usage_limited.
 */
export interface GoBffAppQuotaPayload {
  code: "ai_usage_limited"
  reason: string
  message: string
  retryAfterMs: number
}

/** Builds the unused app-quota payload. Chat does not call this in Phase 2. */
export function mapUnusedAppQuotaPayload(retryAfterMs: number): GoBffAppQuotaPayload {
  return {
    code: "ai_usage_limited",
    reason: "quota",
    message: "Anh/chị đã dùng hết lượt trợ lý trong kỳ này.",
    retryAfterMs,
  }
}
