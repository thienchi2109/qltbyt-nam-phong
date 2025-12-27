import type { DefaultSession } from "next-auth"
import type { DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      role: string
      khoa_phong?: string | null
      don_vi?: string | number | null
      current_don_vi?: number | null  // Currently selected tenant for multi-tenant users
      dia_ban_id?: string | number | null
      dia_ban_ma?: string | null
      full_name?: string | null
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string
    username?: string
    role?: string
    khoa_phong?: string | null
    don_vi?: string | number | null
    current_don_vi?: number | null  // Currently selected tenant for multi-tenant users
    dia_ban_id?: string | number | null
    dia_ban_ma?: string | null
    full_name?: string | null
    auth_mode?: string | null
    loginTime?: number
  }
}
