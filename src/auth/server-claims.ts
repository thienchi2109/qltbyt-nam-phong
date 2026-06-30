import "server-only"

export type SupabaseRpcUser = {
  id?: unknown
  role?: unknown
  don_vi?: unknown
  dia_ban_id?: unknown
  khoa_phong?: unknown
}

type AuthJwtClaimValue = string | number | null

type TimeBoundClaimInput = {
  issuedAt: number
  expiresAt: number
}

type SessionProfileJwtClaimInput = TimeBoundClaimInput & {
  userId: unknown
  role: unknown
}

type SupabaseRpcJwtClaimInput = TimeBoundClaimInput & {
  user: SupabaseRpcUser
  dbRole?: "authenticated" | "service_role"
}

function toStringClaim(value: unknown): string {
  if (typeof value === "string") {
    return value.trim()
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return ""
}

/** Converts optional session values to nullable string JWT claims. */
export function toNullableJwtClaim(value: unknown): string | null {
  const stringValue = toStringClaim(value)
  return stringValue ? stringValue : null
}

/** Normalizes application roles into the Postgres app_role claim. */
export function toAppRoleClaim(role: unknown): string {
  const roleValue = toStringClaim(role).toLowerCase()
  return roleValue === "admin" ? "global" : roleValue
}

/** Returns a required user_id claim or fails closed before JWT signing. */
export function toRequiredUserIdClaim(
  userId: unknown,
  message = "Cannot mint Supabase RPC JWT without user id"
): string {
  const userIdClaim = toStringClaim(userId)
  if (!userIdClaim) {
    throw new Error(message)
  }

  return userIdClaim
}

function toRequiredAppRoleClaim(
  role: unknown,
  message = "Cannot mint Supabase RPC JWT without app_role"
): string {
  const appRole = toAppRoleClaim(role)
  if (!appRole) {
    throw new Error(message)
  }

  return appRole
}

/** Builds the minimal JWT claims used to refresh a NextAuth session profile. */
export function buildSessionProfileJwtClaims({
  userId,
  role,
  issuedAt,
  expiresAt,
}: SessionProfileJwtClaimInput): Record<string, AuthJwtClaimValue> {
  const userIdClaim = toRequiredUserIdClaim(userId, "JWT user_id is not configured")
  const appRole = toRequiredAppRoleClaim(role, "JWT app_role is not configured")

  return {
    role: "authenticated",
    iat: issuedAt,
    exp: expiresAt,
    sub: userIdClaim,
    user_id: userIdClaim,
    app_role: appRole,
  }
}

/** Builds Supabase PostgREST RPC JWT claims from a trusted server session user. */
export function buildSupabaseRpcJwtClaims({
  user,
  issuedAt,
  expiresAt,
  dbRole = "authenticated",
}: SupabaseRpcJwtClaimInput): Record<string, AuthJwtClaimValue> {
  const userId = toRequiredUserIdClaim(user.id)
  const appRole = toRequiredAppRoleClaim(user.role)

  return {
    role: dbRole,
    iat: issuedAt,
    exp: expiresAt,
    sub: userId,
    app_role: appRole,
    don_vi: toNullableJwtClaim(user.don_vi),
    user_id: userId,
    dia_ban: toNullableJwtClaim(user.dia_ban_id),
    khoa_phong: toNullableJwtClaim(user.khoa_phong),
  }
}
