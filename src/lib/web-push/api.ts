import "server-only"

import { getServerSession } from "next-auth"
import { NextResponse, type NextRequest } from "next/server"

import { authOptions } from "@/auth/config"
import { getSessionClaims, getSessionUser } from "@/app/api/rpc/[fn]/rpc-session-claims"
import { mintSupabaseJwt, type SupabaseRpcUser } from "@/lib/ai/server-rpc"
import { SameOriginRequestError, assertSameOriginRequest } from "@/lib/same-origin-request"

import { isValidWebPushSignature, parseStrictJson, WebPushWireError } from "./wire"

/** Represents a safe HTTP error exposed by a Web Push API route. */
export class WebPushApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfterSeconds?: number
  ) {
    super(code)
    this.name = "WebPushApiError"
  }
}

type RpcRole = "authenticated" | "service_role"
type SessionContext = { user: SupabaseRpcUser }
const JSON_CONTENT_TYPE = "application/json"
const READ_BODY_DEADLINE_MS = 5000
const RPC_DEADLINE_MS = 5000
const RPC_RESPONSE_BYTES = 48 * 1024
const CLAIM_BODY_BYTES = 2048
const REPORT_BODY_BYTES = 8192
const BROWSER_BODY_BYTES = 16384

function safeRpcCode(value: unknown): string | null {
  const message =
    value instanceof Error
      ? value.message
      : value &&
          typeof value === "object" &&
          "message" in value &&
          typeof value.message === "string"
        ? value.message
        : ""
  const upstreamCode =
    value && typeof value === "object" && "code" in value && typeof value.code === "string"
      ? value.code
      : ""
  if (upstreamCode === "42501") return "forbidden"
  if (upstreamCode === "40001") return "subscription_conflict"
  const codes = [
    "registration_disabled",
    "dispatch_disabled",
    "rate_limited",
    "subscription_conflict",
    "invalid_subscription",
    "invalid_recipients",
    "forbidden",
    "replay",
    "invalid_request",
    "key_version_mismatch",
  ]
  return codes.find((code) => message.includes(code)) ?? null
}

function rpcError(code: string | null): WebPushApiError {
  if (code === "registration_disabled" || code === "dispatch_disabled")
    return new WebPushApiError(503, "disabled", 60)
  if (code === "rate_limited") return new WebPushApiError(429, "rate_limited", 60)
  if (code === "subscription_conflict" || code === "key_version_mismatch")
    return new WebPushApiError(409, code)
  if (code === "forbidden") return new WebPushApiError(403, code)
  if (
    code === "invalid_subscription" ||
    code === "invalid_recipients" ||
    code === "invalid_request"
  ) {
    return new WebPushApiError(400, code ?? "invalid_request")
  }
  return new WebPushApiError(503, "unavailable", 60)
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new WebPushApiError(503, "unavailable", 60)
  return value
}

/** Calls a Web Push RPC with the requested database role and safe response limits. */
export async function callWebPushRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  user: SupabaseRpcUser,
  dbRole: RpcRole
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RPC_DEADLINE_MS)
  try {
    const token = mintSupabaseJwt(user, { dbRole })
    const response = await fetch(
      `${getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/rpc/${encodeURIComponent(fn)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": JSON_CONTENT_TYPE,
          Accept: JSON_CONTENT_TYPE,
          Authorization: `Bearer ${token}`,
          apikey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
        },
        body: JSON.stringify(args),
        redirect: "error",
        signal: controller.signal,
      }
    )
    if (response.redirected) throw new WebPushApiError(503, "unavailable", 60)
    const text = await readResponseText(
      response,
      fn === "web_push_delivery_claim"
        ? RPC_RESPONSE_BYTES
        : fn === "web_push_delivery_report"
          ? REPORT_BODY_BYTES
          : BROWSER_BODY_BYTES
    )
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }
    if (!response.ok) throw rpcError(safeRpcCode(payload) ?? safeRpcCode(new Error(text)))
    return payload as T
  } catch (error) {
    if (error instanceof WebPushApiError) throw error
    throw rpcError(safeRpcCode(error))
  } finally {
    clearTimeout(timer)
  }
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get("content-length")
  if (contentLength && /^[0-9]+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    throw new WebPushApiError(503, "unavailable", 60)
  }
  const reader = response.body?.getReader()
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) throw new WebPushApiError(503, "unavailable", 60)
    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
    } catch {
      throw new WebPushApiError(503, "unavailable", 60)
    }
  }
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > maxBytes) {
        void reader.cancel().catch(() => undefined)
        throw new WebPushApiError(503, "unavailable", 60)
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    throw new WebPushApiError(503, "unavailable", 60)
  }
}

/** Requires an authenticated session and, for mutations, a same-origin request. */
export async function requireSession(req: NextRequest, mutation = false): Promise<SessionContext> {
  if (mutation) {
    try {
      assertSameOriginRequest(req)
    } catch (error) {
      if (error instanceof SameOriginRequestError) throw new WebPushApiError(403, "forbidden")
      throw error
    }
  }
  const session = await getServerSession(authOptions)
  const sessionUser = getSessionUser(session)
  if (!sessionUser || !getSessionClaims(sessionUser)) throw new WebPushApiError(401, "unauthorized")
  return { user: sessionUser }
}

/** Calls a Web Push RPC using the authenticated session role. */
export async function callSessionRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  user: SupabaseRpcUser
): Promise<T> {
  return callWebPushRpc<T>(fn, args, user, "authenticated")
}

/** Builds a no-store JSON response with an optional retry hint. */
export function jsonResponse(
  payload: unknown,
  status = 200,
  retryAfterSeconds?: number
): NextResponse {
  const headers = new Headers({ "Cache-Control": "no-store" })
  if (retryAfterSeconds !== undefined) headers.set("Retry-After", String(retryAfterSeconds))
  return NextResponse.json(payload, { status, headers })
}

/** Converts internal failures into the route's safe JSON error envelope. */
export function errorResponse(error: unknown): NextResponse {
  const safe = error instanceof WebPushApiError ? error : new WebPushApiError(500, "unavailable")
  return jsonResponse(
    {
      version: 1,
      error: {
        code: safe.code,
        ...(safe.retryAfterSeconds === undefined
          ? {}
          : { retry_after_seconds: safe.retryAfterSeconds }),
      },
    },
    safe.status,
    safe.retryAfterSeconds
  )
}

function validateJsonContentType(req: NextRequest): void {
  const contentType = req.headers.get("content-type")
  if (!contentType) throw new WebPushApiError(400, "invalid_request")
  const [mediaType, ...parameters] = contentType.split(";").map((part) => part.trim().toLowerCase())
  if (
    mediaType !== JSON_CONTENT_TYPE ||
    parameters.some((parameter) => parameter && parameter !== "charset=utf-8")
  ) {
    throw new WebPushApiError(400, "invalid_request")
  }
  const contentEncoding = req.headers.get("content-encoding")
  if (contentEncoding && contentEncoding.toLowerCase() !== "identity")
    throw new WebPushApiError(400, "invalid_request")
}

async function readBytes(req: NextRequest, maxBytes: number): Promise<Uint8Array> {
  const contentLength = req.headers.get("content-length")
  if (contentLength !== null) {
    if (!/^[0-9]+$/.test(contentLength) || Number(contentLength) > maxBytes)
      throw new WebPushApiError(413, "body_too_large")
  }
  const reader = req.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let total = 0
  const read = async (): Promise<Uint8Array> => {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > maxBytes) throw new WebPushApiError(413, "body_too_large")
      chunks.push(next.value)
    }
    const output = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      output.set(chunk, offset)
      offset += chunk.byteLength
    }
    return output
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      read(),
      new Promise<Uint8Array>((_, reject) => {
        timer = setTimeout(
          () => reject(new WebPushApiError(408, "invalid_request")),
          READ_BODY_DEADLINE_MS
        )
      }),
    ])
  } catch (error) {
    void reader.cancel().catch(() => undefined)
    throw error
  } finally {
    if (timer) clearTimeout(timer)
    reader.releaseLock()
  }
}

/** Reads and strictly parses a bounded JSON request body. */
export async function readJsonBody(
  req: NextRequest,
  maxBytes: number
): Promise<{ rawBody: string; value: unknown }> {
  validateJsonContentType(req)
  const bytes = await readBytes(req, maxBytes)
  let rawBody: string
  try {
    rawBody = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    throw new WebPushApiError(400, "invalid_request")
  }
  try {
    return { rawBody, value: parseStrictJson(rawBody, maxBytes) }
  } catch (error) {
    if (error instanceof WebPushWireError) throw new WebPushApiError(400, error.message)
    throw new WebPushApiError(400, "invalid_request")
  }
}

/** Maximum raw body size accepted by the worker claim route. */
export const WEB_PUSH_CLAIM_BODY_BYTES = CLAIM_BODY_BYTES
/** Maximum raw body size accepted by the worker report route. */
export const WEB_PUSH_REPORT_BODY_BYTES = REPORT_BODY_BYTES
/** Maximum raw body size accepted by browser-facing routes. */
export const WEB_PUSH_BROWSER_BODY_BYTES = BROWSER_BODY_BYTES
