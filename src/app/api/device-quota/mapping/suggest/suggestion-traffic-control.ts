import { SuggestionRouteError } from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import type {
  SuggestionAccessUser,
  SuggestionProvider,
  SuggestionProviderResult,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

type CacheEntry = {
  expiresAt: number
  value: SuggestionProviderResult
}

type ThrottleEntry = {
  lastStartedAt: number
  startedAt: number[]
}

const resultCache = new Map<string, CacheEntry>()
const throttleEntries = new Map<string, ThrottleEntry>()
let vmFailureTimestamps: number[] = []
let vmCircuitOpenedUntil = 0

function parseInteger(value: string | undefined, fallback: number, allowZero = false): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  if (allowZero ? parsed >= 0 : parsed > 0) return parsed
  return fallback
}

function now(): number {
  return Date.now()
}

function getUserKey(user: SuggestionAccessUser): string {
  return user.id ? String(user.id) : "anonymous"
}

export function createSuggestionRuntimeKey({
  dataSignature,
  donViId,
  provider,
  user,
}: {
  dataSignature?: string
  donViId: number
  provider: SuggestionProvider
  user: SuggestionAccessUser
}): string {
  return `${provider}:${getUserKey(user)}:${donViId}:${dataSignature ?? "none"}`
}

export function getCachedSuggestionResult(key: string): SuggestionProviderResult | null {
  const entry = resultCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= now()) {
    resultCache.delete(key)
    return null
  }
  resultCache.delete(key)
  resultCache.set(key, entry)
  return entry.value
}

export function cacheSuggestionResult(key: string, value: SuggestionProviderResult): void {
  const ttlMs = parseInteger(process.env.DEVICE_QUOTA_SUGGESTION_RESULT_CACHE_TTL_MS, 60000, true)
  if (ttlMs <= 0) return
  const maxEntries = parseInteger(process.env.DEVICE_QUOTA_SUGGESTION_RESULT_CACHE_MAX_ENTRIES, 200)
  resultCache.delete(key)
  while (resultCache.size >= maxEntries) {
    const oldest = resultCache.keys().next().value
    if (typeof oldest !== "string") break
    resultCache.delete(oldest)
  }
  resultCache.set(key, {
    expiresAt: now() + ttlMs,
    value,
  })
}

export function enforceSuggestionThrottle(key: string): void {
  const current = now()
  const cooldownMs = parseInteger(process.env.DEVICE_QUOTA_SUGGESTION_COOLDOWN_MS, 10000, true)
  const rateLimitMax = parseInteger(process.env.DEVICE_QUOTA_SUGGESTION_RATE_LIMIT_MAX, 3)
  const rateLimitWindowMs = parseInteger(
    process.env.DEVICE_QUOTA_SUGGESTION_RATE_LIMIT_WINDOW_MS,
    60000,
  )
  const entry = throttleEntries.get(key) ?? { lastStartedAt: 0, startedAt: [] }
  const windowStart = current - rateLimitWindowMs

  for (const [entryKey, existing] of throttleEntries.entries()) {
    const hasRecentStarts = existing.startedAt.some((timestamp) => timestamp > windowStart)
    const hasRecentCooldown = cooldownMs > 0 && current - existing.lastStartedAt < cooldownMs
    if (!hasRecentStarts && !hasRecentCooldown) {
      throttleEntries.delete(entryKey)
    }
  }

  if (cooldownMs > 0 && current - entry.lastStartedAt < cooldownMs) {
    throw new SuggestionRouteError("Suggestion request cooldown is active", 429, {
      retryAfterMs: cooldownMs - (current - entry.lastStartedAt),
    })
  }

  entry.startedAt = entry.startedAt.filter((timestamp) => timestamp > windowStart)
  if (entry.startedAt.length >= rateLimitMax) {
    throw new SuggestionRouteError("Suggestion request rate limit exceeded", 429, {
      windowMs: rateLimitWindowMs,
      max: rateLimitMax,
    })
  }

  entry.lastStartedAt = current
  entry.startedAt.push(current)
  throttleEntries.set(key, entry)
}

export function assertVmCircuitClosed(): void {
  const current = now()
  if (vmCircuitOpenedUntil > current) {
    throw new SuggestionRouteError("VM suggestion provider circuit is open", 503, {
      retryAfterMs: vmCircuitOpenedUntil - current,
    })
  }
}

export function recordVmSuccess(): void {
  vmFailureTimestamps = []
  vmCircuitOpenedUntil = 0
}

export function recordVmFailure(): void {
  const current = now()
  const threshold = parseInteger(process.env.DEVICE_QUOTA_VM_CIRCUIT_THRESHOLD, 3)
  const windowMs = parseInteger(process.env.DEVICE_QUOTA_VM_CIRCUIT_WINDOW_MS, 60000)
  const openMs = parseInteger(process.env.DEVICE_QUOTA_VM_CIRCUIT_OPEN_MS, 60000)
  const windowStart = current - windowMs

  vmFailureTimestamps = vmFailureTimestamps.filter((timestamp) => timestamp > windowStart)
  vmFailureTimestamps.push(current)
  if (vmFailureTimestamps.length >= threshold) {
    vmCircuitOpenedUntil = current + openMs
  }
}

export function resetSuggestionRuntimeStateForTests(): void {
  resultCache.clear()
  throttleEntries.clear()
  vmFailureTimestamps = []
  vmCircuitOpenedUntil = 0
}

export function getSuggestionRuntimeStateSizeForTests(): {
  resultCacheEntries: number
  throttleEntries: number
} {
  return {
    resultCacheEntries: resultCache.size,
    throttleEntries: throttleEntries.size,
  }
}
