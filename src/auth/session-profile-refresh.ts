import jwt from "jsonwebtoken"

import { buildSessionProfileJwtClaims } from "./server-claims"
import type { AuthProfileRow } from "./types"

const SUPABASE_JWT_CLOCK_SKEW_SECONDS = 60

/** Minimum time between automatic session profile refresh attempts. */
export const PROFILE_REFRESH_INTERVAL_MS = 60_000

/** Raised when session profile refresh cannot be configured safely. */
export class AuthRefreshConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthRefreshConfigError"
  }
}

/** Reads a required environment variable for session profile refresh. */
export function requireRefreshEnv(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_JWT_SECRET"
): string {
  const value = process.env[name]
  if (!value) {
    throw new AuthRefreshConfigError(`${name} is not configured`)
  }

  return value
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "JWT app_role is not configured"
}

/** Signs a short-lived JWT for the session profile refresh RPC. */
export function buildSessionProfileJwt(userId: string, role: unknown): string {
  const secret = requireRefreshEnv("SUPABASE_JWT_SECRET")
  const now = Math.floor(Date.now() / 1000)
  let claims: Record<string, string | number | null>
  try {
    claims = buildSessionProfileJwtClaims({
      userId,
      role,
      issuedAt: now - SUPABASE_JWT_CLOCK_SKEW_SECONDS,
      expiresAt: now + 120,
    })
  } catch (error: unknown) {
    throw new AuthRefreshConfigError(getErrorMessage(error))
  }

  return jwt.sign(
    claims,
    secret,
    { algorithm: "HS256" }
  )
}

/** Extracts the first profile row returned by the profile refresh RPC. */
export function firstProfileRow(data: unknown): AuthProfileRow | null {
  if (Array.isArray(data)) {
    return (data[0] as AuthProfileRow | undefined) ?? null
  }

  return (data as AuthProfileRow | null) ?? null
}
