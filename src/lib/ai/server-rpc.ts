import 'server-only'

import jwt from 'jsonwebtoken'

import {
  buildSupabaseRpcJwtClaims,
  type SupabaseRpcUser,
} from '@/auth/server-claims'

export type { SupabaseRpcUser } from '@/auth/server-claims'

const SUPABASE_JWT_CLOCK_SKEW_SECONDS = 60

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

/** Mints a short-lived Supabase-compatible JWT from trusted server-side user claims. */
export function mintSupabaseJwt(user: SupabaseRpcUser): string {
  const now = Math.floor(Date.now() / 1000)
  const issuedAt = now - SUPABASE_JWT_CLOCK_SKEW_SECONDS
  const expiresAt = now + 120
  const claims = buildSupabaseRpcJwtClaims({ user, issuedAt, expiresAt })

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
