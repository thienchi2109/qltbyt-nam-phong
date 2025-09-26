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
  'equipment_count_enhanced',
  'equipment_attention_list',
  'equipment_attachments_list',
  'equipment_attachment_create', 
  'equipment_attachment_delete',
  'equipment_history_list',
  'equipment_list_enhanced',
  'equipment_list_for_reports',
  'departments_list',
  'departments_list_for_tenant',
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
  'transfer_request_list_enhanced',
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
  'maintenance_stats_enhanced',
  'maintenance_stats_for_reports',
  // Tenants + Users
  'tenant_list',
  'user_create',
  'user_membership_add',
  'user_membership_remove',
  'user_set_current_don_vi',
  // Don vi (global-only management)
  'don_vi_list',
  'don_vi_get',
  'don_vi_create',
  'don_vi_update',
  'don_vi_set_active',
  'don_vi_user_hierarchy',
  // Usage Analytics (Reports)
  'usage_analytics_overview',
  'usage_analytics_daily',
  // Reports: status distribution
  'equipment_status_distribution',
  // Audit logs (global users only)
  'audit_logs_list',
  'audit_logs_list_v2',
  'audit_logs_stats', 
  'audit_logs_recent_summary',
  // Debug
  'debug_claims',
  'don_vi_branding_get',
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

    const rawBody = await req.json().catch(() => ({}))

  // Pull claims from NextAuth session securely (no client headers trusted)
  const session = await getServerSession(authOptions as any)
  const rawRole = (session as any)?.user?.role ?? ''
  const role = typeof rawRole === 'string' ? rawRole : String(rawRole)
  const roleLower = role.toLowerCase()
  const donVi = (session as any)?.user?.don_vi ? String((session as any).user.don_vi) : ''
  const userId = (session as any)?.user?.id ? String((session as any).user.id) : ''
  // Normalize to expected app roles used by SQL. Always lowercase; treat 'admin' as 'global'.
  const appRole = roleLower === 'admin' ? 'global' : roleLower
  // (debug removed)

    // Build JWT claims for PostgREST. We keep db role = authenticated; app role in app_role.
    const claims: Record<string, any> = {
      role: 'authenticated',
      app_role: appRole,
      don_vi: donVi,
      user_id: userId,
    }

    // Sanitize tenant parameter for non-global users to enforce isolation
    let body: any = (rawBody && typeof rawBody === 'object') ? { ...rawBody } : {}
    if (appRole !== 'global') {
      try {
        if (Object.prototype.hasOwnProperty.call(body, 'p_don_vi')) {
          const dv = donVi && donVi !== '' ? (Number.isFinite(Number(donVi)) ? Number(donVi) : donVi) : null
          ;(body as any).p_don_vi = dv
        }
      } catch {}
    }

    const secret = getEnv('SUPABASE_JWT_SECRET')
  const token = jwt.sign(claims, secret, { algorithm: 'HS256', expiresIn: '2m' })

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
      return NextResponse.json({ error: payload || 'RPC error' }, { status: res.status })
    }
    return NextResponse.json(payload)
  } catch (err: any) {
    console.error('RPC proxy error', err)
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}

