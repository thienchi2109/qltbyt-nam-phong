import { createHmac } from "node:crypto"

export interface GoBffBrokerCredentialInput {
  secret: string
  nowSeconds: number
  userId: string | number
  role?: string | null
  sessionFacilityId?: number
  requestedFacilityId?: number
}

function numericClaim(value: string | number, name: string): number {
  const normalized = typeof value === "number" ? value : Number(value.trim())
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error(`Broker credential requires a numeric ${name}.`)
  }
  return normalized
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url")
}

/** Encodes the short-lived QLTBYT broker credential expected by Go. */
export function mintGoBffBrokerToken(input: GoBffBrokerCredentialInput): string {
  if (!input.secret.trim()) {
    throw new Error("Broker credential requires a server secret.")
  }
  if (!Number.isSafeInteger(input.nowSeconds) || input.nowSeconds <= 0) {
    throw new Error("Broker credential requires a valid timestamp.")
  }

  const payload: Record<string, unknown> = {
    iss: "nextjs-bff",
    aud: "qltbyt-rpc-broker-v1",
    iat: input.nowSeconds,
    exp: input.nowSeconds + 120,
    user_id: numericClaim(input.userId, "user id"),
  }
  if (input.role?.trim()) {
    payload.role = input.role.trim()
  }
  if (input.sessionFacilityId !== undefined) {
    payload.session_facility_id = numericClaim(input.sessionFacilityId, "session facility id")
  }
  if (input.requestedFacilityId !== undefined) {
    payload.requested_facility_id = numericClaim(input.requestedFacilityId, "requested facility id")
  }

  const body = JSON.stringify(payload)
  const signature = createHmac("sha256", input.secret).update(body).digest()
  return `${base64Url(body)}.${base64Url(signature)}`
}
