import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import jwt from 'jsonwebtoken'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../auth/config'

  // Whitelist RPCs we allow through this proxy
const ALLOWED_FUNCTIONS = new Set<string>([
  'equipment_list',
  'equipment_get',
  'equipment_get_by_code',
  'equipment_create',
  'equipment_update',
  'equipment_delete',
  'equipment_restore',
  'equipment_count',
  'equipment_count_enhanced',
  'equipment_attention_list',
  'equipment_attention_list_paginated',
  'equipment_attachments_list',
  'equipment_attachment_create', 
  'equipment_attachment_delete',
  'equipment_history_list',
  'equipment_list_enhanced',
  'equipment_list_for_reports',
  'equipment_aggregates_for_reports',
  'departments_list',
  'departments_list_for_tenant',
  'departments_list_for_facilities',
  'equipment_users_list_for_tenant',
  'equipment_locations_list_for_tenant', 
  'equipment_classifications_list_for_tenant',
  'equipment_statuses_list_for_tenant',
  'equipment_funding_sources_list_for_tenant',
  'equipment_bulk_import',
  // Repairs
  'repair_request_list',
  'repair_request_get',
  'repair_request_create',
  'repair_request_update',
  'repair_request_approve',
  'repair_request_complete',
  'repair_request_delete',
  'get_repair_request_facilities',
  'repair_request_status_counts',
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
  'get_transfer_request_facilities',
  // Transfers - Data Grid
  'transfer_request_counts',
  // Maintenance
  'maintenance_plan_list',
  'maintenance_plan_get',
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
  'get_maintenance_report_data',
  // Tenants + Users
  'tenant_list',
  'get_facilities_with_equipment_count',
  'get_accessible_facilities',
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
  // Usage log management
  'usage_log_list',
  'usage_session_start',
  'usage_session_end',
  'usage_log_delete',
  // Reports: status distribution
  'equipment_status_distribution',
  // Audit logs (global users only)
  'audit_logs_list',
  'audit_logs_list_v2',
  'audit_logs_stats', 
  'audit_logs_recent_summary',
  // Dashboard KPIs (tenant-filtered)
  'dashboard_repair_request_stats',
  'dashboard_maintenance_plan_stats', 
  'dashboard_maintenance_count',
  'dashboard_equipment_total',
  'maintenance_calendar_events',
  // Debug
  'debug_claims',
  'test_jwt_claims',
  'don_vi_branding_get',
  // Header notifications
  'header_notifications_summary',
  // Device Quota Management (Định mức thiết bị)
  // Decisions
  'dinh_muc_quyet_dinh_list',
  'dinh_muc_quyet_dinh_get',
  'dinh_muc_quyet_dinh_create',
  'dinh_muc_quyet_dinh_update',
  'dinh_muc_quyet_dinh_activate',
  'dinh_muc_quyet_dinh_delete',
  // Categories
  'dinh_muc_nhom_list',
  'dinh_muc_nhom_get',
  'dinh_muc_nhom_upsert',
  'dinh_muc_nhom_delete',
  'dinh_muc_nhom_bulk_import',
  // Equipment Mapping
  'dinh_muc_thiet_bi_link',
  'dinh_muc_thiet_bi_unlink',
  'dinh_muc_thiet_bi_unassigned',
  'dinh_muc_thiet_bi_by_nhom',
  // Line Items
  'dinh_muc_chi_tiet_list',
  'dinh_muc_chi_tiet_upsert',
  'dinh_muc_chi_tiet_delete',
  'dinh_muc_chi_tiet_bulk_import',
  // Compliance
  'dinh_muc_compliance_summary',
  'dinh_muc_compliance_detail',
])

// SECURITY: Maximum request body size (2MB) to prevent DoS via memory exhaustion
const MAX_BODY_SIZE = 2 * 1024 * 1024

// Sensitive keys to redact from logs (case-insensitive matching)
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'mat_khau', 'p_password', 'api_key', 'apikey', 'authorization', 'credential']

function getEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

// SECURITY: Recursively sanitize objects for logging to prevent PII/credential exposure
// Handles nested objects and arrays at any depth
function sanitizeForLog(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion on deeply nested or circular structures
  if (depth > 10) return '[MAX_DEPTH]'

  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLog(item, depth + 1))
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const keyLower = key.toLowerCase()
    if (SENSITIVE_KEYS.some(sk => keyLower.includes(sk))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value, depth + 1)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
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
    let rawBody: Record<string, unknown> = {}
    try {
      const rawText = new TextDecoder().decode(buf)
      rawBody = rawText ? JSON.parse(rawText) : {}
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

  // Pull claims from NextAuth session securely (no client headers trusted)
  const session = await getServerSession(authOptions as any)

  // SECURITY: Reject unauthenticated requests - do NOT mint JWT without valid session
  if (!(session as any)?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawRole = (session as any)?.user?.role ?? ''
  const role = typeof rawRole === 'string' ? rawRole : String(rawRole)
  const roleLower = role.toLowerCase()
  const donVi = (session as any)?.user?.don_vi ? String((session as any).user.don_vi) : ''
  const diaBan = (session as any)?.user?.dia_ban_id ? String((session as any).user.dia_ban_id) : ''
  const userId = (session as any)?.user?.id ? String((session as any).user.id) : ''
  // Normalize to expected app roles used by SQL. Always lowercase; treat 'admin' as 'global'.
  const appRole = roleLower === 'admin' ? 'global' : roleLower
  // (debug removed)

    // Build JWT claims for PostgREST. We keep db role = authenticated; app role in app_role.
    // IMPORTANT: Convert empty strings to null to prevent BIGINT conversion errors
    const claims: Record<string, any> = {
      role: 'authenticated',
      sub: userId, // CRITICAL: 'sub' is required for auth.uid() in PostgreSQL
      app_role: appRole,
      don_vi: donVi || null,  // Convert empty string to null for global users
      user_id: userId,
      dia_ban: diaBan || null,  // Convert empty string to null
    }

    // Sanitize tenant parameter for non-global users to enforce isolation
    // EXCEPTION: regional_leader users can see multiple tenants, don't override p_don_vi
    let body: any = (rawBody && typeof rawBody === 'object') ? { ...rawBody } : {}
    if (appRole !== 'global' && appRole !== 'regional_leader') {
      try {
        if (Object.prototype.hasOwnProperty.call(body, 'p_don_vi')) {
          const dv = donVi && donVi !== '' ? (Number.isFinite(Number(donVi)) ? Number(donVi) : donVi) : null
          ;(body as any).p_don_vi = dv
        }
        if (Object.prototype.hasOwnProperty.call(body, 'p_dia_ban')) {
          const db = diaBan && diaBan !== '' ? (Number.isFinite(Number(diaBan)) ? Number(diaBan) : diaBan) : null
          ;(body as any).p_dia_ban = db
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
      // SECURITY: Sanitize logs to prevent PII/credential exposure
      console.error(`Supabase RPC error for ${fn}:`, {
        status: res.status,
        error: typeof payload === 'object' ? (payload?.message || payload?.hint || 'RPC failed') : 'RPC failed',
      })
      return NextResponse.json({ error: payload || 'RPC error' }, { status: res.status })
    }
    return NextResponse.json(payload)
  } catch (err: any) {
    // SECURITY: Log only error message, not full stack trace or request details
    console.error('RPC proxy error:', { message: err?.message || 'Unknown error' })
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}

