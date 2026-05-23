import {
  AI_DAILY_GLOBAL_QUOTA_REQUESTS,
  AI_DAILY_TENANT_QUOTA_REQUESTS,
  AI_DAILY_USER_QUOTA_REQUESTS,
  AI_QUOTA_RESERVATION_TTL_MS,
  AI_RATE_LIMIT_MAX_REQUESTS,
  AI_RATE_LIMIT_WINDOW_MS,
} from '@/lib/ai/limits'
import { isAiKillSwitchActive } from '@/lib/ai/kill-switch'
import { callServerRpc, type SupabaseRpcUser } from '@/lib/ai/server-rpc'

export type UsageLimitReason =
  | 'rate_limit'
  | 'user_quota'
  | 'tenant_quota'
  | 'global_quota'
  | 'kill_switch'

export interface UsageContext {
  userId: string
  tenantId?: number
  role?: string
  diaBanId?: number | string | null
  khoaPhong?: string | null
}

export interface UsageLimitCheckResult {
  allowed: boolean
  reason?: UsageLimitReason
  message?: string
}

export interface UsageReservationResult extends UsageLimitCheckResult {
  reservationId?: string
}

type AiQuotaReserveRow = {
  allowed: boolean
  reservation_id?: string | null
  reason?: string | null
  message?: string | null
}

export type UsageFinalizeStatus =
  | 'success'
  | 'error_with_usage'
  | 'error_no_usage'

export interface UsageFinalizeInput extends UsageContext {
  reservationId?: string | null
  status: UsageFinalizeStatus
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
}

type ProviderUsage = {
  inputTokens?: number
  outputTokens?: number
}

/** Converts stream failure usage into finalize payload tokens without estimating missing usage. */
export function classifyStreamFailure(input: {
  providerUsage?: ProviderUsage
}): {
  status: 'error_with_usage'
  inputTokens: number
  outputTokens: number
} {
  return {
    status: 'error_with_usage',
    inputTokens: Math.max(0, input.providerUsage?.inputTokens ?? 0),
    outputTokens: Math.max(0, input.providerUsage?.outputTokens ?? 0),
  }
}

function hasTenantId(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function toRpcUser(context: UsageContext): SupabaseRpcUser {
  return {
    id: context.userId,
    role: context.role ?? 'user',
    don_vi: context.tenantId,
    dia_ban_id: context.diaBanId,
    khoa_phong: context.khoaPhong,
  }
}

function normalizeUsageLimitReason(reason: string | null | undefined): UsageLimitReason | undefined {
  switch (reason) {
    case 'rate_limit':
    case 'user_quota':
    case 'tenant_quota':
    case 'global_quota':
    case 'kill_switch':
      return reason
    default:
      return undefined
  }
}

function firstReserveRow(
  payload: AiQuotaReserveRow | AiQuotaReserveRow[] | null | undefined,
): AiQuotaReserveRow {
  const row = Array.isArray(payload) ? payload[0] : payload
  if (!row) {
    return {
      allowed: false,
      reason: 'user_quota',
      message: 'Unable to reserve AI usage quota.',
    }
  }
  return row
}

/** Reserves distributed AI quota before starting a provider request. */
export async function reserveUsage(context: UsageContext): Promise<UsageReservationResult> {
  const killSwitch = await isAiKillSwitchActive()
  if (killSwitch.active) {
    return {
      allowed: false,
      reason: 'kill_switch',
      message: killSwitch.reason ?? 'AI usage is temporarily disabled.',
    }
  }

  const userId = context.userId.trim()
  if (!userId) {
    return {
      allowed: false,
      reason: 'user_quota',
      message: 'AI usage quota exceeded for this user.',
    }
  }

  const row = firstReserveRow(await callServerRpc<AiQuotaReserveRow | AiQuotaReserveRow[]>(
    'ai_quota_reserve',
    {
      p_user_id: userId,
      p_tenant_id: hasTenantId(context.tenantId) ? context.tenantId : null,
      p_rate_window_ms: AI_RATE_LIMIT_WINDOW_MS,
      p_rate_max: AI_RATE_LIMIT_MAX_REQUESTS,
      p_user_daily_max: AI_DAILY_USER_QUOTA_REQUESTS,
      p_tenant_daily_max: AI_DAILY_TENANT_QUOTA_REQUESTS,
      p_global_daily_max: AI_DAILY_GLOBAL_QUOTA_REQUESTS,
      p_ttl_ms: AI_QUOTA_RESERVATION_TTL_MS,
    },
    toRpcUser({ ...context, userId }),
  ))

  return {
    allowed: row.allowed,
    reservationId: row.reservation_id ?? undefined,
    reason: normalizeUsageLimitReason(row.reason),
    message: row.message ?? undefined,
  }
}

/** Finalizes a reserved AI quota record exactly once with provider-reported usage. */
export async function finalizeUsage(input: UsageFinalizeInput): Promise<void> {
  if (!input.reservationId) {
    return
  }

  await callServerRpc('ai_quota_finalize', {
    p_reservation_id: input.reservationId,
    p_status: input.status,
    p_tokens_in: Math.max(0, input.inputTokens ?? 0),
    p_tokens_out: Math.max(0, input.outputTokens ?? 0),
    p_cost_usd: Math.max(0, input.costUsd ?? 0),
  }, toRpcUser(input))
}
