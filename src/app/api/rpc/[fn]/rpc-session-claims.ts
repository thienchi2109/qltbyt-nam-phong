import { toAppRoleClaim } from "@/auth/server-claims"
import {
  isEquipmentManagerRole,
  isGlobalRole,
  isRegionalLeaderRole,
  isTechnicalConfigurationExpertRole,
} from "@/lib/rbac"

export type RpcProxySessionUser = {
  role?: unknown
  don_vi?: unknown
  current_don_vi?: unknown
  dia_ban_id?: unknown
  khoa_phong?: unknown
  id?: unknown
}

export type RpcSessionClaims = {
  role: string
  donVi: string | null
  currentDonVi: string | null
  diaBan: string
  khoaPhong: string | null
  userId: string
  appRole: string
}

function sessionClaimValue(value: unknown): string | null {
  if (value == null) {
    return null
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }

  return null
}

/** Extracts the trusted user payload from an unknown NextAuth session value. */
export function getSessionUser(session: unknown): RpcProxySessionUser | null {
  if (!session || typeof session !== "object" || !("user" in session)) {
    return null
  }

  const user = session.user
  if (!user || typeof user !== "object") {
    return null
  }
  return user as RpcProxySessionUser
}

/** Validates and normalizes the session claims required by the RPC proxy. */
export function getSessionClaims(sessionUser: RpcProxySessionUser): RpcSessionClaims | null {
  const hasValidKhoaPhongType =
    sessionUser.khoa_phong == null ||
    typeof sessionUser.khoa_phong === "string" ||
    typeof sessionUser.khoa_phong === "number"
  const role = sessionClaimValue(sessionUser.role)
  const assignedDonVi = sessionClaimValue(sessionUser.don_vi)
  const currentDonVi = sessionClaimValue(sessionUser.current_don_vi)
  const diaBan = sessionClaimValue(sessionUser.dia_ban_id)
  const khoaPhong = sessionClaimValue(sessionUser.khoa_phong)
  const userId = sessionClaimValue(sessionUser.id)

  if (role == null || diaBan == null || userId == null || !hasValidKhoaPhongType) {
    return null
  }

  const appRole = toAppRoleClaim(role)
  const donVi = isEquipmentManagerRole(appRole) ? (currentDonVi ?? assignedDonVi) : assignedDonVi
  const isExpert = isTechnicalConfigurationExpertRole(appRole)
  if (isExpert && (!donVi?.trim() || !diaBan.trim() || !userId.trim())) {
    return null
  }
  if (khoaPhong == null && !isExpert) {
    return null
  }
  if (donVi == null && !isGlobalRole(appRole) && !isRegionalLeaderRole(appRole)) {
    return null
  }

  return {
    role,
    donVi,
    currentDonVi,
    diaBan,
    khoaPhong,
    userId,
    appRole,
  }
}
