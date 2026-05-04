import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import jwt from 'jsonwebtoken'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../auth/config'
import { ALLOWED_FUNCTIONS } from './allowed-functions'
import { sanitizeForLog } from '@/lib/log-sanitizer'

// SECURITY: Maximum request body size (2MB) to prevent DoS via memory exhaustion
const MAX_BODY_SIZE = 2 * 1024 * 1024
const SUPABASE_JWT_CLOCK_SKEW_SECONDS = 60

type RpcProxySessionUser = {
  role?: unknown
  don_vi?: unknown
  dia_ban_id?: unknown
  khoa_phong?: unknown
  id?: unknown
}

function getEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

function getSessionUser(
  session: unknown,
): RpcProxySessionUser | null {
  if (!session || typeof session !== 'object' || !('user' in session)) {
    return null
  }

  const user = session.user
  if (!user || typeof user !== 'object') {
    return null
  }
  return user as RpcProxySessionUser
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}

export async function POST(req: NextRequest, context: { params: Promise<{ fn: string }> }) {
  try {
    const { fn } = await context.params
    if (!ALLOWED_FUNCTIONS.has(fn)) {
      return NextResponse.json({ error: 'Function not allowed' }, { status: 403 })
    }

    // SECURITY: Enforce body size limit BEFORE buffering/parsing to prevent DoS
    // 1. Require Content-Length header - reject chunked/streaming requests without it
    const contentLengthHeader = req.headers.get('content-length')
    if (!contentLengthHeader) {
      return NextResponse.json({ error: 'Content-Length header required' }, { status: 411 })
    }

    // 2. Validate Content-Length is within limit
    const contentLength = parseInt(contentLengthHeader, 10)
    if (isNaN(contentLength) || contentLength < 0) {
      return NextResponse.json({ error: 'Invalid Content-Length' }, { status: 400 })
    }
    if (contentLength > MAX_BODY_SIZE) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    // 3. Read raw body with size enforcement (defense in depth against spoofed header)
    // SECURITY: Use arrayBuffer to measure actual bytes, not UTF-16 code units
    const buf = await req.arrayBuffer()
    if (buf.byteLength > MAX_BODY_SIZE) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    // 4. Decode buffer to text and parse JSON
    let rawBody: unknown = {}
    try {
      const rawText = new TextDecoder().decode(buf)
      rawBody = rawText ? JSON.parse(rawText) : {}
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

  // Pull claims from NextAuth session securely (no client headers trusted)
  const session = await getServerSession(authOptions)
  const sessionUser = getSessionUser(session)

  // SECURITY: Reject unauthenticated requests - do NOT mint JWT without valid session
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawRole = sessionUser.role ?? ''
  const role = typeof rawRole === 'string' ? rawRole : String(rawRole)
  const roleLower = role.toLowerCase()
  const donVi = sessionUser.don_vi ? String(sessionUser.don_vi) : ''
  const diaBan = sessionUser.dia_ban_id ? String(sessionUser.dia_ban_id) : ''
  const khoaPhong = sessionUser.khoa_phong ? String(sessionUser.khoa_phong) : ''
  const userId = sessionUser.id ? String(sessionUser.id) : ''
  // Normalize to expected app roles used by SQL. Always lowercase; treat 'admin' as 'global'.
  const appRole = roleLower === 'admin' ? 'global' : roleLower
  // (debug removed)

    // Build JWT claims for PostgREST. We keep db role = authenticated; app role in app_role.
    // IMPORTANT: Convert empty strings to null to prevent BIGINT conversion errors
    // iat is backdated to handle clock skew between this server and Supabase.
    // exp is set explicitly (not via expiresIn) because jsonwebtoken computes
    // exp = iat + expiresIn, which would halve the effective lifetime.
    const now = Math.floor(Date.now() / 1000)
    const issuedAt = now - SUPABASE_JWT_CLOCK_SKEW_SECONDS
    const expiresAt = now + 120 // 2 minutes from actual signing time
    const claims: Record<string, string | number | null> = {
      role: 'authenticated',
      iat: issuedAt,
      exp: expiresAt,
      sub: userId, // CRITICAL: 'sub' is required for auth.uid() in PostgreSQL
      app_role: appRole,
      don_vi: donVi || null,  // Convert empty string to null for global users
      user_id: userId,
      dia_ban: diaBan || null,  // Convert empty string to null
      khoa_phong: khoaPhong || null,
    }

    // Sanitize tenant parameter for non-global users to enforce isolation
    // EXCEPTION: regional_leader users can see multiple tenants, don't override p_don_vi
    let body: Record<string, unknown> =
      rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
        ? { ...(rawBody as Record<string, unknown>) }
        : {}
    if (appRole !== 'global' && appRole !== 'regional_leader') {
      try {
        if (Object.prototype.hasOwnProperty.call(body, 'p_don_vi')) {
          const dv = donVi && donVi !== '' ? (Number.isFinite(Number(donVi)) ? Number(donVi) : donVi) : null
          body.p_don_vi = dv
        }
        if (Object.prototype.hasOwnProperty.call(body, 'p_dia_ban')) {
          const db = diaBan && diaBan !== '' ? (Number.isFinite(Number(diaBan)) ? Number(diaBan) : diaBan) : null
          body.p_dia_ban = db
        }
      } catch {}
    }

    const secret = getEnv('SUPABASE_JWT_SECRET')
  const token = jwt.sign(claims, secret, { algorithm: 'HS256' })

    const urlBase = getEnv('NEXT_PUBLIC_SUPABASE_URL')
    const url = `${urlBase}/rest/v1/rpc/${encodeURIComponent(fn)}`

    // (debug removed)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'apikey': getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    const isJson = res.headers.get('content-type')?.includes('application/json')
    const payload = isJson ? JSON.parse(text || 'null') : text
    if (!res.ok) {
      const sanitizedPayload = sanitizeForLog(payload)
      const sanitizedErrorMessage =
        sanitizedPayload && typeof sanitizedPayload === 'object'
          ? (
              ('message' in sanitizedPayload && typeof sanitizedPayload.message === 'string' && sanitizedPayload.message)
              || ('hint' in sanitizedPayload && typeof sanitizedPayload.hint === 'string' && sanitizedPayload.hint)
              || 'RPC failed'
            )
          : 'RPC failed'
      // SECURITY: Sanitize logs to prevent PII/credential exposure
      console.error(`Supabase RPC error for ${fn}:`, {
        status: res.status,
        error: sanitizedErrorMessage,
      })
      return NextResponse.json({ error: payload || 'RPC error' }, { status: res.status })
    }
    return NextResponse.json(payload)
  } catch (err: unknown) {
    // SECURITY: Log only error message, not full stack trace or request details
    const message = getErrorMessage(err)
    console.error('RPC proxy error:', { message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
