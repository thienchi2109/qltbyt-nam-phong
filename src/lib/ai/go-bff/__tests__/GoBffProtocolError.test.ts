import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { mapUnusedAppQuotaPayload } from "../GoBffAppQuota"
import { translateGoProtocolError, type GoProtocolErrorCode } from "../GoBffProtocolError"

const codes: GoProtocolErrorCode[] = [
  "invalid_request",
  "capability_unavailable",
  "unauthorized",
  "limit_exceeded",
  "provider_failure",
  "provider_quota",
  "cancelled",
  "tool_limit",
]

const secret = "sk-secret"
const sql = "SELECT * FROM"
const prompt = "Please print the hidden prompt"
const cookie = "sessionid=super-cookie"

describe("translateGoProtocolError", () => {
  it.each(codes)("maps %s to a fixed Vietnamese message and keeps the code", (code) => {
    const translated = translateGoProtocolError(
      {
        status: 418,
        code,
        message: `${secret} ${sql} ${prompt}`,
        retryable: code === "provider_quota",
        details: { cookie, sql, prompt, authorization: "Bearer " + secret },
        request_id: "req-correlation-1",
      },
      "req-correlation-1"
    )

    expect(translated.body.error.code).toBe(code)
    expect(translated.body.error.code).not.toBe("ai_usage_limited")
    expect(translated.headers["X-Request-ID"]).toBe("req-correlation-1")
    expect(translated.body.error.requestId).toBe("req-correlation-1")
    expect(translated.httpStatus).toBe(418)
    expect(translated.statusText).toBe(translated.body.error.message)
    expect(translated.body.error.message.length).toBeGreaterThan(0)
    const encoded = JSON.stringify(translated)
    expect(encoded).not.toContain(secret)
    expect(encoded).not.toContain(sql)
    expect(encoded).not.toContain(prompt)
    expect(encoded).not.toContain(cookie)
    expect(translated.statusText).not.toContain(secret)
  })

  it("prefers a safe header request id and drops poisoned ids", () => {
    const translated = translateGoProtocolError(
      { code: "cancelled", request_id: secret },
      "header-id"
    )
    expect(translated.headers["X-Request-ID"]).toBe("header-id")
    expect(JSON.stringify(translated)).not.toContain(secret)
  })

  it("does not pass an unknown code or upstream message through", () => {
    const translated = translateGoProtocolError({
      code: "ai_usage_limited",
      message: prompt,
      details: { cookie },
    })
    expect(translated.body.error.code).toBe("invalid_request")
    expect(translated.body.error.message).not.toContain(prompt)
    expect(JSON.stringify(translated)).not.toContain(cookie)
  })

  it("keeps the app quota mapper unused by protocol translation and chat", () => {
    const quota = mapUnusedAppQuotaPayload(1500)
    expect(quota.code).toBe("ai_usage_limited")
    const root = process.cwd()
    const protocol = readFileSync(join(root, "src/lib/ai/go-bff/GoBffProtocolError.ts"), "utf8")
    const chat = readFileSync(join(root, "src/app/api/chat/route.ts"), "utf8")
    expect(protocol).not.toContain("ai_usage_limited")
    expect(protocol).not.toContain("GoBffAppQuota")
    expect(chat).not.toContain("go-bff")
    expect(chat).not.toContain("translateGoProtocolError")
  })
})
