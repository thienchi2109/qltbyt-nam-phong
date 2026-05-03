import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"
import {
  applyAuthUserToJwt,
  applyJwtProfileRefresh,
  applyJwtToSession,
  buildAuthUserFromRpcResult,
  type AuthProfileRow,
  type AuthRpcUserRow,
} from "./types"

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

      // Cooldown: skip the per-request profile fetch if we refreshed recently.
      // Force a refresh when NextAuth indicates an explicit update (e.g.
      // tenant switch via session.update()).
      const lastRefreshAt = typeof token.lastRefreshAt === "number" ? token.lastRefreshAt : null
      const isExplicitUpdate = trigger === "update" || Boolean(user)
      if (
        !isExplicitUpdate &&
        lastRefreshAt !== null &&
        now - lastRefreshAt < PROFILE_REFRESH_INTERVAL_MS
      ) {
        return token
      }

      // Refresh user-derived fields
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (supabaseUrl && serviceKey) {
          const supabase = createClient(supabaseUrl, serviceKey)
          const { data, error } = await supabase
            .from("nhan_vien")
            .select("password_changed_at, current_don_vi, don_vi, khoa_phong, full_name, dia_ban_id")
            .eq("id", token.id)
            .single()

          if (!error && data) {
            const profile = data as AuthProfileRow
            // Password change invalidates session if changed after login
            if (token.loginTime && profile.password_changed_at) {
              const passwordChangedAt = new Date(profile.password_changed_at).getTime()
              const tokenLoginTime = token.loginTime as number
              if (passwordChangedAt > tokenLoginTime) {
                console.warn("Password changed after login - invalidating token")
                return {}
              }
            }
            // Keep JWT in sync with user profile for tenant-aware UI
            const resolvedDonVi = profile.current_don_vi || profile.don_vi || null
            let resolvedDiaBan: number | null = profile.dia_ban_id ?? null
            let resolvedDiaBanMa: string | null = token.dia_ban_ma ?? null
            // Supabase v2 returns `{ data, error }` rather than throwing for
            // failed table reads, so we must inspect `error` explicitly and
            // only stamp lastRefreshAt when every required lookup succeeded.
            // Otherwise a transient secondary failure would be frozen in
            // for the entire cooldown window.
            let secondaryLookupsOk = true

            if (!resolvedDiaBan && resolvedDonVi) {
              try {
                const { data: donViRows, error: donViError } = await supabase
                  .from("don_vi")
                  .select("dia_ban_id")
                  .eq("id", resolvedDonVi)
                  .limit(1)

                if (donViError) {
                  console.warn("[jwt] don_vi lookup returned error", {
                    message: donViError.message,
                    don_vi: resolvedDonVi,
                  })
                  secondaryLookupsOk = false
                } else if (donViRows && donViRows.length > 0) {
                  resolvedDiaBan = donViRows[0]?.dia_ban_id ?? null
                }
              } catch (donViLookupError) {
                console.error("[jwt] don_vi lookup threw", donViLookupError)
                secondaryLookupsOk = false
              }
            }

            if (resolvedDiaBan && !resolvedDiaBanMa) {
              try {
                const { data: diaBanRows, error: diaBanError } = await supabase
                  .from("dia_ban")
                  .select("ma_dia_ban")
                  .eq("id", resolvedDiaBan)
                  .limit(1)

                if (diaBanError) {
                  console.warn("[jwt] dia_ban lookup returned error", {
                    message: diaBanError.message,
                    dia_ban_id: resolvedDiaBan,
                  })
                  secondaryLookupsOk = false
                } else if (diaBanRows && diaBanRows.length > 0) {
                  resolvedDiaBanMa = diaBanRows[0]?.ma_dia_ban ?? null
                }
              } catch (diaBanLookupError) {
                console.error("[jwt] dia_ban lookup threw", diaBanLookupError)
                secondaryLookupsOk = false
              }
            }

            token = applyJwtProfileRefresh(token, profile, resolvedDonVi, resolvedDiaBan, resolvedDiaBanMa)
            // Stamp lastRefreshAt only when every required lookup succeeded
            // so transient failures do not extend the cooldown beyond what
            // they should. A failing primary fetch never reaches this line.
            if (secondaryLookupsOk) {
              token.lastRefreshAt = now
            }
          }
        }
      } catch (e) {
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
