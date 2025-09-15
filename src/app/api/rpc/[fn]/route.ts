import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import jwt from 'jsonwebtoken'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../auth/config'

// Whitelist RPCs we allow through this proxy
const ALLOWED_FUNCTIONS = new Set<string>([
  'equipment_list',
  'equipment_get',
  'equipment_create',
  'equipment_update',
  'equipment_delete',
  'equipment_count',
  'equipment_attention_list',
  // Repairs
  'repair_request_list',
  'repair_request_get',
  'repair_request_create',
  'repair_request_update',
  'repair_request_approve',
  'repair_request_complete',
  'repair_request_delete',
  // Transfers
  'transfer_request_list',
  'transfer_request_create',
  'transfer_request_update',
  'transfer_request_update_status',
  'transfer_request_delete',
  'transfer_request_complete',
  'transfer_history_list',
  'transfer_request_external_pending_returns',
  // Maintenance
  'maintenance_tasks_list',
  'maintenance_tasks_bulk_insert',
  'maintenance_task_update',
  'maintenance_tasks_delete',
])

function getEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

export async function POST(req: NextRequest, context: { params: Promise<{ fn: string }> }) {
  try {
    const { fn } = await context.params
    if (!ALLOWED_FUNCTIONS.has(fn)) {
      return NextResponse.json({ error: 'Function not allowed' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))

  // Pull claims from NextAuth session securely (no client headers trusted)
  const session = await getServerSession(authOptions as any)
  const role = (session as any)?.user?.role || ''
  const donVi = (session as any)?.user?.don_vi ? String((session as any).user.don_vi) : ''
  const userId = (session as any)?.user?.id ? String((session as any).user.id) : ''
  const appRole = role

    // Build JWT claims for PostgREST. We keep db role = authenticated; app role in app_role.
    const claims: Record<string, any> = {
      role: 'authenticated',
      app_role: appRole,
      don_vi: donVi,
      user_id: userId,
    }

    const secret = getEnv('SUPABASE_JWT_SECRET')
  const token = jwt.sign(claims, secret, { algorithm: 'HS256', expiresIn: '2m' })

    const urlBase = getEnv('NEXT_PUBLIC_SUPABASE_URL')
    const url = `${urlBase}/rest/v1/rpc/${encodeURIComponent(fn)}`

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
      return NextResponse.json({ error: payload || 'RPC error' }, { status: res.status })
    }
    return NextResponse.json(payload)
  } catch (err: any) {
    console.error('RPC proxy error', err)
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}
