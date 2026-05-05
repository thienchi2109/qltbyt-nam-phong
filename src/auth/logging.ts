import { sanitizeForLog } from "@/lib/log-sanitizer"
import type { AuthPendingSignoutReason } from "@/types/auth"

export type AuthLifecycleEvent =
  | "login_success"
  | "login_failure"
  | "tenant_inactive"
  | "profile_refresh_failed"
  | "token_invalidated_password_change"
  | "signout"
  | "forced_signout"

export type AuthLifecycleReasonCode =
  | "invalid_credentials"
  | "rpc_error"
  | "tenant_inactive"
  | "authorize_exception"
  | "config_error"

export type AuthLogSource =
  | "authorize"
  | "jwt_callback"
  | "events_signin"
  | "events_signout"

export type AuthLifecycleLogInput = {
  event?: AuthLifecycleEvent
  source: AuthLogSource
  reason_code?: AuthLifecycleReasonCode
  signout_reason?: AuthPendingSignoutReason
  user_id?: string
  username?: string
  tenant_id?: string
  request_id?: string | null
  trace_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  metadata?: Record<string, unknown>
}

export type AuthLifecycleLogPayload = {
  scope: "auth.lifecycle"
  ts: string
  event: AuthLifecycleEvent
  source: AuthLogSource
  reason_code?: AuthLifecycleReasonCode
  signout_reason?: AuthPendingSignoutReason
  user_id?: string
  username?: string
  tenant_id?: string
  request_id?: string | null
  trace_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  metadata?: Record<string, unknown>
}

function deriveAuthLifecycleEvent(input: AuthLifecycleLogInput): AuthLifecycleEvent {
  if (input.event) {
    return input.event
  }

  if (input.signout_reason) {
    return input.signout_reason === "user_initiated" ? "signout" : "forced_signout"
  }

  if (input.reason_code === "tenant_inactive") {
    return "tenant_inactive"
  }

  return "login_failure"
}

export function buildAuthLifecycleLog(input: AuthLifecycleLogInput): AuthLifecycleLogPayload {
  const payload: AuthLifecycleLogPayload = {
    scope: "auth.lifecycle",
    ts: new Date().toISOString(),
    event: deriveAuthLifecycleEvent(input),
    source: input.source,
  }

  if (input.reason_code !== undefined) {
    payload.reason_code = input.reason_code
  }

  if (input.signout_reason !== undefined) {
    payload.signout_reason = input.signout_reason
  }

  if (input.user_id !== undefined) {
    payload.user_id = input.user_id
  }

  if (input.username !== undefined) {
    payload.username = input.username
  }

  if (input.tenant_id !== undefined) {
    payload.tenant_id = input.tenant_id
  }

  if (input.request_id !== undefined) {
    payload.request_id = input.request_id
  }

  if (input.trace_id !== undefined) {
    payload.trace_id = input.trace_id
  }

  if (input.ip_address !== undefined) {
    payload.ip_address = input.ip_address
  }

  if (input.user_agent !== undefined) {
    payload.user_agent = input.user_agent
  }

  if (input.metadata !== undefined) {
    payload.metadata = input.metadata
  }

  return sanitizeForLog(payload) as AuthLifecycleLogPayload
}

export function emitAuthLifecyclePayload(payload: AuthLifecycleLogPayload): void {
  try {
    console.info(JSON.stringify(payload))
  } catch {
    // Telemetry must never change auth behavior.
  }
}

export function emitAuthLifecycleLog(input: AuthLifecycleLogInput): void {
  try {
    emitAuthLifecyclePayload(buildAuthLifecycleLog(input))
  } catch {
    // Telemetry must never change auth behavior.
  }
}
