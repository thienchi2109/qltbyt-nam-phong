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
            // fall through to legacy fallback below
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
              } as any
            }
          }
          // Legacy fallback: direct table check for plain-text passwords
          // Block suspicious passwords
          if (
            password === 'hashed password' ||
            password.toLowerCase().includes('hash') ||
            password.toLowerCase().includes('crypt') ||
            password.length > 200
          ) {
            return null
          }

          const { data: fallbackData, error: fallbackError } = await supabase
            .from('nhan_vien')
            .select('id, username, full_name, role, khoa_phong, password')
            .eq('username', username)
            .single()

          if (fallbackError || !fallbackData) {
            return null
          }

          if (fallbackData.password && fallbackData.password !== 'hashed password' && fallbackData.password === password) {
            return {
              id: String(fallbackData.id),
              name: fallbackData.full_name || fallbackData.username,
              username: fallbackData.username,
              role: fallbackData.role,
              khoa_phong: fallbackData.khoa_phong || "",
              full_name: fallbackData.full_name || "",
              auth_mode: 'plain',
            } as any
          }

          return null
        } catch (e) {
          console.error("Authorize exception:", e)
          return null
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
              .select('password_changed_at, current_don_vi, don_vi, khoa_phong, full_name')
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
              ;(token as any).don_vi = data.current_don_vi || data.don_vi || null
              ;(token as any).khoa_phong = data.khoa_phong || (token as any).khoa_phong
              token.full_name = (data as any).full_name || token.full_name
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
      s.user.full_name = token.full_name || s.user.name
      return s
    },
  },
}
