import { createHash, createHmac } from "node:crypto"

export interface GoBffCanonicalInput {
  timestamp: string
  requestId: string
  keyId: string
  rawBody: string
}

/** Builds the ai-service-v1 canonical string. The signature header is not included. */
export function buildGoBffCanonicalString(input: GoBffCanonicalInput): string {
  const digest = createHash("sha256").update(input.rawBody).digest("hex")
  return [
    "ai-service-v1",
    "POST",
    "/v1/chat",
    input.timestamp,
    input.requestId,
    input.keyId,
    digest,
  ].join("\n")
}

/** Signs the canonical string with HMAC-SHA256 and unpadded base64url. */
export function signGoBffCanonicalString(secret: string, canonical: string): string {
  return createHmac("sha256", secret).update(canonical).digest("base64url")
}

/** Signs one chat request body with the reviewed HMAC canonical string. */
export function signGoBffRequest(secret: string, input: GoBffCanonicalInput): string {
  return signGoBffCanonicalString(secret, buildGoBffCanonicalString(input))
}
