import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"

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
            throw new Error('rpc_error')
          }

          if (data && Array.isArray(data) && data.length > 0) {
            const authResult = data[0] as any
            if (authResult?.is_authenticated) {
              // Map to NextAuth user object
              return {
                id: String(authResult.user_id),
                name: authResult.full_name || authResult.username,
                username: authResult.username,
                role: authResult.role,
                khoa_phong: authResult.khoa_phong || "",
                full_name: authResult.full_name || "",
                auth_mode: authResult.authentication_mode || "",
                don_vi: authResult.don_vi ?? null,
                dia_ban_id: authResult.dia_ban_id ?? null,
                dia_ban_ma: authResult.dia_ban_ma ?? null,
              } as any
            }

            if (authResult?.authentication_mode === 'tenant_inactive') {
              console.warn('Login blocked because tenant is inactive', { username })
              throw new Error('tenant_inactive')
            }
          }

          throw new Error('invalid_credentials')
        } catch (e) {
          if (e instanceof Error) {
            throw e
          }
          console.error("Authorize exception:", e)
          throw new Error('authorize_exception')
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, persist extra fields in the JWT
      if (user) {
        const u = user as any
        token.id = u.id
        token.username = u.username
        token.role = u.role
        token.khoa_phong = u.khoa_phong
        token.full_name = u.full_name || u.name
        token.auth_mode = u.auth_mode
        token.loginTime = Date.now() // Track when user logged in
        ;(token as any).don_vi = u.don_vi ?? null
        ;(token as any).dia_ban_id = u.dia_ban_id ?? null
        ;(token as any).dia_ban_ma = u.dia_ban_ma ?? null
      }

      // Refresh user-derived fields on every JWT callback
      if (token.id) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          if (supabaseUrl && serviceKey) {
            const supabase = createClient(supabaseUrl, serviceKey)
            const { data, error } = await supabase
              .from('nhan_vien')
              .select('password_changed_at, current_don_vi, don_vi, khoa_phong, full_name, dia_ban_id')
              .eq('id', token.id)
              .single()

            if (!error && data) {
              // Password change invalidates session if changed after login
              if (token.loginTime && data.password_changed_at) {
                const passwordChangedAt = new Date(data.password_changed_at).getTime()
                const tokenLoginTime = token.loginTime as number
                if (passwordChangedAt > tokenLoginTime) {
                  console.log('Password changed after login - invalidating token')
                  return {}
                }
              }
              // Keep JWT in sync with user profile for tenant-aware UI
              const resolvedDonVi = data.current_don_vi || data.don_vi || null
              ;(token as any).don_vi = resolvedDonVi
              ;(token as any).khoa_phong = data.khoa_phong || (token as any).khoa_phong
              token.full_name = (data as any).full_name || token.full_name

              let resolvedDiaBan: number | null = (data as any).dia_ban_id ?? null
              if (!resolvedDiaBan && resolvedDonVi) {
                try {
                  const { data: donViRows, error: donViError } = await supabase
                    .from('don_vi')
                    .select('dia_ban_id')
                    .eq('id', resolvedDonVi)
                    .limit(1)

                  if (!donViError && donViRows && donViRows.length > 0) {
                    resolvedDiaBan = donViRows[0]?.dia_ban_id ?? null
                  }
                } catch (donViLookupError) {
                  console.error('Failed to resolve dia_ban from don_vi', donViLookupError)
                }
              }

              let resolvedDiaBanMa: string | null = (token as any).dia_ban_ma ?? null
              if (resolvedDiaBan && !resolvedDiaBanMa) {
                try {
                  const { data: diaBanRows, error: diaBanError } = await supabase
                    .from('dia_ban')
                    .select('ma_dia_ban')
                    .eq('id', resolvedDiaBan)
                    .limit(1)

                  if (!diaBanError && diaBanRows && diaBanRows.length > 0) {
                    resolvedDiaBanMa = diaBanRows[0]?.ma_dia_ban ?? null
                  }
                } catch (diaBanLookupError) {
                  console.error('Failed to resolve dia_ban metadata', diaBanLookupError)
                }
              }

              ;(token as any).dia_ban_id = resolvedDiaBan ?? (token as any).dia_ban_id ?? null
              ;(token as any).dia_ban_ma = resolvedDiaBanMa
            }
          }
        } catch (e) {
          // Log but don't break auth flow for database errors
          console.error('Password change check failed:', e)
        }
      }

      return token
    },
    async session({ session, token }) {
      // Expose custom fields to the client session
      const s: any = session
      s.user = s.user || {}
      s.user.id = token.id
      s.user.username = token.username
      s.user.role = token.role
      s.user.khoa_phong = token.khoa_phong
      s.user.don_vi = (token as any).don_vi || null
      s.user.dia_ban_id = (token as any).dia_ban_id || null
      s.user.dia_ban_ma = (token as any).dia_ban_ma || null
      s.user.full_name = token.full_name || s.user.name
      return s
    },
  },
}
