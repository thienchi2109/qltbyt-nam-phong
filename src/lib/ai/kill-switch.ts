import 'server-only'

import { callServerRpc, type SupabaseRpcUser } from '@/lib/ai/server-rpc'

const NORMAL_CACHE_TTL_MS = 8_000
const FAIL_CLOSED_CACHE_TTL_MS = 2_000
const DEFAULT_INACTIVE_STATUS: AiKillSwitchStatus = { active: false, source: 'db' }

type AiKillSwitchRpcRow = {
  enabled?: boolean | null
  reason?: string | null
}

export type AiKillSwitchStatus =
  | { active: true; source: 'env'; reason?: undefined }
  | { active: true; source: 'db'; reason?: string }
  | { active: true; source: 'db_error_fail_closed'; reason?: undefined }
  | { active: false; source: 'db'; reason?: undefined }

type CacheEntry = {
  value: AiKillSwitchStatus
  expiresAt: number
}

const SYSTEM_RPC_USER: SupabaseRpcUser = {
  id: 'system:ai-kill-switch-reader',
  role: 'global',
}

let cache: CacheEntry | null = null

function isEnvKillSwitchOn(): boolean {
  return process.env.AI_KILL_SWITCH?.toLowerCase() === 'on'
}

function firstStatusRow(
  payload: AiKillSwitchRpcRow | AiKillSwitchRpcRow[] | null | undefined,
): AiKillSwitchRpcRow | null {
  const row = Array.isArray(payload) ? payload[0] : payload
  return row ?? null
}

function normalizeDbStatus(row: AiKillSwitchRpcRow | null): AiKillSwitchStatus {
  if (!row?.enabled) {
    return DEFAULT_INACTIVE_STATUS
  }

  const reason = typeof row.reason === 'string' ? row.reason.trim() : ''
  return reason
    ? { active: true, source: 'db', reason }
    : { active: true, source: 'db' }
}

/** Clears the in-process kill-switch cache for deterministic unit tests. */
export function __resetKillSwitchCache(): void {
  cache = null
}

/** Reads the current AI kill-switch state, preferring the env emergency override. */
export async function isAiKillSwitchActive(): Promise<AiKillSwitchStatus> {
  if (isEnvKillSwitchOn()) {
    return { active: true, source: 'env' }
  }

  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return cache.value
  }

  try {
    const row = firstStatusRow(await callServerRpc<AiKillSwitchRpcRow | AiKillSwitchRpcRow[]>(
      'ai_kill_switch_status',
      {},
      SYSTEM_RPC_USER,
    ))
    const value = normalizeDbStatus(row)
    cache = { value, expiresAt: now + NORMAL_CACHE_TTL_MS }
    return value
  } catch {
    const value: AiKillSwitchStatus = { active: true, source: 'db_error_fail_closed' }
    cache = { value, expiresAt: now + FAIL_CLOSED_CACHE_TTL_MS }
    return value
  }
}
