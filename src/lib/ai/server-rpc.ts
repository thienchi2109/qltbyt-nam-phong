import "server-only"

import jwt from "jsonwebtoken"

import { buildSupabaseRpcJwtClaims, type SupabaseRpcUser } from "@/auth/server-claims"
import { BoundedBodyTooLargeError, readBoundedBody } from "@/lib/ai/bff-broker/BoundedBody"

export type { SupabaseRpcUser } from "@/auth/server-claims"

const SUPABASE_JWT_CLOCK_SKEW_SECONDS = 60
const SERVER_RPC_SUCCESS_MAX_BYTES = 64 * 1024
const SERVER_RPC_ERROR_MAX_BYTES = 8 * 1024
type SupabaseRpcDbRole = "authenticated" | "service_role"

/** Signals that a Supabase RPC response exceeded its bounded body limit. */
export class ServerRpcResponseTooLargeError extends Error {
  readonly kind: "success" | "error"

  constructor(kind: "success" | "error") {
    super("Supabase RPC response exceeded the broker limit.")
    this.name = "ServerRpcResponseTooLargeError"
    this.kind = kind
  }
}

async function readBoundedResponseText(
  response: Response,
  maxBytes: number,
  kind: ServerRpcResponseTooLargeError["kind"],
  signal?: AbortSignal
): Promise<string> {
  try {
    return new TextDecoder().decode(await readBoundedBody(response.body, maxBytes, signal))
  } catch (error) {
    if (error instanceof BoundedBodyTooLargeError) {
      throw new ServerRpcResponseTooLargeError(kind)
    }
    throw error
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

/** Mints a short-lived Supabase-compatible JWT from trusted server-side user claims. */
export function mintSupabaseJwt(
  user: SupabaseRpcUser,
  options: { dbRole?: SupabaseRpcDbRole } = {}
): string {
  const now = Math.floor(Date.now() / 1000)
  const issuedAt = now - SUPABASE_JWT_CLOCK_SKEW_SECONDS
  const expiresAt = now + 120
  const claims = buildSupabaseRpcJwtClaims({
    user,
    issuedAt,
    expiresAt,
    dbRole: options.dbRole,
  })

  return jwt.sign(claims, getRequiredEnv("SUPABASE_JWT_SECRET"), {
    algorithm: "HS256",
  })
}

/** Calls a Supabase PostgREST RPC endpoint with server-minted authenticated claims. */
export async function callServerRpc<TResponse = unknown>(
  fn: string,
  args: Record<string, unknown>,
  user: SupabaseRpcUser,
  options: { signal?: AbortSignal } = {}
): Promise<TResponse> {
  const token = mintSupabaseJwt(user)
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      apikey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    },
    body: JSON.stringify(args),
  }
  if (options.signal) requestInit.signal = options.signal
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(fn)}`, requestInit)

  if (!response.ok) {
    const text = await readBoundedResponseText(
      response,
      SERVER_RPC_ERROR_MAX_BYTES,
      "error",
      options.signal
    )
    const isJson = response.headers.get("content-type")?.includes("application/json")
    const payload = isJson ? JSON.parse(text || "null") : text
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : `Supabase RPC ${fn} failed (${response.status})`
    throw new Error(message)
  }

  const text = await readBoundedResponseText(
    response,
    SERVER_RPC_SUCCESS_MAX_BYTES,
    "success",
    options.signal
  )
  if (text.trim() === "") return null as TResponse
  const isJson = response.headers.get("content-type")?.includes("application/json")
  return (isJson ? JSON.parse(text) : text) as TResponse
}
