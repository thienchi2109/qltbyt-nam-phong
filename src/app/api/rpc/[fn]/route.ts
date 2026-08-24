import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/auth/config"
import { mintSupabaseJwt } from "@/lib/ai/server-rpc"
import { sanitizeForLog } from "@/lib/log-sanitizer"
import { isTechnicalConfigurationExpertRole } from "@/lib/rbac"
import { SameOriginRequestError, assertSameOriginRequest } from "@/lib/same-origin-request"
import {
  ZBS_INTERNAL_RPC_BODY_SHA256_HEADER,
  ZBS_INTERNAL_RPC_SIGNATURE_HEADER,
  ZBS_INTERNAL_RPC_SOURCE,
  ZBS_INTERNAL_RPC_SOURCE_HEADER,
  ZBS_INTERNAL_RPC_TIMESTAMP_HEADER,
  hashZbsInternalRpcBody,
  isValidZbsInternalRpcSignature,
} from "@/lib/zbs/internal-rpc-signature"

import {
  ALLOWED_FUNCTIONS,
  EXPERT_ALLOWED_FUNCTIONS,
  SERVICE_ROLE_RPC_FUNCTIONS,
  TECHNICAL_CONFIGURATION_RPC_FUNCTIONS,
  ZBS_CRON_RPC_FUNCTIONS,
} from "./allowed-functions"
import { getSessionClaims, getSessionUser, type RpcSessionClaims } from "./rpc-session-claims"

/** Run the RPC proxy on Node.js so JWT signing uses the server crypto stack. */
export const runtime = "nodejs"

// SECURITY: Maximum request body size (2MB) to prevent DoS via memory exhaustion
const MAX_BODY_SIZE = 2 * 1024 * 1024

function getEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error"
}

function rpcClientErrorPayload(status: number, payload: unknown) {
  if (status >= 500) {
    return { error: "RPC upstream error" }
  }

  return { error: payload || "RPC error" }
}

function tenantClaimParameter(value: string | null): number | string | null {
  if (!value) {
    return null
  }

  return Number.isFinite(Number(value)) ? Number(value) : value
}

function tenantScopedRpcBody(
  body: Record<string, unknown>,
  claims: Pick<RpcSessionClaims, "donVi" | "diaBan">
): Record<string, unknown> {
  return {
    ...body,
    ...(Object.hasOwn(body, "p_don_vi") ? { p_don_vi: tenantClaimParameter(claims.donVi) } : {}),
    ...(Object.hasOwn(body, "p_dia_ban") ? { p_dia_ban: tenantClaimParameter(claims.diaBan) } : {}),
  }
}

function canInvokeServiceRoleRpc(claims: Pick<RpcSessionClaims, "appRole">): boolean {
  return claims.appRole === "global" || claims.appRole === "to_qltb"
}

function readInternalRpcSigningSecret() {
  return process.env.ZBS_INTERNAL_RPC_SECRET
}

function hasInternalZbsCronRpcHeaders(req: NextRequest, fn: string): boolean {
  const cronSecret = process.env.CRON_SECRET
  return (
    Boolean(cronSecret) &&
    ZBS_CRON_RPC_FUNCTIONS.has(fn) &&
    req.headers.get(ZBS_INTERNAL_RPC_SOURCE_HEADER) === ZBS_INTERNAL_RPC_SOURCE &&
    req.headers.get("authorization") === `Bearer ${cronSecret}` &&
    Boolean(req.headers.get(ZBS_INTERNAL_RPC_TIMESTAMP_HEADER)) &&
    Boolean(req.headers.get(ZBS_INTERNAL_RPC_BODY_SHA256_HEADER)) &&
    Boolean(req.headers.get(ZBS_INTERNAL_RPC_SIGNATURE_HEADER))
  )
}

function isInternalZbsCronRpc(req: NextRequest, fn: string, rawBody: string): boolean {
  return (
    hasInternalZbsCronRpcHeaders(req, fn) &&
    isValidZbsInternalRpcSignature({
      secret: readInternalRpcSigningSecret(),
      fn,
      timestamp: req.headers.get(ZBS_INTERNAL_RPC_TIMESTAMP_HEADER),
      bodySha256: hashZbsInternalRpcBody(rawBody),
      bodySha256Header: req.headers.get(ZBS_INTERNAL_RPC_BODY_SHA256_HEADER),
      signature: req.headers.get(ZBS_INTERNAL_RPC_SIGNATURE_HEADER),
    })
  )
}

function getInternalZbsCronClaims(): RpcSessionClaims {
  return {
    role: "to_qltb",
    donVi: "0",
    diaBan: "0",
    khoaPhong: "zbs-dispatch",
    userId: "zbs-dispatch-cron",
    appRole: "to_qltb",
  }
}

/** Proxies allowlisted Supabase RPC calls with JWT claims derived from the server session. */
export async function POST(req: NextRequest, context: { params: Promise<{ fn: string }> }) {
  try {
    const { fn } = await context.params
    try {
      assertSameOriginRequest(req)
    } catch (err: unknown) {
      if (err instanceof SameOriginRequestError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      throw err
    }

    if (!ALLOWED_FUNCTIONS.has(fn)) {
      return NextResponse.json({ error: "Function not allowed" }, { status: 403 })
    }

    const isZbsCronRpc = ZBS_CRON_RPC_FUNCTIONS.has(fn)
    const hasInternalZbsCronHeaders = isZbsCronRpc && hasInternalZbsCronRpcHeaders(req, fn)
    const contentLengthHeader = req.headers.get("content-length")
    if (isZbsCronRpc && !hasInternalZbsCronHeaders && !contentLengthHeader) {
      return NextResponse.json({ error: "Cron-only RPC not allowed" }, { status: 403 })
    }

    // SECURITY: Enforce body size limit BEFORE buffering/parsing to prevent DoS
    // 1. Require Content-Length header - reject chunked/streaming requests without it
    if (!contentLengthHeader) {
      return NextResponse.json({ error: "Content-Length header required" }, { status: 411 })
    }

    // 2. Validate Content-Length is within limit
    const contentLength = parseInt(contentLengthHeader, 10)
    if (isNaN(contentLength) || contentLength < 0) {
      return NextResponse.json({ error: "Invalid Content-Length" }, { status: 400 })
    }
    if (contentLength > MAX_BODY_SIZE) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 })
    }

    // 3. Read raw body with size enforcement (defense in depth against spoofed header)
    // SECURITY: Use arrayBuffer to measure actual bytes, not UTF-16 code units
    const buf = await req.arrayBuffer()
    if (buf.byteLength > MAX_BODY_SIZE) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 })
    }

    // 4. Decode buffer to text and parse JSON
    let rawBody: unknown = {}
    let rawText = ""
    try {
      rawText = new TextDecoder().decode(buf)
      rawBody = rawText ? JSON.parse(rawText) : {}
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const isInternalZbsCron = isZbsCronRpc && isInternalZbsCronRpc(req, fn, rawText)
    if (hasInternalZbsCronHeaders && !isInternalZbsCron) {
      return NextResponse.json({ error: "Cron-only RPC not allowed" }, { status: 403 })
    }
    const claims = isInternalZbsCron
      ? getInternalZbsCronClaims()
      : await (async (): Promise<RpcSessionClaims | NextResponse> => {
          // Pull claims from NextAuth session securely (no client headers trusted)
          const session = await getServerSession(authOptions)
          const sessionUser = getSessionUser(session)

          // SECURITY: Reject unauthenticated requests - do NOT mint JWT without valid session
          if (!sessionUser) {
            if (isZbsCronRpc) {
              return NextResponse.json({ error: "Cron-only RPC not allowed" }, { status: 403 })
            }
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
          }

          const sessionClaims = getSessionClaims(sessionUser)
          if (!sessionClaims) {
            if (isZbsCronRpc) {
              return NextResponse.json({ error: "Cron-only RPC not allowed" }, { status: 403 })
            }
            return NextResponse.json({ error: "Invalid session claims" }, { status: 400 })
          }
          return sessionClaims
        })()
    if (claims instanceof NextResponse) {
      return claims
    }
    // (debug removed)

    const isExpert = isTechnicalConfigurationExpertRole(claims.appRole)
    if (isExpert && !EXPERT_ALLOWED_FUNCTIONS.has(fn)) {
      return NextResponse.json({ error: "Function not allowed" }, { status: 403 })
    }
    if (isZbsCronRpc && !isInternalZbsCron) {
      return NextResponse.json({ error: "Cron-only RPC not allowed" }, { status: 403 })
    }

    // Sanitize tenant parameter for non-global users to enforce isolation
    // EXCEPTION: regional_leader users can see multiple tenants, don't override p_don_vi
    const requestBody: Record<string, unknown> =
      rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
        ? { ...(rawBody as Record<string, unknown>) }
        : {}
    const preservesCallerTenantScope = isExpert && TECHNICAL_CONFIGURATION_RPC_FUNCTIONS.has(fn)
    const body =
      !preservesCallerTenantScope &&
      claims.appRole !== "global" &&
      claims.appRole !== "regional_leader"
        ? tenantScopedRpcBody(requestBody, claims)
        : requestBody
    const dbRole = SERVICE_ROLE_RPC_FUNCTIONS.has(fn) ? "service_role" : "authenticated"

    if (dbRole === "service_role" && !canInvokeServiceRoleRpc(claims)) {
      return NextResponse.json({ error: "Service-role RPC not allowed" }, { status: 403 })
    }

    const token = mintSupabaseJwt(
      {
        id: claims.userId,
        role: claims.role,
        don_vi: claims.donVi,
        dia_ban_id: claims.diaBan,
        khoa_phong: claims.khoaPhong,
      },
      {
        dbRole,
      }
    )

    const urlBase = getEnv("NEXT_PUBLIC_SUPABASE_URL")
    const url = `${urlBase}/rest/v1/rpc/${encodeURIComponent(fn)}`

    // (debug removed)

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        apikey: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    const isJson = res.headers.get("content-type")?.includes("application/json")
    const payload = isJson ? JSON.parse(text || "null") : text
    if (!res.ok) {
      const sanitizedPayload = sanitizeForLog(payload)
      const sanitizedErrorMessage =
        sanitizedPayload && typeof sanitizedPayload === "object"
          ? ("message" in sanitizedPayload &&
              typeof sanitizedPayload.message === "string" &&
              sanitizedPayload.message) ||
            ("hint" in sanitizedPayload &&
              typeof sanitizedPayload.hint === "string" &&
              sanitizedPayload.hint) ||
            "RPC failed"
          : "RPC failed"
      // SECURITY: Sanitize logs to prevent PII/credential exposure
      console.error(`Supabase RPC error for ${fn}:`, {
        status: res.status,
        error: sanitizedErrorMessage,
      })
      return NextResponse.json(rpcClientErrorPayload(res.status, payload), { status: res.status })
    }
    return NextResponse.json(payload)
  } catch (err: unknown) {
    // SECURITY: Log only error message, not full stack trace or request details
    const message = getErrorMessage(err)
    console.error("RPC proxy error:", { message })
    return NextResponse.json({ error: "RPC proxy error" }, { status: 500 })
  }
}
