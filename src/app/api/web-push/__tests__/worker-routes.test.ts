import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { POST as postClaim } from "../../internal/web-push/v1/claim/route"
import { POST as postReport } from "../../internal/web-push/v1/report/route"
import { GET as getPublicKey } from "../public-key/route"
import { signWebPushRequest } from "@/lib/web-push/wire"
import {
  request,
  runtimeControls,
  VALID_AUTH,
  VALID_P256DH,
  VALID_VAPID_FINGERPRINT,
  VALID_VAPID_PUBLIC_KEY,
  VALID_VAPID_VERSION,
} from "./test-fixtures"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}))

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))

describe("web push worker API routes", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mocks.fetch)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-jwt-secret")
    vi.stubEnv("WEB_PUSH_ORIGIN", "https://app.example")
    mocks.fetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("authenticates a claim, consumes its nonce, and returns the validated RPC envelope", async () => {
    const secret = Buffer.alloc(32, 1).toString("base64")
    const fingerprint = VALID_VAPID_FINGERPRINT
    const body = JSON.stringify({
      version: 1,
      worker_id: "oracle-web-push-1",
      limit: 1,
      vapid_key_version: VALID_VAPID_VERSION,
      vapid_fingerprint: fingerprint,
    })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = "000102030405060708090a0b0c0d0e0f"
    const signature = signWebPushRequest(secret, {
      keyId: "test-key-1",
      method: "POST",
      path: "/api/internal/web-push/v1/claim",
      timestamp,
      nonce,
      rawBody: body,
    })
    const payload = JSON.stringify({
      version: 1,
      notification_id: "00000000-0000-4000-8000-000000000001",
      title: "Thiết bị",
      body: "Khoa phòng\nMô tả",
      url: "/repair-requests?action=view&requestId=1",
      tag: "repair-request:1",
    })
    vi.stubEnv("WEB_PUSH_HMAC_CURRENT_KEY_ID", "test-key-1")
    vi.stubEnv("WEB_PUSH_HMAC_CURRENT_SECRET", secret)
    mocks.fetch
      .mockResolvedValueOnce(
        runtimeControls({
          dispatch_enabled: true,
          vapid: {
            version: VALID_VAPID_VERSION,
            public_key: VALID_VAPID_PUBLIC_KEY,
            fingerprint: VALID_VAPID_FINGERPRINT,
          },
        })
      )
      .mockResolvedValueOnce(
        new Response("true", { headers: { "content-type": "application/json" } })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            version: 1,
            server_time: "2026-09-12T14:00:00.000Z",
            poll_after_seconds: 5,
            deliveries: [
              {
                delivery_id: "00000000-0000-4000-8000-000000000002",
                attempt_token: "00000000-0000-4000-8000-000000000003",
                attempt: 1,
                subscription_id: "00000000-0000-4000-8000-000000000004",
                subscription_revision: "1",
                lease_expires_at: "2026-09-12T14:00:45.000Z",
                deadline: "2026-09-13T14:00:00.000Z",
                ttl_seconds: 86400,
                vapid_key_version: "staging-20260910-01",
                endpoint: "https://push.example.test/push",
                keys: { p256dh: VALID_P256DH, auth: VALID_AUTH },
                payload_base64: Buffer.from(payload, "utf8").toString("base64"),
              },
            ],
          }),
          { headers: { "content-type": "application/json" } }
        )
      )

    const response = await postClaim(
      request("https://app.example/api/internal/web-push/v1/claim", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-web-push-key-id": "test-key-1",
          "x-web-push-timestamp": timestamp,
          "x-web-push-nonce": nonce,
          "x-web-push-signature": signature,
        },
        body,
      })
    )

    expect(response.status).toBe(200)
    const claimResult = await response.json()
    expect(claimResult).toMatchObject({ version: 1, deliveries: [{ attempt: 1 }] })

    const delivery = claimResult.deliveries[0]
    const reportBody = JSON.stringify({
      version: 1,
      results: [
        {
          delivery_id: delivery.delivery_id,
          attempt_token: delivery.attempt_token,
          subscription_revision: delivery.subscription_revision,
          outcome: "accepted",
          provider_status: 201,
          retry_after_seconds: null,
        },
      ],
    })
    const reportTimestamp = Math.floor(Date.now() / 1000).toString()
    const reportNonce = "5152535455565758595a5b5c5d5e5f60"
    const reportSignature = signWebPushRequest(secret, {
      keyId: "test-key-1",
      method: "POST",
      path: "/api/internal/web-push/v1/report",
      timestamp: reportTimestamp,
      nonce: reportNonce,
      rawBody: reportBody,
    })
    mocks.fetch.mockResolvedValueOnce(new Response("true")).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          version: 1,
          results: [{ delivery_id: delivery.delivery_id, result: "applied" }],
        }),
        { headers: { "content-type": "application/json" } }
      )
    )
    const report = await postReport(
      request("https://app.example/api/internal/web-push/v1/report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-web-push-key-id": "test-key-1",
          "x-web-push-timestamp": reportTimestamp,
          "x-web-push-nonce": reportNonce,
          "x-web-push-signature": reportSignature,
        },
        body: reportBody,
      })
    )
    expect(report.status).toBe(200)
    expect(await report.json()).toEqual({
      version: 1,
      results: [{ delivery_id: delivery.delivery_id, result: "applied" }],
    })

    const duplicateNonce = "6162636465666768696a6b6c6d6e6f70"
    const duplicateSignature = signWebPushRequest(secret, {
      keyId: "test-key-1",
      method: "POST",
      path: "/api/internal/web-push/v1/report",
      timestamp: reportTimestamp,
      nonce: duplicateNonce,
      rawBody: reportBody,
    })
    mocks.fetch.mockResolvedValueOnce(new Response("true")).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          version: 1,
          results: [{ delivery_id: delivery.delivery_id, result: "duplicate" }],
        }),
        { headers: { "content-type": "application/json" } }
      )
    )
    const duplicate = await postReport(
      request("https://app.example/api/internal/web-push/v1/report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-web-push-key-id": "test-key-1",
          "x-web-push-timestamp": reportTimestamp,
          "x-web-push-nonce": duplicateNonce,
          "x-web-push-signature": duplicateSignature,
        },
        body: reportBody,
      })
    )
    expect(duplicate.status).toBe(200)
    expect(await duplicate.json()).toEqual({
      version: 1,
      results: [{ delivery_id: delivery.delivery_id, result: "duplicate" }],
    })
    expect(mocks.fetch).toHaveBeenCalledTimes(7)
  })

  it("rejects a VAPID fingerprint mismatch before consuming the signed nonce", async () => {
    const secret = Buffer.alloc(32, 4).toString("base64")
    const body = JSON.stringify({
      version: 1,
      worker_id: "oracle-web-push-1",
      limit: 1,
      vapid_key_version: VALID_VAPID_VERSION,
      vapid_fingerprint: "sha256:" + "0".repeat(64),
    })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = "404142434445464748494a4b4c4d4e4f"
    const signature = signWebPushRequest(secret, {
      keyId: "mismatch-key",
      method: "POST",
      path: "/api/internal/web-push/v1/claim",
      timestamp,
      nonce,
      rawBody: body,
    })
    vi.stubEnv("WEB_PUSH_HMAC_CURRENT_KEY_ID", "mismatch-key")
    vi.stubEnv("WEB_PUSH_HMAC_CURRENT_SECRET", secret)
    mocks.fetch.mockResolvedValueOnce(
      runtimeControls({
        dispatch_enabled: true,
        vapid: {
          version: VALID_VAPID_VERSION,
          public_key: VALID_VAPID_PUBLIC_KEY,
          fingerprint: VALID_VAPID_FINGERPRINT,
        },
      })
    )

    const response = await postClaim(
      request("https://app.example/api/internal/web-push/v1/claim", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-web-push-key-id": "mismatch-key",
          "x-web-push-timestamp": timestamp,
          "x-web-push-nonce": nonce,
          "x-web-push-signature": signature,
        },
        body,
      })
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      version: 1,
      error: { code: "key_version_mismatch" },
    })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it("accepts a valid previous HMAC only during the fixed overlap window", async () => {
    const secret = Buffer.alloc(32, 2).toString("base64")
    const now = Math.floor(Date.now() / 1000)
    const startedAt = now - 3600
    const expiresAt = startedAt + 86400
    const body = JSON.stringify({ version: 1, results: [] })
    const timestamp = now.toString()
    const nonce = "101112131415161718191a1b1c1d1e1f"
    const signature = signWebPushRequest(secret, {
      keyId: "previous-key",
      method: "POST",
      path: "/api/internal/web-push/v1/report",
      timestamp,
      nonce,
      rawBody: body,
    })
    vi.stubEnv("WEB_PUSH_HMAC_PREVIOUS_KEY_ID", "previous-key")
    vi.stubEnv("WEB_PUSH_HMAC_PREVIOUS_SECRET", secret)
    vi.stubEnv("WEB_PUSH_HMAC_PREVIOUS_STARTED_AT", String(startedAt))
    vi.stubEnv("WEB_PUSH_HMAC_PREVIOUS_EXPIRES_AT", String(expiresAt))
    mocks.fetch.mockResolvedValueOnce(new Response("true")).mockResolvedValueOnce(
      new Response(JSON.stringify({ version: 1, results: [] }), {
        headers: { "content-type": "application/json" },
      })
    )

    const accepted = await postReport(
      request("https://app.example/api/internal/web-push/v1/report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-web-push-key-id": "previous-key",
          "x-web-push-timestamp": timestamp,
          "x-web-push-nonce": nonce,
          "x-web-push-signature": signature,
        },
        body,
      })
    )
    expect(accepted.status).toBe(200)
    expect(mocks.fetch).toHaveBeenCalledTimes(2)

    mocks.fetch.mockReset()
    vi.stubEnv("WEB_PUSH_HMAC_PREVIOUS_EXPIRES_AT", String(now))
    const expiredNonce = "202122232425262728292a2b2c2d2e2f"
    const expiredSignature = signWebPushRequest(secret, {
      keyId: "previous-key",
      method: "POST",
      path: "/api/internal/web-push/v1/report",
      timestamp,
      nonce: expiredNonce,
      rawBody: body,
    })
    const expired = await postReport(
      request("https://app.example/api/internal/web-push/v1/report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-web-push-key-id": "previous-key",
          "x-web-push-timestamp": timestamp,
          "x-web-push-nonce": expiredNonce,
          "x-web-push-signature": expiredSignature,
        },
        body,
      })
    )
    expect(expired.status).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("fails closed on nonce replay before a duplicate report reaches SQL", async () => {
    const secret = Buffer.alloc(32, 3).toString("base64")
    const body = JSON.stringify({ version: 1, results: [] })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = "303132333435363738393a3b3c3d3e3f"
    const signature = signWebPushRequest(secret, {
      keyId: "current-key",
      method: "POST",
      path: "/api/internal/web-push/v1/report",
      timestamp,
      nonce,
      rawBody: body,
    })
    vi.stubEnv("WEB_PUSH_HMAC_CURRENT_KEY_ID", "current-key")
    vi.stubEnv("WEB_PUSH_HMAC_CURRENT_SECRET", secret)
    mocks.fetch
      .mockResolvedValueOnce(new Response("true"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: 1, results: [] }), {
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(new Response("false"))

    const init = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-web-push-key-id": "current-key",
        "x-web-push-timestamp": timestamp,
        "x-web-push-nonce": nonce,
        "x-web-push-signature": signature,
      },
      body,
    }
    const first = await postReport(
      request("https://app.example/api/internal/web-push/v1/report", init)
    )
    const replay = await postReport(
      request("https://app.example/api/internal/web-push/v1/report", init)
    )

    expect(first.status).toBe(200)
    expect(replay.status).toBe(409)
    expect(await replay.json()).toEqual({ version: 1, error: { code: "replay" } })
    expect(mocks.fetch).toHaveBeenCalledTimes(3)
  })

  it("rejects an oversized worker body before authentication", async () => {
    const response = await postReport(
      request("https://app.example/api/internal/web-push/v1/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: 1, results: [], padding: "x".repeat(9000) }),
      })
    )

    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ version: 1, error: { code: "body_too_large" } })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("does not expose an upstream SQL error from the public config endpoint", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response("secret SQL detail", { status: 500 }))

    const response = await getPublicKey()

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      version: 1,
      error: { code: "unavailable", retry_after_seconds: 60 },
    })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
})
