import 'server-only'

import jwt from 'jsonwebtoken'

const SUPABASE_JWT_CLOCK_SKEW_SECONDS = 60

export type SupabaseRpcUser = {
  id?: unknown
  role?: unknown
  don_vi?: unknown
  dia_ban_id?: unknown
  khoa_phong?: unknown
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

function stringifyClaim(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function nullableStringClaim(value: unknown): string | null {
  const stringValue = stringifyClaim(value)
  return stringValue ? stringValue : null
}

function normalizeAppRole(role: unknown): string {
  const roleValue = stringifyClaim(role).toLowerCase()
  return roleValue === 'admin' ? 'global' : roleValue
}

/** Mints a short-lived Supabase-compatible JWT from trusted server-side user claims. */
export function mintSupabaseJwt(user: SupabaseRpcUser): string {
  const userId = stringifyClaim(user.id)
  if (!userId) {
    throw new Error('Cannot mint Supabase RPC JWT without user id')
  }

  const now = Math.floor(Date.now() / 1000)
  const issuedAt = now - SUPABASE_JWT_CLOCK_SKEW_SECONDS
  const expiresAt = now + 120
  const claims: Record<string, string | number | null> = {
    role: 'authenticated',
    iat: issuedAt,
    exp: expiresAt,
    sub: userId,
    app_role: normalizeAppRole(user.role),
    don_vi: nullableStringClaim(user.don_vi),
    user_id: userId,
    dia_ban: nullableStringClaim(user.dia_ban_id),
    khoa_phong: nullableStringClaim(user.khoa_phong),
  }

  return jwt.sign(claims, getRequiredEnv('SUPABASE_JWT_SECRET'), {
    algorithm: 'HS256',
  })
}

/** Calls a Supabase PostgREST RPC endpoint with server-minted authenticated claims. */
export async function callServerRpc<TResponse = unknown>(
  fn: string,
  args: Record<string, unknown>,
  user: SupabaseRpcUser,
): Promise<TResponse> {
  const token = mintSupabaseJwt(user)
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(fn)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      apikey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    },
    body: JSON.stringify(args),
  })

  const text = await response.text()
  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? JSON.parse(text || 'null') : text

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : `Supabase RPC ${fn} failed (${response.status})`
    throw new Error(message)
  }

  return payload as TResponse
}
