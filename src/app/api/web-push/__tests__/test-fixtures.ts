import { createHash } from "node:crypto"

import { NextRequest } from "next/server"

export const VALID_P256DH =
  "BOSMYXSPeNZ9sdxrNwdifOTNnjj4RRrdT8bLFrCvlSZHid8-VorFDh0Zv9miRlFh9Xy-cdEz_5ZUWKHnau7DdzY"
export const VALID_AUTH = "AAAAAAAAAAAAAAAAAAAAAA"
export const VALID_VAPID_VERSION = "staging-20260910-01"
export const VALID_VAPID_PUBLIC_KEY = VALID_P256DH
export const VALID_VAPID_FINGERPRINT = `sha256:${createHash("sha256").update(Buffer.from(VALID_P256DH, "base64url")).digest("hex")}`

export function runtimeControls(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      version: 1,
      registration_enabled: false,
      dispatch_enabled: false,
      vapid: null,
      ...overrides,
    }),
    { headers: { "content-type": "application/json" } }
  )
}

export function request(url: string, init: RequestInit = {}): NextRequest {
  return new NextRequest(url, init)
}
