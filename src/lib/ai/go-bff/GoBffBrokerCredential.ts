import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

export interface GoBffBrokerCredentialInput {
  secret: string
  nowSeconds: number
  userId: string | number
  role?: string | null
  sessionFacilityId?: number
  requestedFacilityId?: number
}

export interface GoBffBrokerClaims {
  iss: "nextjs-bff"
  aud: "qltbyt-rpc-broker-v1"
  iat: number
  exp: number
  user_id: number
  role?: string
  session_facility_id?: number
  requested_facility_id?: number
}

const BROKER_ISSUER = "nextjs-bff"
const BROKER_AUDIENCE = "qltbyt-rpc-broker-v1"
/** Maximum lifetime for a Next.js-to-Go broker credential. */
export const GO_BFF_BROKER_MAX_TTL_SECONDS = 120

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
    exp: input.nowSeconds + GO_BFF_BROKER_MAX_TTL_SECONDS,
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

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8")
}

function positiveNumericClaim(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Broker credential contains an invalid ${name}.`)
  }
  return value
}

/** Verifies the server-only compact broker credential at the BFF boundary. */
export function verifyGoBffBrokerToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): GoBffBrokerClaims {
  if (!secret.trim() || !Number.isSafeInteger(nowSeconds) || nowSeconds <= 0) {
    throw new Error("Broker credential verifier is unavailable.")
  }
  const parts = token.split(".")
  if (parts.length !== 2 || parts.some((part) => !part || !/^[A-Za-z0-9_-]+$/.test(part))) {
    throw new Error("Invalid broker credential.")
  }

  const [encodedBody, encodedSignature] = parts
  const expectedSignature = createHmac("sha256", secret)
    .update(decodeBase64Url(encodedBody))
    .digest()
  const actualSignature = Buffer.from(encodedSignature, "base64url")
  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error("Invalid broker credential.")
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(decodeBase64Url(encodedBody))
  } catch {
    throw new Error("Invalid broker credential.")
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error("Invalid broker credential.")
  }

  const claims = decoded as Record<string, unknown>
  const allowedClaims = new Set([
    "iss",
    "aud",
    "iat",
    "exp",
    "user_id",
    "role",
    "session_facility_id",
    "requested_facility_id",
  ])
  if (Object.keys(claims).some((key) => !allowedClaims.has(key))) {
    throw new Error("Invalid broker credential.")
  }
  if (claims.iss !== BROKER_ISSUER || claims.aud !== BROKER_AUDIENCE) {
    throw new Error("Invalid broker credential.")
  }
  if (
    typeof claims.iat !== "number" ||
    !Number.isSafeInteger(claims.iat) ||
    typeof claims.exp !== "number" ||
    !Number.isSafeInteger(claims.exp) ||
    claims.iat <= 0 ||
    claims.exp <= 0 ||
    claims.iat > nowSeconds ||
    claims.exp <= nowSeconds ||
    claims.exp <= claims.iat ||
    claims.exp - claims.iat > GO_BFF_BROKER_MAX_TTL_SECONDS
  ) {
    throw new Error("Invalid broker credential.")
  }

  const userId = positiveNumericClaim(claims.user_id, "user id")
  if (userId === undefined) throw new Error("Invalid broker credential.")
  if (claims.role !== undefined && (typeof claims.role !== "string" || !claims.role.trim())) {
    throw new Error("Invalid broker credential.")
  }
  const sessionFacilityId = positiveNumericClaim(claims.session_facility_id, "session facility id")
  const requestedFacilityId = positiveNumericClaim(
    claims.requested_facility_id,
    "requested facility id"
  )

  return {
    iss: BROKER_ISSUER,
    aud: BROKER_AUDIENCE,
    iat: claims.iat,
    exp: claims.exp,
    user_id: userId,
    ...(claims.role === undefined ? {} : { role: claims.role }),
    ...(sessionFacilityId === undefined ? {} : { session_facility_id: sessionFacilityId }),
    ...(requestedFacilityId === undefined ? {} : { requested_facility_id: requestedFacilityId }),
  }
}
