import { describe, expect, it } from "vitest"

import { mintGoBffBrokerToken } from "../GoBffBrokerCredential"

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
})
