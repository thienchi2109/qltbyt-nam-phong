import "server-only"

import { randomUUID } from "node:crypto"

import { callServerRpc } from "@/lib/ai/server-rpc"
import {
  BROKER_MAX_BODY_BYTES,
  BROKER_MAX_ERROR_BYTES,
  BROKER_MAX_RESPONSE_BYTES,
  BROKER_RPC_TIMEOUT_MS,
  BrokerRequestError,
  buildBrokerRpcCall,
  isBrokerRequestId,
  parseBrokerRequestBody,
  verifyBrokerToken,
} from "@/lib/ai/bff-broker/BffBrokerContracts"
import { validateBrokerResult } from "@/lib/ai/bff-broker/BffBrokerResults"
import { BoundedBodyTooLargeError, readBoundedBody } from "@/lib/ai/bff-broker/BoundedBody"

/** Runs the broker route on the Node.js runtime. */
export const runtime = "nodejs"

function generatedRequestId(): string {
  return `bff-${randomUUID()}`
}

function requestIdForResponse(request: Request): string {
  const value = request.headers.get("x-request-id")
  return isBrokerRequestId(value) ? value : generatedRequestId()
}

function responseBodyBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

function jsonResponse(
  status: number,
  body: unknown,
  requestId: string,
  maxBytes: number
): Response {
  const serialized = JSON.stringify(body)
  const safeBody =
    new TextEncoder().encode(serialized).byteLength <= maxBytes
      ? serialized
      : JSON.stringify({
          error: {
            code: "internal_error",
            message: "The request could not be completed.",
            retryable: false,
            request_id: requestId,
          },
        })
  return new Response(safeBody, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Request-ID": requestId,
    },
  })
}

function errorResponse(error: BrokerRequestError, requestId: string): Response {
  const body = {
    error: {
      code: error.code,
      message:
        error.code === "cancelled"
          ? "The request was cancelled."
          : error.code === "result_too_large"
            ? "The upstream result exceeded the response limit."
            : error.code === "upstream_error"
              ? "The upstream service could not complete the request."
              : "The request is not valid.",
      retryable: error.retryable,
      request_id: requestId,
    },
  }
  return jsonResponse(error.status, body, requestId, BROKER_MAX_ERROR_BYTES)
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
}

function isConfigurationError(error: unknown): boolean {
  return error instanceof Error && /(?:not set|unavailable|configuration)/i.test(error.message)
}

function responseTooLargeKind(error: unknown): "success" | "error" | undefined {
  if (error instanceof Error && error.name === "ServerRpcResponseTooLargeError") {
    const kind = (error as Error & { kind?: unknown }).kind
    return kind === "success" || kind === "error" ? kind : "success"
  }
  return undefined
}

function contentTypeIsJson(request: Request): boolean {
  return request.headers.get("content-type")?.toLowerCase().startsWith("application/json") === true
}

/**
 * Broker HMAC is the only authorization input at this boundary. Cloudflare
 * Access headers are transport metadata for the trusted deployment path and
 * are intentionally ignored here so GoBffProxy can forward them; copying
 * them from a browser cannot satisfy the broker-token check.
 */
function hasBrowserAuthorityHeaders(request: Request): boolean {
  return [
    "cookie",
    "x-user-id",
    "x-user-role",
    "x-role",
    "x-facility-id",
    "x-tenant-id",
    "x-supabase-jwt-secret",
    "supabase-jwt-secret",
  ].some((header) => request.headers.has(header))
}

function withTimeout(request: Request): {
  signal: AbortSignal
  didTimeout: () => boolean
  dispose: () => void
} {
  const timeoutController = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    timeoutController.abort()
  }, BROKER_RPC_TIMEOUT_MS)
  const abort = () => timeoutController.abort()
  request.signal.addEventListener("abort", abort, { once: true })
  const signal = AbortSignal.any([request.signal, timeoutController.signal])
  return {
    signal,
    didTimeout: () => timedOut,
    dispose: () => {
      clearTimeout(timer)
      request.signal.removeEventListener("abort", abort)
    },
  }
}

/** Server-only BFF boundary for the allowlisted application-owned RPC broker. */
export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdForResponse(request)
  if (request.signal.aborted) {
    return errorResponse(new BrokerRequestError(499, "cancelled"), requestId)
  }
  if (!isBrokerRequestId(request.headers.get("x-request-id"))) {
    return errorResponse(new BrokerRequestError(400, "invalid_request"), requestId)
  }
  if (!contentTypeIsJson(request)) {
    return errorResponse(new BrokerRequestError(415, "invalid_request"), requestId)
  }
  if (hasBrowserAuthorityHeaders(request)) {
    return errorResponse(new BrokerRequestError(401, "unauthorized"), requestId)
  }
  const contentLength = request.headers.get("content-length")
  if (contentLength !== null) {
    const parsedLength = Number(contentLength)
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      return errorResponse(new BrokerRequestError(400, "invalid_request"), requestId)
    }
    if (parsedLength > BROKER_MAX_BODY_BYTES) {
      return errorResponse(new BrokerRequestError(413, "invalid_request"), requestId)
    }
  }

  let rawBody: Uint8Array
  try {
    rawBody = await readBoundedBody(request.body, BROKER_MAX_BODY_BYTES, request.signal)
  } catch (error) {
    if (error instanceof BoundedBodyTooLargeError) {
      return errorResponse(new BrokerRequestError(413, "invalid_request"), requestId)
    }
    if (error instanceof BrokerRequestError) {
      return errorResponse(error, requestId)
    }
    return errorResponse(
      request.signal.aborted || isAbortError(error)
        ? new BrokerRequestError(499, "cancelled")
        : new BrokerRequestError(400, "invalid_request"),
      requestId
    )
  }
  if (rawBody.byteLength > BROKER_MAX_BODY_BYTES) {
    return errorResponse(new BrokerRequestError(413, "invalid_request"), requestId)
  }

  let parsedJson: unknown
  try {
    const text = new TextDecoder().decode(rawBody)
    parsedJson = text ? JSON.parse(text) : null
  } catch {
    return errorResponse(new BrokerRequestError(400, "invalid_request"), requestId)
  }

  try {
    const authorization = request.headers.get("authorization")
    const match = authorization?.match(/^Bearer\s+([^\s]+)$/i)
    if (!match) throw new BrokerRequestError(401, "unauthorized")
    const scope = verifyBrokerToken(match[1])
    const body = parseBrokerRequestBody(parsedJson)
    if (body.request_id !== requestId) {
      throw new BrokerRequestError(400, "invalid_request")
    }
    const args = buildBrokerRpcCall(body, scope)
    if (!process.env.SUPABASE_JWT_SECRET?.trim()) {
      throw new BrokerRequestError(503, "unavailable", true)
    }
    if (request.signal.aborted) {
      throw new BrokerRequestError(499, "cancelled")
    }
    const { signal, didTimeout, dispose } = withTimeout(request)
    try {
      let result: unknown
      try {
        result = await callServerRpc(body.rpc, args, scope.user, { signal })
      } catch (error) {
        if (isAbortError(error) && didTimeout() && !request.signal.aborted) {
          throw new BrokerRequestError(502, "timeout", true)
        }
        throw error
      }
      const validatedResult = validateBrokerResult(body.rpc, result)
      const response = {
        protocol_version: "v1",
        request_id: requestId,
        rpc: body.rpc,
        result: validatedResult,
      }
      if (responseBodyBytes(response) > BROKER_MAX_RESPONSE_BYTES) {
        throw new BrokerRequestError(502, "result_too_large")
      }
      return jsonResponse(200, response, requestId, BROKER_MAX_RESPONSE_BYTES)
    } finally {
      dispose()
    }
  } catch (error) {
    const responseTooLarge = responseTooLargeKind(error)
    if (responseTooLarge) {
      return errorResponse(
        new BrokerRequestError(
          502,
          responseTooLarge === "error" ? "upstream_error" : "result_too_large",
          responseTooLarge === "error"
        ),
        requestId
      )
    }
    if (isAbortError(error)) {
      return errorResponse(new BrokerRequestError(499, "cancelled"), requestId)
    }
    if (error instanceof BrokerRequestError) {
      return errorResponse(error, requestId)
    }
    if (isConfigurationError(error)) {
      return errorResponse(new BrokerRequestError(503, "unavailable", true), requestId)
    }
    console.error("AI broker RPC failed", { request_id: requestId })
    return errorResponse(new BrokerRequestError(502, "upstream_error", true), requestId)
  }
}

/** Rejects unsupported GET requests at the broker boundary. */
export function GET(request: Request): Response {
  return errorResponse(
    new BrokerRequestError(405, "invalid_request"),
    requestIdForResponse(request)
  )
}

/** Rejects unsupported PUT requests at the broker boundary. */
export function PUT(request: Request): Response {
  return GET(request)
}

/** Rejects unsupported DELETE requests at the broker boundary. */
export function DELETE(request: Request): Response {
  return GET(request)
}

/** Rejects unsupported PATCH requests at the broker boundary. */
export function PATCH(request: Request): Response {
  return GET(request)
}
