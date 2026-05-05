import { createClient } from "@supabase/supabase-js"

import type { AuthLifecycleLogPayload } from "@/auth/logging"

type AuthAuditInsertRpcArgs = {
  p_created_at: string
  p_event: AuthLifecycleLogPayload["event"]
  p_source: AuthLifecycleLogPayload["source"]
  p_reason_code: AuthLifecycleLogPayload["reason_code"] | null
  p_signout_reason: AuthLifecycleLogPayload["signout_reason"] | null
  p_user_id: string | null
  p_username: string | null
  p_tenant_id: string | null
  p_request_id: string | null
  p_trace_id: string | null
  p_ip_address: string | null
  p_user_agent: string | null
  p_metadata: Record<string, unknown> | null
}

function getAuthAuditPersistenceEnv(): { supabaseUrl: string; serviceRoleKey: string } | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return { supabaseUrl, serviceRoleKey }
}

function toAuthAuditInsertRpcArgs(payload: AuthLifecycleLogPayload): AuthAuditInsertRpcArgs {
  return {
    p_created_at: payload.ts,
    p_event: payload.event,
    p_source: payload.source,
    p_reason_code: payload.reason_code ?? null,
    p_signout_reason: payload.signout_reason ?? null,
    p_user_id: payload.user_id ?? null,
    p_username: payload.username ?? null,
    p_tenant_id: payload.tenant_id ?? null,
    p_request_id: payload.request_id ?? null,
    p_trace_id: payload.trace_id ?? null,
    p_ip_address: payload.ip_address ?? null,
    p_user_agent: payload.user_agent ?? null,
    p_metadata: payload.metadata ?? null,
  }
}

export async function persistAuthLifecycleLog(payload: AuthLifecycleLogPayload): Promise<void> {
  const env = getAuthAuditPersistenceEnv()
  if (!env) {
    return
  }

  try {
    const supabase = createClient(env.supabaseUrl, env.serviceRoleKey)
    const { data, error } = await supabase.rpc(
      "auth_audit_log_insert",
      toAuthAuditInsertRpcArgs(payload)
    )

    if (error || data !== true) {
      console.error("Auth audit sink insert failed", error ?? { data })
    }
  } catch (error) {
    console.error("Auth audit persistence failed", error)
  }
}
