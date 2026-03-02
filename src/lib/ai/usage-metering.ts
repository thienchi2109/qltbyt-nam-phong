import {
  AI_DAILY_TENANT_QUOTA_REQUESTS,
  AI_DAILY_USER_QUOTA_REQUESTS,
  AI_RATE_LIMIT_MAX_REQUESTS,
  AI_RATE_LIMIT_WINDOW_MS,
} from '@/lib/ai/limits'

export type UsageLimitReason = 'rate_limit' | 'user_quota' | 'tenant_quota'

export interface UsageContext {
  userId: string
  tenantId?: number
}

export interface UsageLimitCheckResult {
  allowed: boolean
  reason?: UsageLimitReason
  message?: string
}

export interface UsageRecord {
  inputTokens?: number
  outputTokens?: number
  estimatedCostUsd?: number
}

const recentRequestsByUser = new Map<string, number[]>()
const dailyUserRequests = new Map<string, number>()
const dailyTenantRequests = new Map<string, number>()
const latestUsageByUser = new Map<
  string,
  UsageRecord & { estimatedCostUsd: number; timestamp: number }
>()

function dayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function userDayKey(userId: string, timestamp: number): string {
  return `${userId}:${dayKey(timestamp)}`
}

function tenantDayKey(tenantId: number, timestamp: number): string {
  return `${tenantId}:${dayKey(timestamp)}`
}

function pruneRateWindow(userId: string, now: number): number[] {
  const start = now - AI_RATE_LIMIT_WINDOW_MS
  const current = recentRequestsByUser.get(userId) ?? []
  const pruned = current.filter(ts => ts >= start)
  recentRequestsByUser.set(userId, pruned)
  return pruned
}

function hasTenantId(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function estimateCostUsd(record: UsageRecord): number {
  if (typeof record.estimatedCostUsd === 'number' && record.estimatedCostUsd >= 0) {
    return record.estimatedCostUsd
  }

  const inputTokens = Math.max(0, record.inputTokens ?? 0)
  const outputTokens = Math.max(0, record.outputTokens ?? 0)

  const inputCostUsd = (inputTokens / 1_000) * 0.0001
  const outputCostUsd = (outputTokens / 1_000) * 0.0004
  return Number((inputCostUsd + outputCostUsd).toFixed(8))
}

export function checkUsageLimits(
  context: UsageContext,
  now: number = Date.now(),
): UsageLimitCheckResult {
  const userId = context.userId.trim()
  if (!userId) {
    return {
      allowed: false,
      reason: 'user_quota',
      message: 'AI usage quota exceeded for this user.',
    }
  }

  const inWindow = pruneRateWindow(userId, now)
  if (inWindow.length >= AI_RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      reason: 'rate_limit',
      message: 'Too many requests. Please try again later.',
    }
  }

  const userCount = dailyUserRequests.get(userDayKey(userId, now)) ?? 0
  if (userCount >= AI_DAILY_USER_QUOTA_REQUESTS) {
    return {
      allowed: false,
      reason: 'user_quota',
      message: 'AI usage quota exceeded for this user.',
    }
  }

  if (hasTenantId(context.tenantId)) {
    const tenantCount = dailyTenantRequests.get(tenantDayKey(context.tenantId, now)) ?? 0
    if (tenantCount >= AI_DAILY_TENANT_QUOTA_REQUESTS) {
      return {
        allowed: false,
        reason: 'tenant_quota',
        message: 'AI usage quota exceeded for this facility.',
      }
    }
  }

  return { allowed: true }
}

export function recordUsage(
  context: UsageContext,
  record: UsageRecord = {},
  now: number = Date.now(),
): void {
  const userId = context.userId.trim()
  if (!userId) {
    return
  }

  const inWindow = pruneRateWindow(userId, now)
  inWindow.push(now)
  recentRequestsByUser.set(userId, inWindow)

  const userKey = userDayKey(userId, now)
  dailyUserRequests.set(userKey, (dailyUserRequests.get(userKey) ?? 0) + 1)

  if (hasTenantId(context.tenantId)) {
    const tenantKey = tenantDayKey(context.tenantId, now)
    dailyTenantRequests.set(tenantKey, (dailyTenantRequests.get(tenantKey) ?? 0) + 1)
  }

  latestUsageByUser.set(userId, {
    ...record,
    estimatedCostUsd: estimateCostUsd(record),
    timestamp: now,
  })
}

export function getLatestUsage(userId: string) {
  return latestUsageByUser.get(userId)
}

export function __resetUsageMeteringForTests() {
  recentRequestsByUser.clear()
  dailyUserRequests.clear()
  dailyTenantRequests.clear()
  latestUsageByUser.clear()
}
