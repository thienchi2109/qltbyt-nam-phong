import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

vi.mock("server-only", () => ({}))

import { readGoBffConfig } from "../GoBffConfig"

const validEnv = {
  AI_SERVICE_URL: "https://ai.example.internal",
  AI_SERVICE_HMAC_KEY_ID: "key-1",
  AI_SERVICE_HMAC_SECRET: "hmac-secret",
  AI_SERVICE_BROKER_SECRET: "broker-secret",
  AI_SERVICE_CF_ACCESS_CLIENT_ID: "access-id",
  AI_SERVICE_CF_ACCESS_CLIENT_SECRET: "access-secret",
}

describe("readGoBffConfig", () => {
  it("is marked server-only so credentials cannot enter a browser bundle", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/ai/go-bff/GoBffConfig.ts"), "utf8")
    expect(source).toContain('import "server-only"')
  })

  it("returns a server-only endpoint and credentials", () => {
    expect(readGoBffConfig(validEnv)).toEqual({
      endpoint: "https://ai.example.internal/v1/chat",
      hmacKeyId: "key-1",
      hmacSecret: "hmac-secret",
      brokerSecret: "broker-secret",
      cloudflareClientId: "access-id",
      cloudflareClientSecret: "access-secret",
    })
  })

  it.each([
    "AI_SERVICE_URL",
    "AI_SERVICE_HMAC_KEY_ID",
    "AI_SERVICE_HMAC_SECRET",
    "AI_SERVICE_BROKER_SECRET",
    "AI_SERVICE_CF_ACCESS_CLIENT_ID",
    "AI_SERVICE_CF_ACCESS_CLIENT_SECRET",
  ])("fails closed when %s is missing", (key) => {
    const env = { ...validEnv }
    delete env[key as keyof typeof env]

    expect(() => readGoBffConfig(env)).toThrowError(/configuration/i)
  })

  it("rejects an invalid service URL and mismatched Access credentials", () => {
    expect(() => readGoBffConfig({ ...validEnv, AI_SERVICE_URL: "file:///tmp/ai" })).toThrowError(
      /configuration/i
    )
    expect(() =>
      readGoBffConfig({ ...validEnv, AI_SERVICE_CF_ACCESS_CLIENT_SECRET: "" })
    ).toThrowError(/configuration/i)
  })
})
