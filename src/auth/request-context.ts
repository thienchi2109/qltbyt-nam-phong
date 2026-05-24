import { headers } from "next/headers"

import type { AuthPendingSignoutReason } from "@/types/auth"

export type AuthRequestContext = {
  request_id: string | null
  ip_address: string | null
  user_agent: string | null
}

type HeaderGetter = {
  get(name: string): string | null
}

const TRUSTED_CLIENT_IP_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-real-ip",
] as const

/** Normalizes a user-supplied username for auth logs and throttle keys. */
export function normalizeUsernameForLog(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

/** Coerces a tenant identifier from auth token/session data into log-safe text. */
export function coerceTenantId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === "string") {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
  }

  return undefined
}

function readSingleIpHeader(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed && !trimmed.includes(",") ? trimmed : null
}

function readForwardedForIp(value: string | null): string | null {
  const hops = value
    ?.split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)

  if (!hops || hops.length === 0) {
    return null
  }

  // Left-most X-Forwarded-For hops can be client supplied. Without trusted
  // proxy CIDRs, use the nearest hop so attackers cannot rotate throttle buckets.
  return hops[hops.length - 1] ?? null
}

function readClientIpAddress(getHeader: (name: string) => string | null): string | null {
  for (const headerName of TRUSTED_CLIENT_IP_HEADERS) {
    const trustedIp = readSingleIpHeader(getHeader(headerName))
    if (trustedIp) {
      return trustedIp
    }
  }

  return readForwardedForIp(getHeader("x-forwarded-for"))
}

function readRequestContext(getHeader: (name: string) => string | null): AuthRequestContext {
  const requestId = getHeader("x-request-id") ?? getHeader("x-vercel-id")
  const ipAddress = readClientIpAddress(getHeader)
  const userAgent = getHeader("user-agent")

  return {
    request_id: requestId,
    ip_address: ipAddress,
    user_agent: userAgent,
  }
}

function toHeaderGetter(rawHeaders: unknown): HeaderGetter | null {
  if (!rawHeaders) {
    return null
  }

  const maybeHeaderGetter = rawHeaders as { get?: unknown }
  if (typeof rawHeaders === "object" && rawHeaders !== null && typeof maybeHeaderGetter.get === "function") {
    const getHeader = (name: string) =>
      (maybeHeaderGetter.get as (this: unknown, headerName: string) => unknown).call(rawHeaders, name)
    return {
      get(name: string) {
        const value = getHeader(name)
        return typeof value === "string" ? value : null
      },
    }
  }

  if (typeof rawHeaders === "object" && rawHeaders !== null) {
    const headerMap = rawHeaders as Record<string, string | string[] | undefined>
    return {
      get(name: string) {
        const value = headerMap[name] ?? headerMap[name.toLowerCase()]
        if (Array.isArray(value)) {
          return value[0] ?? null
        }
        return typeof value === "string" ? value : null
      },
    }
  }

  return null
}

/** Reads request metadata from a NextAuth credentials authorize request. */
export function readAuthorizeRequestContext(req?: { headers?: unknown } | null): AuthRequestContext {
  const headerGetter = toHeaderGetter(req?.headers)
  if (!headerGetter) {
    return {
      request_id: null,
      ip_address: null,
      user_agent: null,
    }
  }

  return readRequestContext((name) => headerGetter.get(name))
}

/** Reads request metadata from the current Next.js runtime headers. */
export async function readRuntimeRequestContext(): Promise<AuthRequestContext> {
  try {
    const runtimeHeaders = await headers()
    return readRequestContext((name) => runtimeHeaders.get(name))
  } catch {
    return {
      request_id: null,
      ip_address: null,
      user_agent: null,
    }
  }
}

/** Checks whether persisted auth state contains a supported pending sign-out reason. */
export function isPendingSignoutReason(value: unknown): value is AuthPendingSignoutReason {
  return value === "user_initiated" || value === "session_expired" || value === "forced_password_change"
}
