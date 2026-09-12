import { NextRequest } from "next/server"

import {
  errorResponse,
  jsonResponse,
  readJsonBody,
  WebPushApiError,
  WEB_PUSH_REPORT_BODY_BYTES,
} from "@/lib/web-push/api"
import { authenticateWorkerRequest, callInternalRpc } from "@/lib/web-push/worker-auth"
import {
  isUnsupportedVersion,
  parseReportRequest,
  validateReportResponse,
} from "@/lib/web-push/validation"
import { WEB_PUSH_REPORT_PATH } from "@/lib/web-push/wire"

/** Runs the worker report handler on the Node.js runtime. */
export const runtime = "nodejs"

/** Applies provider outcomes for an authenticated worker. */
export async function POST(req: NextRequest) {
  try {
    const { rawBody, value } = await readJsonBody(req, WEB_PUSH_REPORT_BODY_BYTES)
    const parsed = parseReportRequest(value)
    if (isUnsupportedVersion(value)) throw new WebPushApiError(400, "unsupported_version")
    if (!parsed) throw new WebPushApiError(400, "invalid_request")
    await authenticateWorkerRequest(req, rawBody, WEB_PUSH_REPORT_PATH)
    const response = await callInternalRpc("web_push_delivery_report", { p_request: parsed })
    const safeResponse = validateReportResponse(response)
    if (!safeResponse) throw new Error("unavailable")
    return jsonResponse(safeResponse)
  } catch (error) {
    return errorResponse(error)
  }
}
