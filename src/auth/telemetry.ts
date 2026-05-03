export type AuthJwtTelemetryEvent =
  | "jwt_callback_invoked"
  | "jwt_refresh_skipped_cooldown"
  | "jwt_refresh_forced_update_trigger"
  | "jwt_refresh_attempted"
  | "jwt_refresh_succeeded"
  | "jwt_refresh_failed"
  | "jwt_token_invalidated_password_change"

export type AuthJwtTelemetryContext = {
  userId?: string
  trigger?: string
  hasLastRefreshAt?: boolean
  refreshDue?: boolean
  refreshReason?: "sign_in" | "update_trigger" | "interval_elapsed" | "cooldown"
  invalidatedReason?: "password_changed_after_login"
}

export function emitAuthJwtTelemetry(event: AuthJwtTelemetryEvent, context: AuthJwtTelemetryContext = {}): void {
  try {
    console.info(JSON.stringify({
      scope: "auth.jwt",
      event,
      ...context,
    }))
  } catch {
    // Telemetry must never change auth behavior.
  }
}
