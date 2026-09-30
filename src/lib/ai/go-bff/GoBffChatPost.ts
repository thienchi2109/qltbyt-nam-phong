import { randomUUID } from "node:crypto"
import { getServerSession } from "next-auth"

import { authOptions } from "@/auth/config"
import { readGoBffConfig, type GoBffConfig } from "@/lib/ai/go-bff/GoBffConfig"
import { buildGoBffRequest, isAllowedDarkChatRole } from "@/lib/ai/go-bff/GoBffRequest"
import { proxyGoBffRequest } from "@/lib/ai/go-bff/GoBffProxy"

const UNAVAILABLE_MESSAGE = "Tính năng trợ lý hiện không khả dụng."

function requestIdFrom(request: Request): string {
  const value = request.headers.get("X-Request-ID")?.trim() ?? ""
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : randomUUID()
}

function jsonError(status: number, requestId: string, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Request-ID": requestId,
    },
  })
}

/**
 * Authenticated chat post for the shared Go service.
 * Production `/api/chat` and `/api/chat/dark` both use this handler.
 * A missing Go BFF configuration fails closed. This function does not call the parked Next.js orchestrator.
 */
export async function postGoBffChat(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request)
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return jsonError(401, requestId, "unauthorized", "Anh/chị cần đăng nhập để sử dụng trợ lý.")
  }

  const user = session.user as Record<string, unknown>
  if (!isAllowedDarkChatRole(user.role)) {
    return jsonError(403, requestId, "unauthorized", "Anh/chị không có quyền sử dụng trợ lý.")
  }

  let config: GoBffConfig
  try {
    config = readGoBffConfig()
  } catch {
    return jsonError(503, requestId, "capability_unavailable", UNAVAILABLE_MESSAGE)
  }

  const payload = await request.json().catch(() => null)
  if (!payload) {
    return jsonError(400, requestId, "invalid_request", "Yêu cầu không hợp lệ.")
  }

  let signed
  try {
    signed = await buildGoBffRequest({
      config,
      requestId,
      user,
      payload,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    const status = /allowed|numeric|missing|authenticated/i.test(message) ? 401 : 400
    return jsonError(
      status,
      requestId,
      status === 401 ? "unauthorized" : "invalid_request",
      status === 401 ? "Phiên đăng nhập không hợp lệ." : "Yêu cầu không hợp lệ."
    )
  }

  return proxyGoBffRequest({
    request,
    config,
    requestId: signed.requestId,
    timestamp: signed.timestamp,
    signature: signed.signature,
    rawBody: signed.rawBody,
  })
}
