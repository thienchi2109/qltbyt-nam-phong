import { dispatchPendingZbsNotifications } from "@/lib/zbs/live-dispatcher"
import { sanitizeForLog } from "@/lib/log-sanitizer"

/** Keep the ZBS dispatch endpoint uncached so each cron/manual call evaluates live state. */
export const dynamic = "force-dynamic"
/** Use Node.js runtime for internal RPC proxy calls and outbound Zalo fetches. */
export const runtime = "nodejs"

type RpcErrorPayload = {
  error?: unknown
  details?: unknown
}

class ZbsDispatchRpcError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = "ZbsDispatchRpcError"
    this.status = status
    this.details = details
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status })
}

function readDispatchEnabled() {
  return process.env.ZALO_ZBS_DISPATCH_ENABLED === "true"
}

function readAppBaseUrl() {
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? vercelUrl
}

function readOutboxIds(request: Request): string[] | undefined {
  const { searchParams } = new URL(request.url)
  const ids = searchParams
    .getAll("outboxId")
    .map((id) => id.trim())
    .filter(Boolean)

  return ids.length > 0 ? ids : undefined
}

function parseRpcErrorPayload(payload: unknown): RpcErrorPayload {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as RpcErrorPayload)
    : {}
}

function errorPayloadMessage(payload: RpcErrorPayload): string {
  if (typeof payload.error === "string") {
    return payload.error
  }

  if (
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message
  }

  return "ZBS dispatch RPC failed"
}

function errorPayloadDetails(payload: RpcErrorPayload): unknown {
  if (payload.details !== undefined) {
    return payload.details
  }

  if (payload.error && typeof payload.error === "object" && "details" in payload.error) {
    return payload.error.details
  }

  return undefined
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function callRpcProxyFromCron(
  request: Request,
  cronSecret: string,
  { fn, args }: { fn: string; args: Record<string, unknown> }
): Promise<unknown> {
  const rpcUrl = new URL(`/api/rpc/${encodeURIComponent(fn)}`, request.url)
  const body = JSON.stringify(args)
  const response = await fetch(rpcUrl.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body)),
      Origin: rpcUrl.origin,
      "x-qltbyt-internal-rpc": "zbs-dispatch",
    },
    body,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const errorPayload = parseRpcErrorPayload(payload)
    throw new ZbsDispatchRpcError(
      response.status,
      errorPayloadMessage(errorPayload),
      errorPayloadDetails(errorPayload)
    )
  }

  return payload
}

/** Runs one guarded ZBS dispatch batch for cron/manual operations. */
export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("Missing ZBS dispatch cron secret")
    return jsonResponse(
      { error: "Server configuration error: missing required environment variables" },
      500
    )
  }

  if (request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    console.error("Unauthorized ZBS dispatch cron attempt", {
      userAgent: request.headers.get("user-agent"),
    })
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  try {
    const result = await dispatchPendingZbsNotifications({
      dispatchEnabled: readDispatchEnabled(),
      accessToken: process.env.ZALO_ZBS_ACCESS_TOKEN,
      repairTemplateId: process.env.ZALO_ZBS_REPAIR_TEMPLATE_ID,
      appBaseUrl: readAppBaseUrl(),
      outboxIds: readOutboxIds(request),
      rpcClient: (rpcRequest) => callRpcProxyFromCron(request, cronSecret, rpcRequest),
    })

    return jsonResponse({ success: true, result }, 200)
  } catch (error) {
    console.error("ZBS dispatch cron failed", { error: sanitizeForLog(error) })
    if (error instanceof ZbsDispatchRpcError) {
      return jsonResponse(
        {
          error: "ZBS dispatch failed",
          ...(error.details === undefined ? {} : { details: error.details }),
        },
        error.status
      )
    }
    return jsonResponse({ error: "ZBS dispatch failed" }, 500)
  }
}
