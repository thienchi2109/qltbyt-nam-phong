import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth/config"

const SUPABASE_JWT_CLOCK_SKEW_SECONDS = 60

function getEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function getRpcErrorMessage(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = payload.message
    if (typeof message === 'string' && message) return message
  }
  return 'Tenant switch failed'
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const don_vi = Number(body?.don_vi)
  if (!don_vi) return NextResponse.json({ ok: false, error: 'Invalid don_vi' }, { status: 400 })

  const userId = Number(session.user.id)
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ ok: false, error: 'Invalid user id' }, { status: 401 })
  }

  const rawRole = String(session.user.role || '').toLowerCase()
  const appRole = rawRole === 'admin' ? 'global' : rawRole
  const donViClaim = session.user.don_vi ? String(session.user.don_vi) : null
  const diaBanClaim = session.user.dia_ban_id ? String(session.user.dia_ban_id) : null
  const khoaPhongClaim = session.user.khoa_phong ? String(session.user.khoa_phong) : null

  const now = Math.floor(Date.now() / 1000)
  const issuedAt = now - SUPABASE_JWT_CLOCK_SKEW_SECONDS
  const token = jwt.sign(
    {
      role: 'authenticated',
      iat: issuedAt,
      exp: now + 120,
      sub: String(userId),
      app_role: appRole,
      don_vi: donViClaim,
      user_id: String(userId),
      dia_ban: diaBanClaim,
      khoa_phong: khoaPhongClaim,
    },
    getEnv('SUPABASE_JWT_SECRET'),
    { algorithm: 'HS256' },
  )

  const response = await fetch(`${getEnv('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/rpc/user_set_current_don_vi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'apikey': getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_don_vi: don_vi,
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    return NextResponse.json({ ok: false, error: getRpcErrorMessage(payload) }, { status: response.status })
  }

  return NextResponse.json({ ok: true })
}
