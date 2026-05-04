import { sanitizeForLog } from "@/lib/log-sanitizer"
import type { AuthPendingSignoutReason } from "@/types/auth"

export type AuthLifecycleEvent =
  | "login_failure"
  | "tenant_inactive"
  | "profile_refresh_failed"

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
  user_id?: string
  username?: string
  tenant_id?: string
  metadata?: Record<string, unknown>
}

export type AuthLifecycleLogPayload = {
  scope: "auth.lifecycle"
  ts: string
  event: AuthLifecycleEvent
  source: AuthLogSource
  reason_code?: AuthLifecycleReasonCode
  user_id?: string
  username?: string
  tenant_id?: string
  metadata?: Record<string, unknown>
}

function deriveAuthLifecycleEvent(input: AuthLifecycleLogInput): AuthLifecycleEvent {
  if (input.event) {
    return input.event
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

  if (input.user_id !== undefined) {
    payload.user_id = input.user_id
  }

  if (input.username !== undefined) {
    payload.username = input.username
  }

  if (input.tenant_id !== undefined) {
    payload.tenant_id = input.tenant_id
  }

  if (input.metadata !== undefined) {
    payload.metadata = input.metadata
  }

  return sanitizeForLog(payload) as AuthLifecycleLogPayload
}

export function emitAuthLifecycleLog(input: AuthLifecycleLogInput): void {
  try {
    console.info(JSON.stringify(buildAuthLifecycleLog(input)))
  } catch {
    // Telemetry must never change auth behavior.
  }
}
