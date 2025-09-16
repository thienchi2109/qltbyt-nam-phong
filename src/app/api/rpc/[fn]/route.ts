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
  'equipment_attachments_list',
  'equipment_attachment_create', 
  'equipment_attachment_delete',
  'equipment_history_list',
  'departments_list',
  'equipment_bulk_import',
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
  'maintenance_plan_list',
  'maintenance_plan_create',
  'maintenance_plan_update',
  'maintenance_plan_delete',
  'maintenance_plan_approve',
  'maintenance_plan_reject',
  'maintenance_tasks_list',
  'maintenance_tasks_list_with_equipment',
  'maintenance_tasks_bulk_insert',
  'maintenance_task_update',
  'maintenance_task_complete',
  'maintenance_tasks_delete',
  // Tenants + Users
  'tenant_list',
  'user_create',
  'user_membership_add',
  'user_membership_remove',
  'user_set_current_don_vi',
  // Debug
  'debug_claims',
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
  const rawRole = (session as any)?.user?.role ?? ''
  const role = typeof rawRole === 'string' ? rawRole : String(rawRole)
  const roleLower = role.toLowerCase()
  const donVi = (session as any)?.user?.don_vi ? String((session as any).user.don_vi) : ''
  const userId = (session as any)?.user?.id ? String((session as any).user.id) : ''
  // Normalize to expected app roles used by SQL. Always lowercase; treat 'admin' as 'global'.
  const appRole = roleLower === 'admin' ? 'global' : roleLower
  try {
    if (fn === 'equipment_list') {
      console.log('[RPC] claims used:', { appRole, donVi, userId, originalRole: role })
    }
  } catch {}

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

    // Debug: log equipment_list calls with args and derived claims (safe info only)
    if (fn === 'equipment_list') {
      try {
        console.log('[RPC] equipment_list call body:', body)
      } catch {}
    }

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
