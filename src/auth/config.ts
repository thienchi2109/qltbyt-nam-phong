import type { NextAuthOptions } from "next-auth"
import { headers } from "next/headers"
import Credentials from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"
import jwt from "jsonwebtoken"
import { emitAuthLifecycleLog } from "@/auth/logging"
import { emitAuthJwtTelemetry } from "@/auth/telemetry"
import type { AuthPendingSignoutReason } from "@/types/auth"
import {
  applyAuthUserToJwt,
  applyJwtProfileRefresh,
  applyJwtToSession,
  buildAuthUserFromRpcResult,
  type AuthProfileRow,
  type AuthRpcUserRow,
} from "./types"

const SUPABASE_JWT_CLOCK_SKEW_SECONDS = 60

// Cooldown for the per-request profile refresh in the jwt callback.
// Without this gate the callback issues 1-3 Supabase SELECTs on every
// invocation (page render, getServerSession call, useSession poll, …),
// which scales with traffic, not with auth-state changes. See issue #365.
//
// Trade-off: out-of-band invalidations (password change, tenant deactivation)
// are visible only after the cooldown elapses or after an explicit
// `trigger === 'update'` (e.g. tenant switch). 60s is intentionally short
// enough to keep the password-change story acceptable while cutting DB
// load to ~1 fetch / minute / active session.
const PROFILE_REFRESH_INTERVAL_MS = 60_000

class AuthRefreshConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthRefreshConfigError"
  }
}

type AuthRequestContext = {
  request_id: string | null
  ip_address: string | null
  user_agent: string | null
}

type HeaderGetter = {
  get(name: string): string | null
}

function normalizeUsernameForLog(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

function coerceTenantId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === "string") {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
  }

  return undefined
}

function readRequestContext(getHeader: (name: string) => string | null): AuthRequestContext {
  const forwardedFor = getHeader("x-forwarded-for")
  const requestId = getHeader("x-request-id") ?? getHeader("x-vercel-id")
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || null
  const userAgent = getHeader("user-agent")

  return {
    request_id: requestId,
    ip_address: ipAddress,
    user_agent: userAgent,
  }
}

function toHeaderGetter(rawHeaders: unknown): HeaderGetter | null {
  if (!rawHeaders) {
    return null
  }

  const maybeHeaderGetter = rawHeaders as { get?: unknown }
  if (typeof rawHeaders === "object" && rawHeaders !== null && typeof maybeHeaderGetter.get === "function") {
    const getHeader = (name: string) => (maybeHeaderGetter.get as (this: unknown, headerName: string) => unknown).call(rawHeaders, name)
    return {
      get(name: string) {
        const value = getHeader(name)
        return typeof value === "string" ? value : null
      },
    }
  }

  if (typeof rawHeaders === "object" && rawHeaders !== null) {
    const headerMap = rawHeaders as Record<string, string | string[] | undefined>
    return {
      get(name: string) {
        const value = headerMap[name] ?? headerMap[name.toLowerCase()]
        if (Array.isArray(value)) {
          return value[0] ?? null
        }
        return typeof value === "string" ? value : null
      },
    }
  }

  return null
}

function readAuthorizeRequestContext(req?: { headers?: unknown } | null): AuthRequestContext {
  const headerGetter = toHeaderGetter(req?.headers)
  if (!headerGetter) {
    return {
      request_id: null,
      ip_address: null,
      user_agent: null,
    }
  }

  return readRequestContext((name) => headerGetter.get(name))
}

async function readRuntimeRequestContext(): Promise<AuthRequestContext> {
  try {
    const runtimeHeaders = await headers()
    return readRequestContext((name) => runtimeHeaders.get(name))
  } catch {
    return {
      request_id: null,
      ip_address: null,
      user_agent: null,
    }
  }
}

function isPendingSignoutReason(value: unknown): value is AuthPendingSignoutReason {
  return value === "user_initiated" || value === "session_expired" || value === "forced_password_change"
}

function requireRefreshEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_JWT_SECRET"): string {
  const value = process.env[name]
  if (!value) {
    throw new AuthRefreshConfigError(`${name} is not configured`)
  }

  return value
}

function normalizeSessionProfileAppRole(role: unknown): string {
  if (typeof role !== "string") {
    return ""
  }

  const normalizedRole = role.trim().toLowerCase()
  return normalizedRole === "admin" ? "global" : normalizedRole
}

function buildSessionProfileJwt(userId: string, appRole: string): string {
  const secret = requireRefreshEnv("SUPABASE_JWT_SECRET")
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    {
      role: "authenticated",
      iat: now - SUPABASE_JWT_CLOCK_SKEW_SECONDS,
      exp: now + 120,
      sub: userId,
      user_id: userId,
      app_role: appRole,
    },
    secret,
    { algorithm: "HS256" }
  )
}

function firstProfileRow(data: unknown): AuthProfileRow | null {
  if (Array.isArray(data)) {
    return (data[0] as AuthProfileRow | undefined) ?? null
  }

  return (data as AuthProfileRow | null) ?? null
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 3 * 60 * 60, // 3 hours
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/", // reuse existing login page for now
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const username = credentials?.username?.toString().trim()
        const password = credentials?.password?.toString() || ""
        const requestContext = readAuthorizeRequestContext(req)
        const normalizedUsername = normalizeUsernameForLog(username)

        if (!username || !password) return null

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!supabaseUrl || !serviceKey) {
          console.error("Supabase env not configured")
          emitAuthLifecycleLog({
            source: "authorize",
            reason_code: "config_error",
            username: normalizedUsername,
            ...requestContext,
          })
          return null
        }

        const supabase = createClient(supabaseUrl, serviceKey)

        try {
          const { data, error } = await supabase.rpc("authenticate_user_dual_mode", {
            p_username: username,
            p_password: password,
          })

          if (error) {
            console.error("RPC auth error:", error)
            emitAuthLifecycleLog({
              source: "authorize",
              reason_code: "rpc_error",
              username: normalizedUsername,
              ...requestContext,
            })
            throw new Error("rpc_error")
          }

          if (data && Array.isArray(data) && data.length > 0) {
            const authResult = data[0] as AuthRpcUserRow
            if (authResult?.is_authenticated) {
              return buildAuthUserFromRpcResult(authResult)
            }

            if (authResult?.authentication_mode === "tenant_inactive") {
              console.warn("Login blocked because tenant is inactive", { username })
              emitAuthLifecycleLog({
                source: "authorize",
                reason_code: "tenant_inactive",
                username: normalizedUsername,
                ...requestContext,
              })
              throw new Error("tenant_inactive")
            }
          }

          emitAuthLifecycleLog({
            source: "authorize",
            reason_code: "invalid_credentials",
            username: normalizedUsername,
            ...requestContext,
          })
          throw new Error("invalid_credentials")
        } catch (e) {
          if (
            e instanceof Error &&
            (e.message === "rpc_error" || e.message === "tenant_inactive" || e.message === "invalid_credentials")
          ) {
            throw e
          }

          console.error("Authorize exception:", e)
          emitAuthLifecycleLog({
            source: "authorize",
            reason_code: "authorize_exception",
            username: normalizedUsername,
            ...requestContext,
            metadata: e instanceof Error
              ? {
                  error_message: e.message,
                }
              : undefined,
          })
          throw e instanceof Error ? e : new Error("authorize_exception")
        }
      },
    }),
  ],
  callbacks: {
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
      const isExplicitUpdate = trigger === "update" || Boolean(user)
      const refreshReason = user
        ? "sign_in"
        : trigger === "update"
          ? "update_trigger"
          : "interval_elapsed"

      emitAuthJwtTelemetry("jwt_callback_invoked", {
        userId,
        trigger,
        hasLastRefreshAt: lastRefreshAt !== null,
        refreshDue: isExplicitUpdate || lastRefreshAt === null || now - lastRefreshAt >= PROFILE_REFRESH_INTERVAL_MS,
        refreshReason,
      })

      if (
        !isExplicitUpdate &&
        lastRefreshAt !== null &&
        now - lastRefreshAt < PROFILE_REFRESH_INTERVAL_MS
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
        const { data, error } = await supabase
          .rpc("get_session_profile_for_jwt", { p_user_id: userId })

        if (error) {
          emitAuthLifecycleLog({
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
            emitAuthLifecycleLog({
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
              emitAuthLifecycleLog({
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
              return signoutReason
                ? {
                    pending_signout_reason: signoutReason,
                  }
                : {}
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
        emitAuthLifecycleLog({
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
  },
  events: {
    async signIn({ user }) {
      const requestContext = await readRuntimeRequestContext()

      emitAuthLifecycleLog({
        event: "login_success",
        source: "events_signin",
        user_id: typeof user.id === "string" ? user.id : user.id != null ? String(user.id) : undefined,
        username: normalizeUsernameForLog(user.username ?? user.name),
        tenant_id: coerceTenantId(user.don_vi),
        ...requestContext,
      })
    },
    async signOut({ token, session }) {
      const pendingReason = isPendingSignoutReason(token?.pending_signout_reason)
        ? token.pending_signout_reason
        : undefined
      const userId = typeof token?.id === "string" ? token.id : token?.id != null ? String(token.id) : undefined
      const username = normalizeUsernameForLog(token?.username ?? session?.user?.name)
      const tenantId = coerceTenantId(token?.don_vi)

      if (!userId && !username && !tenantId && !pendingReason) {
        return
      }

      const metadata: Record<string, unknown> = {}
      if (typeof token?.loginTime === "number") {
        metadata.session_duration_ms = Math.max(0, Date.now() - token.loginTime)
      }

      emitAuthLifecycleLog({
        source: "events_signout",
        signout_reason: pendingReason ?? "session_expired",
        user_id: userId,
        username,
        tenant_id: tenantId,
        ...(await readRuntimeRequestContext()),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      })
    },
  },
}
