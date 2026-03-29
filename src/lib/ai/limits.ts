function readPositiveIntEnv(name: string, fallback: number): number {
  const rawValue = process.env[name]
  if (!rawValue) {
    return fallback
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return parsed
}

/** 2048 tokens ≈ đủ cho bảng 12-tháng + giải thích bằng tiếng Việt */
export const AI_MAX_OUTPUT_TOKENS = readPositiveIntEnv(
  'AI_MAX_OUTPUT_TOKENS',
  2048,
)
export const AI_MAX_TOOL_STEPS = readPositiveIntEnv('AI_MAX_TOOL_STEPS', 5)
export const AI_MAX_MESSAGES = readPositiveIntEnv('AI_MAX_MESSAGES', 40)
/**
 * Phase 0 mitigation (Batch 1): raised from 40K to 120K to stop
 * "Request exceeds input size limit" errors caused by envelope-wrapped
 * tool outputs being larger than raw outputs.
 * Between Batch 1 and Batch 3 the effective hard limit is 120K.
 * Once Batch 3 wires compaction, AI_MAX_COMPACTED_INPUT_CHARS (40K)
 * becomes the steady-state ceiling and this raw budget only guards
 * against malformed / oversized client payloads.
 */
export const AI_MAX_INPUT_CHARS = readPositiveIntEnv('AI_MAX_INPUT_CHARS', 120_000)
/** Compacted model-context budget — enforced in Batch 3 (transport + server). */
export const AI_MAX_COMPACTED_INPUT_CHARS = readPositiveIntEnv(
  'AI_MAX_COMPACTED_INPUT_CHARS',
  40_000,
)

export const AI_RATE_LIMIT_WINDOW_MS = readPositiveIntEnv(
  'AI_RATE_LIMIT_WINDOW_MS',
  60_000,
)
/** 10 req/phút đủ cho internal tool; chặn abuse mà không ảnh hưởng UX */
export const AI_RATE_LIMIT_MAX_REQUESTS = readPositiveIntEnv(
  'AI_RATE_LIMIT_MAX_REQUESTS',
  10,
)
/** 150 req/ngày/user: đủ cho power user (~5 req/lần × 30 lần/ngày) */
export const AI_DAILY_USER_QUOTA_REQUESTS = readPositiveIntEnv(
  'AI_DAILY_USER_QUOTA_REQUESTS',
  150,
)
/** 1500 req/ngày/tenant: sweet spot cho 10-20 active users */
export const AI_DAILY_TENANT_QUOTA_REQUESTS = readPositiveIntEnv(
  'AI_DAILY_TENANT_QUOTA_REQUESTS',
  1_500,
)

// ---------------------------------------------------------------------------
// Budget measurement
// ---------------------------------------------------------------------------

/**
 * Estimates the character count of a serialized messages payload.
 * Returns MAX_SAFE_INTEGER on serialization failure as a safe upper-bound.
 */
export function calculateInputChars(messages: unknown[]): number {
  try {
    return JSON.stringify(messages).length
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}

