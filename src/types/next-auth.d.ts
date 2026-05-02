import type { DefaultSession } from "next-auth"
import type { DefaultJWT } from "next-auth/jwt"

type NextAuthUserFields = {
  id: string
  username: string
  role: string
  khoa_phong?: string | null
  don_vi?: string | number | null
  current_don_vi?: number | null
  dia_ban_id?: string | number | null
  dia_ban_ma?: string | null
  full_name?: string | null
  auth_mode?: string | null
}

declare module "next-auth" {
  interface User extends NextAuthUserFields {}

  interface Session {
    user: NextAuthUserFields & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT, Partial<NextAuthUserFields> {
    loginTime?: number
    lastRefreshAt?: number
  }
}
