import jwt from "jsonwebtoken"

import { isGlobalRole, isRegionalLeaderRole } from "@/lib/rbac"
import {
  getPayloadDetails,
  getPayloadMessage,
  SuggestionRouteError,
} from "@/app/api/device-quota/mapping/suggest/suggestion-errors"
import type { SuggestionAccessUser } from "@/app/api/device-quota/mapping/suggest/suggestion-types"
import {
  getRequiredEnv,
  toNumber,
  toRole,
} from "@/app/api/device-quota/mapping/suggest/suggestion-utils"

const SUPABASE_JWT_CLOCK_SKEW_SECONDS = 60
const DEFAULT_SUPABASE_HTTP_TIMEOUT_MS = 8000

type AccessDeps = {
  lookupAccessibleFacilityIds: (user: SuggestionAccessUser) => Promise<number[]>
}

function createSupabaseJwt(user: SuggestionAccessUser): string {
  const role = toRole(user.role)
  const appRole = role === "admin" ? "global" : role
  const userId = user.id ? String(user.id) : ""
  const now = Math.floor(Date.now() / 1000)
  const issuedAt = now - SUPABASE_JWT_CLOCK_SKEW_SECONDS
  const expiresAt = now + 120
  const claims: Record<string, string | number | null> = {
    role: "authenticated",
    iat: issuedAt,
    exp: expiresAt,
    sub: userId,
    app_role: appRole,
    don_vi: user.don_vi ? String(user.don_vi) : null,
    user_id: userId,
    dia_ban: user.dia_ban_id ? String(user.dia_ban_id) : null,
    khoa_phong: user.khoa_phong ?? null,
  }

  return jwt.sign(claims, getRequiredEnv("SUPABASE_JWT_SECRET"), { algorithm: "HS256" })
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function getSupabaseHttpTimeoutMs(): number {
  return parsePositiveInteger(process.env.SUPABASE_HTTP_TIMEOUT_MS, DEFAULT_SUPABASE_HTTP_TIMEOUT_MS)
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMessage: string,
): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, getSupabaseHttpTimeoutMs())

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (timedOut || isAbortError(error)) {
      throw new SuggestionRouteError(timeoutMessage, 503)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

/** Calls a Supabase RPC with the user's scoped JWT claims. */
export async function callSupabaseRpc<TRes>(
  fn: string,
  args: Record<string, unknown>,
  user: SuggestionAccessUser,
): Promise<TRes> {
  const token = createSupabaseJwt(user)
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  const response = await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(fn)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        apikey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      },
      body: JSON.stringify(args),
    },
    `Supabase RPC ${fn} timed out`,
  )

  if (!response.ok) {
    let message = `RPC ${fn} failed (${response.status})`
    let details: unknown
    try {
      const payload = (await response.json()) as unknown
      details = getPayloadDetails(payload)
      message = getPayloadMessage(payload, message)
    } catch {}
    throw new SuggestionRouteError(message, response.status, details)
  }

  return (await response.json()) as TRes
}

/** Lists facilities the current user may access for suggestion preview. */
export async function lookupAccessibleFacilityIds(user: SuggestionAccessUser): Promise<number[]> {
  const rows = await callSupabaseRpc<unknown>("get_accessible_facilities", {}, user)
  if (!Array.isArray(rows)) return []

  const ids: number[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue
    const id = toNumber((row as Record<string, unknown>).id as string | number | null | undefined)
    if (id !== null) ids.push(id)
  }
  return ids
}

/** Enforces role and facility scope before suggestion work starts. */
export async function assertSuggestionAccess(
  user: SuggestionAccessUser,
  donViId: number,
  deps: AccessDeps = { lookupAccessibleFacilityIds },
): Promise<void> {
  const role = toRole(user.role)

  if (!["global", "admin", "to_qltb", "regional_leader"].includes(role)) {
    throw new SuggestionRouteError("Forbidden: insufficient role", 403)
  }

  if (isGlobalRole(role)) {
    return
  }

  if (isRegionalLeaderRole(role)) {
    const userRegionId = toNumber(user.dia_ban_id)
    if (userRegionId === null) {
      throw new SuggestionRouteError("Forbidden: facility scope denied", 403)
    }

    const accessibleFacilityIds = await deps.lookupAccessibleFacilityIds(user)
    if (!accessibleFacilityIds.includes(donViId)) {
      throw new SuggestionRouteError("Forbidden: facility scope denied", 403)
    }
    return
  }

  if (toNumber(user.don_vi) !== donViId) {
    throw new SuggestionRouteError("Forbidden: facility scope denied", 403)
  }
}
