import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getServerSession: vi.fn(),
}))

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }))
vi.mock("server-only", () => ({}))

import { GET as getConfig, PUT as putConfig } from "../config/route"
import { GET as getPublicKey } from "../public-key/route"
import { POST as postSubscriptions } from "../subscriptions/route"
import { POST as postReport } from "../../internal/web-push/v1/report/route"
import {
  request,
  runtimeControls,
  VALID_AUTH,
  VALID_P256DH,
  VALID_VAPID_FINGERPRINT,
  VALID_VAPID_PUBLIC_KEY,
  VALID_VAPID_VERSION,
} from "./test-fixtures"

describe("web push API routes", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mocks.fetch)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-jwt-secret")
    vi.stubEnv("WEB_PUSH_ORIGIN", "https://app.example")
    mocks.fetch.mockReset()
    mocks.getServerSession.mockReset()
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: "123",
        role: "technician",
        don_vi: "7",
        current_don_vi: "7",
        dia_ban_id: "9",
        khoa_phong: "lab",
      },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("rejects duplicate config query parameters", async () => {
    const response = await getConfig(
      request("https://app.example/api/web-push/config?don_vi_id=7&don_vi_id=8")
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ version: 1, error: { code: "invalid_request" } })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("returns a validated config response with no-store caching", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ version: 1, don_vi_id: "7", recipients: [] }), {
        headers: { "content-type": "application/json" },
      })
    )

    const response = await getConfig(request("https://app.example/api/web-push/config?don_vi_id=7"))

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ version: 1, don_vi_id: "7", recipients: [] })
  })

  it("rejects cross-origin config mutations before calling Supabase", async () => {
    const response = await putConfig(
      request("https://app.example/api/web-push/config", {
        method: "PUT",
        headers: { "content-type": "application/json", origin: "https://evil.example" },
        body: JSON.stringify({ version: 1, don_vi_id: "7", usernames: "alice" }),
      })
    )

    expect(response.status).toBe(403)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("reports unsupported browser versions explicitly", async () => {
    const response = await putConfig(
      request("https://app.example/api/web-push/config", {
        method: "PUT",
        headers: { "content-type": "application/json", origin: "https://app.example" },
        body: JSON.stringify({ version: 2, don_vi_id: "7", usernames: "alice" }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ version: 1, error: { code: "unsupported_version" } })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("keeps registration disabled while leaving revoke available", async () => {
    mocks.fetch.mockResolvedValueOnce(runtimeControls())
    const response = await postSubscriptions(
      request("https://app.example/api/web-push/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://app.example" },
        body: JSON.stringify({
          version: 1,
          vapid_key_version: "staging-20260910-01",
          subscription: {
            endpoint: "https://push.example.test/push",
            keys: { p256dh: VALID_P256DH, auth: VALID_AUTH },
          },
        }),
      })
    )

    expect(response.status).toBe(503)
    expect(response.headers.get("retry-after")).toBe("60")
    expect(await response.json()).toEqual({
      version: 1,
      error: { code: "disabled", retry_after_seconds: 60 },
    })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it("exposes only the configured public VAPID artifact", async () => {
    mocks.fetch.mockResolvedValueOnce(
      runtimeControls({
        registration_enabled: true,
        vapid: {
          version: VALID_VAPID_VERSION,
          public_key: VALID_VAPID_PUBLIC_KEY,
          fingerprint: VALID_VAPID_FINGERPRINT,
        },
      })
    )

    const response = await getPublicKey()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      version: 1,
      registration_enabled: true,
      vapid: {
        version: VALID_VAPID_VERSION,
        public_key: VALID_VAPID_PUBLIC_KEY,
        fingerprint: VALID_VAPID_FINGERPRINT,
      },
    })
  })

  it("fails closed when runtime controls return an invalid public artifact", async () => {
    mocks.fetch.mockResolvedValueOnce(
      runtimeControls({
        registration_enabled: true,
        vapid: {
          version: VALID_VAPID_VERSION,
          public_key: VALID_VAPID_PUBLIC_KEY,
          fingerprint: "sha256:" + "0".repeat(64),
        },
      })
    )

    const response = await getPublicKey()

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      version: 1,
      error: { code: "unavailable", retry_after_seconds: 60 },
    })
  })

  it("rejects duplicate report JSON before authentication or mutation", async () => {
    const response = await postReport(
      request("https://app.example/api/internal/web-push/v1/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"version":1,"version":1,"results":[]}',
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ version: 1, error: { code: "invalid_request" } })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("rejects invalid report outcome/status combinations before authentication", async () => {
    const response = await postReport(
      request("https://app.example/api/internal/web-push/v1/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version: 1,
          results: [
            {
              delivery_id: "00000000-0000-4000-8000-000000000001",
              attempt_token: "00000000-0000-4000-8000-000000000002",
              subscription_revision: "1",
              outcome: "accepted",
              provider_status: 500,
              retry_after_seconds: null,
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ version: 1, error: { code: "invalid_request" } })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("matches SQL's permanent report status matrix before consuming a nonce", async () => {
    for (const providerStatus of [401, 403, 404, 408, 410, 429, 500]) {
      const response = await postReport(
        request("https://app.example/api/internal/web-push/v1/report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version: 1,
            results: [
              {
                delivery_id: "00000000-0000-4000-8000-000000000001",
                attempt_token: "00000000-0000-4000-8000-000000000002",
                subscription_revision: "1",
                outcome: "permanent",
                provider_status: providerStatus,
                retry_after_seconds: null,
              },
            ],
          }),
        })
      )
      expect(response.status).toBe(400)
    }
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
