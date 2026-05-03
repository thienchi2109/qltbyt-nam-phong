import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"
import jwt from "jsonwebtoken"
import {
  applyAuthUserToJwt,
  applyJwtProfileRefresh,
  applyJwtToSession,
  buildAuthUserFromRpcResult,
  type AuthProfileRow,
  type AuthRpcUserRow,
} from "./types"
import { emitAuthJwtTelemetry } from "./telemetry"

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
      async authorize(credentials) {
        const username = credentials?.username?.toString().trim()
        const password = credentials?.password?.toString() || ""

        if (!username || !password) return null

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!supabaseUrl || !serviceKey) {
          console.error("Supabase env not configured")
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
            throw new Error("rpc_error")
          }

          if (data && Array.isArray(data) && data.length > 0) {
            const authResult = data[0] as AuthRpcUserRow
            if (authResult?.is_authenticated) {
              return buildAuthUserFromRpcResult(authResult)
            }

            if (authResult?.authentication_mode === "tenant_inactive") {
              console.warn("Login blocked because tenant is inactive", { username })
              throw new Error("tenant_inactive")
            }
          }

          throw new Error("invalid_credentials")
        } catch (e) {
          if (e instanceof Error) {
            throw e
          }
          console.error("Authorize exception:", e)
          throw new Error("authorize_exception")
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      const now = Date.now()

      // On sign-in, persist extra fields in the JWT
      if (user) {
        token = {
          ...applyAuthUserToJwt(token, user),
          loginTime: now, // Track when user logged in
        }
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
              emitAuthJwtTelemetry("jwt_token_invalidated_password_change", {
                userId,
                trigger,
                hasLastRefreshAt: lastRefreshAt !== null,
                refreshDue: true,
                refreshReason,
                invalidatedReason: "password_changed_after_login",
              })
              console.warn("Password changed after login - invalidating token")
              return {}
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
}
