import jwt from "jsonwebtoken"

import type { AuthProfileRow } from "./types"

const SUPABASE_JWT_CLOCK_SKEW_SECONDS = 60

export const PROFILE_REFRESH_INTERVAL_MS = 60_000

export class AuthRefreshConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthRefreshConfigError"
  }
}

export function requireRefreshEnv(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_JWT_SECRET"
): string {
  const value = process.env[name]
  if (!value) {
    throw new AuthRefreshConfigError(`${name} is not configured`)
  }

  return value
}

export function normalizeSessionProfileAppRole(role: unknown): string {
  if (typeof role !== "string") {
    return ""
  }

  const normalizedRole = role.trim().toLowerCase()
  return normalizedRole === "admin" ? "global" : normalizedRole
}

export function buildSessionProfileJwt(userId: string, appRole: string): string {
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

export function firstProfileRow(data: unknown): AuthProfileRow | null {
  if (Array.isArray(data)) {
    return (data[0] as AuthProfileRow | undefined) ?? null
  }

  return (data as AuthProfileRow | null) ?? null
}
