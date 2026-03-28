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
    async jwt({ token, user }) {
      // On sign-in, persist extra fields in the JWT
      if (user) {
        token = {
          ...applyAuthUserToJwt(token, user),
          loginTime: Date.now(), // Track when user logged in
        }
      }

      // Refresh user-derived fields on every JWT callback
      if (token.id) {
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

              if (!resolvedDiaBan && resolvedDonVi) {
                try {
                  const { data: donViRows, error: donViError } = await supabase
                    .from("don_vi")
                    .select("dia_ban_id")
                    .eq("id", resolvedDonVi)
                    .limit(1)

                  if (!donViError && donViRows && donViRows.length > 0) {
                    resolvedDiaBan = donViRows[0]?.dia_ban_id ?? null
                  }
                } catch (donViLookupError) {
                  console.error("Failed to resolve dia_ban from don_vi", donViLookupError)
                }
              }

              if (resolvedDiaBan && !resolvedDiaBanMa) {
                try {
                  const { data: diaBanRows, error: diaBanError } = await supabase
                    .from("dia_ban")
                    .select("ma_dia_ban")
                    .eq("id", resolvedDiaBan)
                    .limit(1)

                  if (!diaBanError && diaBanRows && diaBanRows.length > 0) {
                    resolvedDiaBanMa = diaBanRows[0]?.ma_dia_ban ?? null
                  }
                } catch (diaBanLookupError) {
                  console.error("Failed to resolve dia_ban metadata", diaBanLookupError)
                }
              }

              token = applyJwtProfileRefresh(token, profile, resolvedDonVi, resolvedDiaBan, resolvedDiaBanMa)
            }
          }
        } catch (e) {
          // Log but don't break auth flow for database errors
          console.error("Password change check failed:", e)
        }
      }

      return token
    },
    async session({ session, token }) {
      // Expose custom fields to the client session
      return applyJwtToSession(session, token)
    },
  },
}
