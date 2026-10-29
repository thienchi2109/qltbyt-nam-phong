import jwt from "jsonwebtoken"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), getServerSession: vi.fn() }))
vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }))
vi.mock("server-only", () => ({}))

import { POST as register } from "../subscriptions/route"
import { POST as revoke } from "../subscriptions/revoke/route"
import {
  request,
  runtimeControls,
  VALID_AUTH,
  VALID_P256DH,
  VALID_VAPID_FINGERPRINT,
  VALID_VAPID_VERSION,
} from "./test-fixtures"

const subscriptionId = "00000000-0000-4000-8000-000000000002"
const revision = "9007199254740993"
const subscription = {
  endpoint: "https://push.example.test/qltbyt",
  keys: { p256dh: VALID_P256DH, auth: VALID_AUTH },
}
const routes = [
  {
    name: "register",
    handler: register,
    path: "subscriptions",
    body: { version: 1, vapid_key_version: VALID_VAPID_VERSION, subscription },
    rpc: "web_push_subscription_register",
    args: { p_subscription: subscription, p_vapid_key_version: VALID_VAPID_VERSION },
    reply: { version: 1, subscription_id: subscriptionId, revision },
  },
  {
    name: "revoke",
    handler: revoke,
    path: "subscriptions/revoke",
    body: { version: 1, subscription_id: subscriptionId, revision },
    rpc: "web_push_subscription_revoke",
    args: { p_subscription_id: subscriptionId, p_revision: revision },
    reply: { version: 1, revoked: true },
  },
]

function mutation(path: string, body: unknown, origin = "https://app.example") {
  return request(`https://app.example/api/web-push/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.stubGlobal("fetch", mocks.fetch)
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")
  vi.stubEnv("SUPABASE_JWT_SECRET", "test-jwt-secret")
  vi.stubEnv("WEB_PUSH_ORIGIN", "https://app.example")
  mocks.fetch.mockReset()
  mocks.getServerSession.mockReset().mockResolvedValue({
    user: { id: "123", role: "admin", don_vi: "7", dia_ban_id: "9", khoa_phong: "lab" },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe.each(routes)("QLTBYT $name v1 browser route", (route) => {
  function upstream(payload: unknown, status = 200) {
    if (route.name === "register") {
      mocks.fetch.mockResolvedValueOnce(
        runtimeControls({
          registration_enabled: true,
          vapid: {
            version: VALID_VAPID_VERSION,
            public_key: VALID_P256DH,
            fingerprint: VALID_VAPID_FINGERPRINT,
          },
        })
      )
    }
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status }))
  }

  it("rejects a foreign origin before session lookup or upstream access", async () => {
    const response = await route.handler(mutation(route.path, route.body, "https://evil.example"))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ version: 1, error: { code: "forbidden" } })
    expect(mocks.getServerSession).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it.each([null, { user: { id: "123" } }])(
    "rejects an absent or invalid session: %j",
    async (session) => {
      mocks.getServerSession.mockResolvedValue(session)
      const response = await route.handler(mutation(route.path, route.body))
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ version: 1, error: { code: "unauthorized" } })
      expect(mocks.fetch).not.toHaveBeenCalled()
    }
  )

  it.each([
    ["unsupported_version", { version: 2 }],
    ["invalid_request", { user_id: "456" }],
    ["invalid_request", { app_id: "another-app" }],
  ])(
    "keeps the versioned %s error and rejects caller ownership fields: %j",
    async (code, extra) => {
      const response = await route.handler(mutation(route.path, { ...route.body, ...extra }))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ version: 1, error: { code } })
      expect(mocks.fetch).not.toHaveBeenCalled()
    }
  )

  it("uses only session ownership and exact v1 RPC arguments", async () => {
    upstream(route.reply)
    const response = await route.handler(mutation(route.path, route.body))
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual(route.reply)
    const [url, init] = mocks.fetch.mock.calls.at(-1) as [string, RequestInit]
    expect(url).toBe(`https://supabase.example/rest/v1/rpc/${route.rpc}`)
    expect(JSON.parse(String(init.body))).toEqual(route.args)
    const token = new Headers(init.headers).get("authorization")?.replace(/^Bearer /, "")
    expect(jwt.verify(token!, "test-jwt-secret", { algorithms: ["HS256"] })).toMatchObject({
      sub: "123",
      user_id: "123",
      role: "authenticated",
      app_role: "global",
      don_vi: "7",
    })
  })

  it("fails closed on malformed successful upstream metadata", async () => {
    upstream(
      route.name === "register" ? { ...route.reply, revision: "0" } : { version: 1, revoked: false }
    )
    const response = await route.handler(mutation(route.path, route.body))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      version: 1,
      error: { code: "unavailable", retry_after_seconds: 60 },
    })
  })

  it("preserves revision conflict without leaking SQL error detail", async () => {
    upstream({ code: "40001", message: "private database detail" }, 409)
    const response = await route.handler(mutation(route.path, route.body))
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ version: 1, error: { code: "subscription_conflict" } })
  })
})

describe("QLTBYT subscription mutation validation", () => {
  it.each([
    { subscription_id: "not-a-uuid", revision: "1" },
    { subscription_id: subscriptionId, revision: "0" },
    { subscription_id: subscriptionId, revision: "9223372036854775808" },
    { subscription_id: subscriptionId, revision: 9007199254740992 },
  ])("rejects invalid revoke identity or revision before RPC: %j", async (body) => {
    const response = await revoke(mutation("subscriptions/revoke", { version: 1, ...body }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ version: 1, error: { code: "invalid_request" } })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("rejects an unsafe registration endpoint before runtime lookup", async () => {
    const response = await register(
      mutation("subscriptions", {
        ...routes[0].body,
        subscription: { ...subscription, endpoint: "http://127.0.0.1/push" },
      })
    )
    expect(response.status).toBe(400)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("does not require runtime controls for exact-revision revoke", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ version: 1, revoked: true })))
    const response = await revoke(mutation("subscriptions/revoke", routes[1].body))
    expect(response.status).toBe(200)
    expect(mocks.fetch).toHaveBeenCalledOnce()
    expect(mocks.fetch.mock.calls[0][0]).toMatch(/\/web_push_subscription_revoke$/)
  })
})
