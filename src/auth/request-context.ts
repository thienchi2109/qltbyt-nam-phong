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

export function normalizeUsernameForLog(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

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

function readRequestContext(getHeader: (name: string) => string | null): AuthRequestContext {
  const forwardedFor = getHeader("x-forwarded-for")
  const requestId = getHeader("x-request-id") ?? getHeader("x-vercel-id")
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || null
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

export function isPendingSignoutReason(value: unknown): value is AuthPendingSignoutReason {
  return value === "user_initiated" || value === "session_expired" || value === "forced_password_change"
}
