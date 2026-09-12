import { NextRequest } from "next/server"

import {
  errorResponse,
  jsonResponse,
  readJsonBody,
  WebPushApiError,
  WEB_PUSH_CLAIM_BODY_BYTES,
} from "@/lib/web-push/api"
import { assertVapidVersion, readRuntimeControls } from "@/lib/web-push/runtime-config"
import {
  callInternalRpc,
  consumeWorkerNonce,
  verifyWorkerSignature,
} from "@/lib/web-push/worker-auth"
import {
  isUnsupportedVersion,
  parseClaimRequest,
  validateClaimResponse,
} from "@/lib/web-push/validation"
import { WEB_PUSH_CLAIM_PATH } from "@/lib/web-push/wire"

/** Runs the worker claim handler on the Node.js runtime. */
export const runtime = "nodejs"

/** Claims the next eligible Web Push deliveries for an authenticated worker. */
export async function POST(req: NextRequest) {
  try {
    const { rawBody, value } = await readJsonBody(req, WEB_PUSH_CLAIM_BODY_BYTES)
    const parsed = parseClaimRequest(value)
    if (isUnsupportedVersion(value)) throw new WebPushApiError(400, "unsupported_version")
    if (!parsed) throw new WebPushApiError(400, "invalid_request")
    const workerAuth = verifyWorkerSignature(req, rawBody, WEB_PUSH_CLAIM_PATH)
    const controls = await readRuntimeControls()
    if (!controls.dispatchEnabled) throw new WebPushApiError(503, "disabled", 60)
    const artifact = assertVapidVersion(controls, parsed.vapid_key_version)
    if (parsed.vapid_fingerprint !== artifact.fingerprint)
      throw new WebPushApiError(409, "key_version_mismatch")
    await consumeWorkerNonce(workerAuth.keyId, workerAuth.nonce)
    const response = await callInternalRpc("web_push_delivery_claim", { p_request: parsed })
    const safeResponse = validateClaimResponse(response)
    if (!safeResponse) throw new Error("unavailable")
    return jsonResponse(safeResponse)
  } catch (error) {
    return errorResponse(error)
  }
}
