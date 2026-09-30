import type { GoBffConfig } from "./GoBffConfig"
import {
  mapGoAppQuotaError,
  translateAccessDenial,
  translateGoProtocolError,
  type GoProtocolErrorBody,
} from "./GoBffProtocolError"

interface ProxyInput {
  request: Request
  config: GoBffConfig
  requestId: string
  timestamp: string
  signature: string
  rawBody: string
}

const STREAM_HEADERS = [
  "cache-control",
  "content-type",
  "x-vercel-ai-ui-message-stream",
  "x-request-id",
] as const

function responseHeaders(upstream: Response, requestId: string): Headers {
  const headers = new Headers()
  for (const name of STREAM_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  const upstreamRequestId = upstream.headers.get("X-Request-ID")
  headers.set(
    "X-Request-ID",
    upstreamRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(upstreamRequestId)
      ? upstreamRequestId
      : requestId
  )
  return headers
}

async function safeProtocolPayload(response: Response): Promise<GoProtocolErrorBody> {
  const text = await response.text()
  if (text.length > 32_000) {
    return { status: response.status, code: fallbackCodeForStatus(response.status) }
  }
  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { status: response.status, code: fallbackCodeForStatus(response.status) }
    }
    const payload = parsed as GoProtocolErrorBody
    return {
      ...payload,
      status:
        typeof payload.status === "number" && Number.isInteger(payload.status)
          ? payload.status
          : response.status,
    }
  } catch {
    return { status: response.status, code: fallbackCodeForStatus(response.status) }
  }
}

function fallbackCodeForStatus(status: number): string {
  if (status === 401 || status === 403) return "unauthorized"
  if (status === 404) return "capability_unavailable"
  if (status >= 500) return "provider_failure"
  return "invalid_request"
}

function jsonResponse(
  status: number,
  body: unknown,
  requestId: string,
  retryAfterSeconds?: number
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "X-Request-ID": requestId,
  })
  if (retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(retryAfterSeconds))
  }
  return new Response(JSON.stringify(body), { status, headers })
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
}

function isUIStreamResponse(response: Response): boolean {
  return (
    response.headers.get("x-vercel-ai-ui-message-stream") === "v1" &&
    response.headers.get("content-type")?.toLowerCase().startsWith("text/event-stream") === true
  )
}

function upstreamFailureClass(response: Response): string {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  if (response.status === 403 && contentType.includes("text/html")) return "access_html"
  if (contentType.includes("application/json")) return "go_protocol_json"
  return "nonstandard"
}

/** Proxies the dark stream while propagating the browser cancellation signal. */
export async function proxyGoBffRequest(input: ProxyInput): Promise<Response> {
  let upstream: Response
  try {
    upstream = await fetch(input.config.endpoint, {
      method: "POST",
      body: input.rawBody,
      signal: input.request.signal,
      cache: "no-store",
      redirect: "error",
      headers: new Headers({
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "X-AI-Service-Timestamp": input.timestamp,
        "X-AI-Service-Request-ID": input.requestId,
        "X-AI-Service-Key-ID": input.config.hmacKeyId,
        "X-AI-Service-Signature": input.signature,
        "X-Request-ID": input.requestId,
        "CF-Access-Client-Id": input.config.cloudflareClientId,
        "CF-Access-Client-Secret": input.config.cloudflareClientSecret,
      }),
    })
  } catch (error) {
    if (isAbortError(error)) {
      return jsonResponse(
        499,
        { error: { code: "cancelled", message: "Yêu cầu đã được hủy." } },
        input.requestId
      )
    }
    return jsonResponse(
      502,
      {
        error: {
          code: "provider_failure",
          message: "Bộ mô hình không hoàn tất được yêu cầu. Vui lòng thử lại sau.",
        },
      },
      input.requestId
    )
  }

  if (upstream.ok && !isUIStreamResponse(upstream)) {
    try {
      await upstream.body?.cancel()
    } catch {
      // Best-effort cleanup for a malformed successful upstream response.
    }
    return jsonResponse(
      502,
      {
        error: {
          code: "provider_failure",
          message: "Bộ mô hình không hoàn tất được yêu cầu. Vui lòng thử lại sau.",
        },
      },
      input.requestId
    )
  }

  if (upstream.ok) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders(upstream, input.requestId),
    })
  }

  console.warn("[ai-bff] upstream failure", {
    requestId: input.requestId,
    status: upstream.status,
    contentType: upstream.headers.get("content-type") ?? "",
    cfRay: upstream.headers.get("cf-ray") ?? "",
    class: upstreamFailureClass(upstream),
  })

  const payload = await safeProtocolPayload(upstream)
  if (
    upstream.status === 403 &&
    upstream.headers.get("content-type")?.toLowerCase().includes("text/html")
  ) {
    const translated = translateAccessDenial(input.requestId)
    return jsonResponse(translated.httpStatus, translated.body, translated.headers["X-Request-ID"])
  }
  const appQuota = mapGoAppQuotaError(payload, input.requestId)
  if (appQuota) {
    return jsonResponse(
      appQuota.status,
      appQuota.body,
      appQuota.requestId,
      appQuota.retryAfterSeconds
    )
  }
  const translated = translateGoProtocolError(payload, input.requestId)
  return jsonResponse(translated.httpStatus, translated.body, translated.headers["X-Request-ID"])
}
