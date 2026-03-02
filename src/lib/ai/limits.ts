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

export const AI_MAX_OUTPUT_TOKENS = readPositiveIntEnv(
  'AI_MAX_OUTPUT_TOKENS',
  1024,
)
export const AI_MAX_TOOL_STEPS = readPositiveIntEnv('AI_MAX_TOOL_STEPS', 5)
export const AI_MAX_MESSAGES = readPositiveIntEnv('AI_MAX_MESSAGES', 40)
export const AI_MAX_INPUT_CHARS = readPositiveIntEnv('AI_MAX_INPUT_CHARS', 40_000)

export const AI_RATE_LIMIT_WINDOW_MS = readPositiveIntEnv(
  'AI_RATE_LIMIT_WINDOW_MS',
  60_000,
)
export const AI_RATE_LIMIT_MAX_REQUESTS = readPositiveIntEnv(
  'AI_RATE_LIMIT_MAX_REQUESTS',
  20,
)
export const AI_DAILY_USER_QUOTA_REQUESTS = readPositiveIntEnv(
  'AI_DAILY_USER_QUOTA_REQUESTS',
  300,
)
export const AI_DAILY_TENANT_QUOTA_REQUESTS = readPositiveIntEnv(
  'AI_DAILY_TENANT_QUOTA_REQUESTS',
  2_000,
)
