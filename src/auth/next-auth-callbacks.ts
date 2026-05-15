import type { NextAuthOptions } from "next-auth"
import { createClient } from "@supabase/supabase-js"

import { recordAuthLifecycleEvent } from "@/auth/observability"
import { emitAuthJwtTelemetry } from "@/auth/telemetry"
import type { AuthPendingSignoutReason } from "@/types/auth"

import {
  applyAuthUserToJwt,
  applyJwtProfileRefresh,
  applyJwtToSession,
} from "./types"
import {
  AuthRefreshConfigError,
  buildSessionProfileJwt,
  firstProfileRow,
  normalizeSessionProfileAppRole,
  PROFILE_REFRESH_INTERVAL_MS,
  requireRefreshEnv,
} from "./session-profile-refresh"
import {
  coerceTenantId,
  isPendingSignoutReason,
  normalizeUsernameForLog,
  readRuntimeRequestContext,
} from "./request-context"

export const authCallbacks: NonNullable<NextAuthOptions["callbacks"]> = {
  async jwt({ token, user, trigger, session }) {
    const now = Date.now()
    const requestContext = await readRuntimeRequestContext()
    const pendingSignoutReason = isPendingSignoutReason(session?.pending_signout_reason)
      ? session.pending_signout_reason
      : undefined

    // On sign-in, persist extra fields in the JWT
    if (user) {
      token = {
        ...applyAuthUserToJwt(token, user),
        loginTime: now, // Track when user logged in
        lastRefreshAt: now,
      }
    }

    if (pendingSignoutReason) {
      token.pending_signout_reason = pendingSignoutReason
    } else if (trigger === "update" && "pending_signout_reason" in token) {
      delete token.pending_signout_reason
    }

    if (!token.id) {
      return token
    }

    const userId = String(token.id)
    // Cooldown: skip the per-request profile fetch if we refreshed recently.
    // Force a refresh when NextAuth indicates an explicit update (e.g.
    // tenant switch via session.update()).
    const lastRefreshAt = typeof token.lastRefreshAt === "number" ? token.lastRefreshAt : null
    const lastRefreshAttemptAt =
      typeof token.lastRefreshAttemptAt === "number" ? token.lastRefreshAttemptAt : null
    const lastProfileRefreshCheckAt =
      lastRefreshAt === null
        ? lastRefreshAttemptAt
        : lastRefreshAttemptAt === null
          ? lastRefreshAt
          : Math.max(lastRefreshAt, lastRefreshAttemptAt)
    const isExplicitUpdate = trigger === "update"
    const refreshReason = user
      ? "sign_in"
      : trigger === "update"
        ? "update_trigger"
        : "interval_elapsed"

    emitAuthJwtTelemetry("jwt_callback_invoked", {
      userId,
      trigger,
      hasLastRefreshAt: lastRefreshAt !== null,
      refreshDue:
        isExplicitUpdate ||
        lastProfileRefreshCheckAt === null ||
        now - lastProfileRefreshCheckAt >= PROFILE_REFRESH_INTERVAL_MS,
      refreshReason,
    })

    if (
      !isExplicitUpdate &&
      lastProfileRefreshCheckAt !== null &&
      now - lastProfileRefreshCheckAt < PROFILE_REFRESH_INTERVAL_MS
    ) {
      emitAuthJwtTelemetry("jwt_refresh_skipped_cooldown", {
        userId,
        trigger,
        hasLastRefreshAt: true,
        refreshDue: false,
        refreshReason: "cooldown",
      })
      return token
    }

    if (trigger === "update") {
      emitAuthJwtTelemetry("jwt_refresh_forced_update_trigger", {
        userId,
        trigger,
        hasLastRefreshAt: lastRefreshAt !== null,
        refreshDue: true,
        refreshReason: "update_trigger",
      })
    }

    // Refresh user-derived fields
    try {
      const supabaseUrl = requireRefreshEnv("NEXT_PUBLIC_SUPABASE_URL")
      const anonKey = requireRefreshEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
      const appRole = normalizeSessionProfileAppRole(token.role)
      if (!appRole) {
        throw new AuthRefreshConfigError("JWT app_role is not configured")
      }

      const sessionProfileJwt = buildSessionProfileJwt(userId, appRole)
      token.lastRefreshAttemptAt = now
      const supabase = createClient(supabaseUrl, anonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${sessionProfileJwt}`,
          },
        },
      })
      emitAuthJwtTelemetry("jwt_refresh_attempted", {
        userId,
        trigger,
        hasLastRefreshAt: lastRefreshAt !== null,
        refreshDue: true,
        refreshReason,
      })
      const { data, error } = await supabase.rpc("get_session_profile_for_jwt", { p_user_id: userId })

      if (error) {
        await recordAuthLifecycleEvent({
          event: "profile_refresh_failed",
          source: "jwt_callback",
          user_id: userId,
          username: normalizeUsernameForLog(token.username),
          tenant_id: coerceTenantId(token.don_vi),
          ...requestContext,
          metadata: {
            trigger,
            refreshReason,
          },
        })
        emitAuthJwtTelemetry("jwt_refresh_failed", {
          userId,
          trigger,
          hasLastRefreshAt: lastRefreshAt !== null,
          refreshDue: true,
          refreshReason,
        })
      }

      if (!error && data) {
        const profile = firstProfileRow(data)
        if (!profile) {
          await recordAuthLifecycleEvent({
            event: "profile_refresh_failed",
            source: "jwt_callback",
            user_id: userId,
            username: normalizeUsernameForLog(token.username),
            tenant_id: coerceTenantId(token.don_vi),
            ...requestContext,
            metadata: {
              trigger,
              refreshReason,
            },
          })
          emitAuthJwtTelemetry("jwt_refresh_failed", {
            userId,
            trigger,
            hasLastRefreshAt: lastRefreshAt !== null,
            refreshDue: true,
            refreshReason,
          })
          return token
        }
        // Password change invalidates session if changed after login
        if (token.loginTime && profile.password_changed_at) {
          const passwordChangedAt = new Date(profile.password_changed_at).getTime()
          const tokenLoginTime = token.loginTime as number
          if (passwordChangedAt > tokenLoginTime) {
            const signoutReason = isPendingSignoutReason(token.pending_signout_reason)
              ? token.pending_signout_reason
              : undefined
            await recordAuthLifecycleEvent({
              event: "token_invalidated_password_change",
              source: "jwt_callback",
              signout_reason: signoutReason,
              user_id: userId,
              username: normalizeUsernameForLog(token.username),
              tenant_id: coerceTenantId(token.don_vi),
              ...requestContext,
              metadata: {
                trigger,
                refreshReason,
              },
            })
            emitAuthJwtTelemetry("jwt_token_invalidated_password_change", {
              userId,
              trigger,
              hasLastRefreshAt: lastRefreshAt !== null,
              refreshDue: true,
              refreshReason,
              invalidatedReason: "password_changed_after_login",
            })
            console.warn("Password changed after login - invalidating token")
            const invalidatedToken: {
              loginTime?: number
              pending_signout_reason?: AuthPendingSignoutReason
            } = {}
            if (typeof token.loginTime === "number") {
              invalidatedToken.loginTime = token.loginTime
            }
            if (signoutReason) {
              invalidatedToken.pending_signout_reason = signoutReason
            }
            return invalidatedToken
          }
        }
        // Keep JWT in sync with user profile for tenant-aware UI
        const resolvedDonVi = profile.current_don_vi || profile.don_vi || null
        const resolvedDiaBan: number | null = profile.dia_ban_id ?? null
        const resolvedDiaBanMa = profile.ma_dia_ban ?? token.dia_ban_ma ?? null

        token = applyJwtProfileRefresh(token, profile, resolvedDonVi, resolvedDiaBan, resolvedDiaBanMa)
        token.lastRefreshAt = now
        emitAuthJwtTelemetry("jwt_refresh_succeeded", {
          userId,
          trigger,
          hasLastRefreshAt: lastRefreshAt !== null,
          refreshDue: true,
          refreshReason,
        })
      }
    } catch (e) {
      await recordAuthLifecycleEvent({
        event: "profile_refresh_failed",
        source: "jwt_callback",
        user_id: userId,
        username: normalizeUsernameForLog(token.username),
        tenant_id: coerceTenantId(token.don_vi),
        ...requestContext,
        metadata: {
          trigger,
          refreshReason,
        },
      })
      emitAuthJwtTelemetry("jwt_refresh_failed", {
        userId,
        trigger,
        hasLastRefreshAt: lastRefreshAt !== null,
        refreshDue: true,
        refreshReason,
      })
      if (e instanceof AuthRefreshConfigError) {
        throw e
      }
      // Log but don't break auth flow for database errors
      console.error("Password change check failed:", e)
    }

    return token
  },
  async session({ session, token }) {
    // Expose custom fields to the client session
    return applyJwtToSession(session, token)
  },
}
