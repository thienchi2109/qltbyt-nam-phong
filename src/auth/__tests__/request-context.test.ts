import { describe, expect, it } from "vitest"

import { readAuthorizeRequestContext } from "@/auth/request-context"

describe("readAuthorizeRequestContext", () => {
  it("prefers a trusted real-ip header over a spoofable forwarded-for first hop", () => {
    const request = new Request("http://localhost/api/auth/callback/credentials", {
      headers: {
        "x-real-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.99, 10.0.0.1",
      },
    })

    expect(readAuthorizeRequestContext(request).ip_address).toBe("203.0.113.10")
  })

  it("falls back to the nearest forwarded-for hop when no trusted single-ip header is available", () => {
    const request = new Request("http://localhost/api/auth/callback/credentials", {
      headers: {
        "x-forwarded-for": "198.51.100.99, 203.0.113.20, 10.0.0.1",
      },
    })

    expect(readAuthorizeRequestContext(request).ip_address).toBe("10.0.0.1")
  })

  it("skips invalid trusted header values before reading forwarded-for", () => {
    const request = new Request("http://localhost/api/auth/callback/credentials", {
      headers: {
        "x-real-ip": "not-an-ip",
        "x-forwarded-for": "198.51.100.99, 203.0.113.20",
      },
    })

    expect(readAuthorizeRequestContext(request).ip_address).toBe("203.0.113.20")
  })

  it("returns null when forwarded-for has no valid IP values", () => {
    const request = new Request("http://localhost/api/auth/callback/credentials", {
      headers: {
        "x-forwarded-for": "unknown, not-an-ip",
      },
    })

    expect(readAuthorizeRequestContext(request).ip_address).toBeNull()
  })
})
