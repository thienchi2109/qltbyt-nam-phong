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
import { assertVapidVersion, readRuntimeControls } from "@/lib/web-push/runtime-config"
import {
  isUnsupportedVersion,
  parseSubscriptionRegisterRequest,
  validateSubscriptionRegisterResponse,
} from "@/lib/web-push/validation"

/** Runs the subscription route on the Node.js runtime. */
export const runtime = "nodejs"

/** Registers a browser Web Push subscription for the signed-in user. */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSession(req, true)
    const { value } = await readJsonBody(req, WEB_PUSH_BROWSER_BODY_BYTES)
    const parsed = parseSubscriptionRegisterRequest(value)
    if (isUnsupportedVersion(value)) throw new WebPushApiError(400, "unsupported_version")
    if (!parsed) throw new WebPushApiError(400, "invalid_request")
    const controls = await readRuntimeControls()
    if (!controls.registrationEnabled) throw new WebPushApiError(503, "disabled", 60)
    assertVapidVersion(controls, parsed.vapidKeyVersion)
    const response = await callSessionRpc(
      "web_push_subscription_register",
      { p_subscription: parsed.subscription, p_vapid_key_version: parsed.vapidKeyVersion },
      user
    )
    if (!validateSubscriptionRegisterResponse(response))
      throw new WebPushApiError(503, "unavailable", 60)
    return jsonResponse(response)
  } catch (error) {
    return errorResponse(error)
  }
}
