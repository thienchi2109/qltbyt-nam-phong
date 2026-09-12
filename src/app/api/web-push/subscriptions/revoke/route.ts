import { NextRequest } from "next/server"

import {
  callSessionRpc,
  errorResponse,
  jsonResponse,
  readJsonBody,
  requireSession,
  WebPushApiError,
  WEB_PUSH_BROWSER_BODY_BYTES,
} from "@/lib/web-push/api"
import {
  isUnsupportedVersion,
  parseSubscriptionRevokeRequest,
  validateSubscriptionRevokeResponse,
} from "@/lib/web-push/validation"

/** Runs the subscription-revoke route on the Node.js runtime. */
export const runtime = "nodejs"

/** Revokes a browser Web Push subscription for the signed-in user. */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSession(req, true)
    const { value } = await readJsonBody(req, WEB_PUSH_BROWSER_BODY_BYTES)
    const parsed = parseSubscriptionRevokeRequest(value)
    if (isUnsupportedVersion(value)) throw new WebPushApiError(400, "unsupported_version")
    if (!parsed) throw new WebPushApiError(400, "invalid_request")
    const response = await callSessionRpc(
      "web_push_subscription_revoke",
      { p_subscription_id: parsed.subscriptionId, p_revision: parsed.revision },
      user
    )
    if (!validateSubscriptionRevokeResponse(response))
      throw new WebPushApiError(503, "unavailable", 60)
    return jsonResponse(response)
  } catch (error) {
    return errorResponse(error)
  }
}
