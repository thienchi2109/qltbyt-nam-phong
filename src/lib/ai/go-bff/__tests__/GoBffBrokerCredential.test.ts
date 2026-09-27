import { createHmac } from "node:crypto"

import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { mintGoBffBrokerToken, verifyGoBffBrokerToken } from "../GoBffBrokerCredential"

describe("mintGoBffBrokerToken", () => {
  it("matches the Go broker payload encoding and never carries a browser cookie", () => {
    const token = mintGoBffBrokerToken({
      secret: "broker-secret",
      nowSeconds: 1_700_000_000,
      userId: "42",
      role: "admin",
      sessionFacilityId: 7,
      requestedFacilityId: 9,
    })

    const [encodedBody, encodedSignature] = token.split(".")
    const body = JSON.parse(Buffer.from(encodedBody, "base64url").toString("utf8"))

    expect(body).toEqual({
      iss: "nextjs-bff",
      aud: "qltbyt-rpc-broker-v1",
      iat: 1_700_000_000,
      exp: 1_700_000_120,
      user_id: 42,
      role: "admin",
      session_facility_id: 7,
      requested_facility_id: 9,
    })
    expect(encodedSignature).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token).not.toContain("cookie")
  })

  it("rejects a non-numeric session user id", () => {
    expect(() =>
      mintGoBffBrokerToken({
        secret: "broker-secret",
        nowSeconds: 1_700_000_000,
        userId: "user-uuid",
        role: "user",
      })
    ).toThrowError(/numeric/i)
  })

  it("verifies issuer, audience, clock and positive facility claims", () => {
    const token = mintGoBffBrokerToken({
      secret: "broker-secret",
      nowSeconds: 1_700_000_000,
      userId: 42,
      role: "admin",
      sessionFacilityId: 7,
      requestedFacilityId: 9,
    })

    expect(verifyGoBffBrokerToken(token, "broker-secret", 1_700_000_010)).toMatchObject({
      iss: "nextjs-bff",
      aud: "qltbyt-rpc-broker-v1",
      user_id: 42,
      session_facility_id: 7,
      requested_facility_id: 9,
    })
    expect(() => verifyGoBffBrokerToken(token, "wrong-secret", 1_700_000_010)).toThrow(/invalid/i)
    expect(() => verifyGoBffBrokerToken(token, "broker-secret", 1_700_000_120)).toThrow(/invalid/i)
  })

  it.each([0, -1, 1.5])("rejects nonpositive or noninteger facility claim %s", (value) => {
    const [encodedBody, signature] = mintGoBffBrokerToken({
      secret: "broker-secret",
      nowSeconds: 1_700_000_000,
      userId: 42,
      role: "user",
      sessionFacilityId: 7,
    }).split(".")
    const body = JSON.parse(Buffer.from(encodedBody, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >
    body.session_facility_id = value
    const forgedBody = Buffer.from(JSON.stringify(body)).toString("base64url")
    const forgedSignature = createHmac("sha256", "broker-secret")
      .update(JSON.stringify(body))
      .digest("base64url")
    expect(signature).not.toBe(forgedSignature)
    expect(() =>
      verifyGoBffBrokerToken(`${forgedBody}.${forgedSignature}`, "broker-secret")
    ).toThrow(/invalid/i)
  })
})
