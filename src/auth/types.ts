import type { Session, User } from "next-auth"
import type { JWT } from "next-auth/jwt"

export interface AuthRpcUserRow {
  is_authenticated?: boolean
  user_id?: string | number | null
  username?: string | null
  full_name?: string | null
  role?: string | null
  khoa_phong?: string | null
  authentication_mode?: string | null
  don_vi?: string | number | null
  dia_ban_id?: string | number | null
  dia_ban_ma?: string | null
}

export interface AuthProfileRow {
  password_changed_at: string | null
  current_don_vi: number | null
  don_vi: number | null
  khoa_phong: string | null
  full_name: string | null
  dia_ban_id: number | null
  ma_dia_ban: string | null
}

export interface AuthUserInput {
  id?: string
  username?: string | null
  role?: string | null
  khoa_phong?: string | null
  don_vi?: string | number | null
  dia_ban_id?: string | number | null
  dia_ban_ma?: string | null
  full_name?: string | null
  auth_mode?: string | null
  name?: string | null
}

export function buildAuthUserFromRpcResult(authResult: AuthRpcUserRow): User {
  return {
    id: String(authResult.user_id ?? ""),
    name: authResult.full_name || authResult.username || "",
    username: authResult.username || "",
    role: authResult.role || "",
    khoa_phong: authResult.khoa_phong || "",
    full_name: authResult.full_name || "",
    auth_mode: authResult.authentication_mode || "",
    don_vi: authResult.don_vi ?? null,
    dia_ban_id: authResult.dia_ban_id ?? null,
    dia_ban_ma: authResult.dia_ban_ma ?? null,
  }
}

export function applyAuthUserToJwt(token: JWT, user: AuthUserInput): JWT {
  return {
    ...token,
    id: user.id || token.id,
    username: user.username ?? token.username,
    role: user.role ?? token.role,
    khoa_phong: user.khoa_phong ?? token.khoa_phong ?? null,
    full_name: user.full_name || user.name || token.full_name,
    auth_mode: user.auth_mode ?? token.auth_mode ?? null,
    don_vi: user.don_vi ?? token.don_vi ?? null,
    dia_ban_id: user.dia_ban_id ?? token.dia_ban_id ?? null,
    dia_ban_ma: user.dia_ban_ma ?? token.dia_ban_ma ?? null,
  }
}

export function applyJwtProfileRefresh(
  token: JWT,
  profile: AuthProfileRow,
  resolvedDonVi: string | number | null,
  resolvedDiaBan: number | null,
  resolvedDiaBanMa: string | null
): JWT {
  return {
    ...token,
    don_vi: resolvedDonVi,
    khoa_phong: profile.khoa_phong || token.khoa_phong || null,
    full_name: profile.full_name || token.full_name,
    dia_ban_id: resolvedDiaBan ?? token.dia_ban_id ?? null,
    dia_ban_ma: resolvedDiaBanMa ?? token.dia_ban_ma ?? null,
  }
}

export function applyJwtToSession(session: Session, token: JWT): Session {
  return {
    ...session,
    pending_signout_reason: token.pending_signout_reason ?? null,
    user: {
      ...session.user,
      id: token.id ?? session.user.id,
      username: token.username ?? "",
      role: token.role ?? "",
      khoa_phong: token.khoa_phong ?? null,
      don_vi: token.don_vi ?? null,
      current_don_vi: token.current_don_vi ?? null,
      dia_ban_id: token.dia_ban_id ?? null,
      dia_ban_ma: token.dia_ban_ma ?? null,
      full_name: token.full_name || session.user.name || null,
      auth_mode: token.auth_mode ?? null,
    },
  }
}
