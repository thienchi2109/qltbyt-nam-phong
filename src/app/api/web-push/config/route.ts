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
  parseConfigPutRequest,
  parseDonViId,
  validateConfigResponse,
} from "@/lib/web-push/validation"

/** Runs the recipient configuration routes on the Node.js runtime. */
export const runtime = "nodejs"

/** Returns the configured Web Push recipients for a unit. */
export async function GET(req: NextRequest) {
  try {
    const donViId = parseDonViId(req.nextUrl.searchParams.get("don_vi_id"))
    if (
      !donViId ||
      req.nextUrl.searchParams.getAll("don_vi_id").length !== 1 ||
      [...req.nextUrl.searchParams.keys()].some((key) => key !== "don_vi_id")
    ) {
      throw new WebPushApiError(400, "invalid_request")
    }
    const { user } = await requireSession(req)
    const response = await callSessionRpc(
      "web_push_recipient_config_get",
      { p_don_vi: donViId },
      user
    )
    if (!validateConfigResponse(response)) throw new WebPushApiError(503, "unavailable", 60)
    return jsonResponse(response)
  } catch (error) {
    return errorResponse(error)
  }
}

/** Updates the configured Web Push recipients for a unit. */
export async function PUT(req: NextRequest) {
  try {
    const { user } = await requireSession(req, true)
    const { value } = await readJsonBody(req, WEB_PUSH_BROWSER_BODY_BYTES)
    const parsed = parseConfigPutRequest(value)
    if (isUnsupportedVersion(value)) throw new WebPushApiError(400, "unsupported_version")
    if (!parsed) throw new WebPushApiError(400, "invalid_request")
    const response = await callSessionRpc(
      "web_push_recipient_config_set",
      { p_don_vi: parsed.donViId, p_usernames: parsed.usernames },
      user
    )
    if (!validateConfigResponse(response)) throw new WebPushApiError(503, "unavailable", 60)
    return jsonResponse(response)
  } catch (error) {
    return errorResponse(error)
  }
}
