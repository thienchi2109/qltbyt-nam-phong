import { errorResponse, jsonResponse } from "@/lib/web-push/api"
import { readRuntimeControls } from "@/lib/web-push/runtime-config"

/** Runs the public-key route on the Node.js runtime. */
export const runtime = "nodejs"

/** Returns the currently published Web Push VAPID artifact. */
export async function GET() {
  try {
    const controls = await readRuntimeControls()
    return jsonResponse({
      version: 1,
      registration_enabled: controls.registrationEnabled,
      vapid: controls.vapid
        ? {
            version: controls.vapid.version,
            public_key: controls.vapid.publicKey,
            fingerprint: controls.vapid.fingerprint,
          }
        : null,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
