import { beforeEach, describe, expect, it, vi } from "vitest"

import { createHmac } from "node:crypto"

vi.mock("server-only", () => ({}))

const callServerRpcMock = vi.fn()

vi.mock("@/lib/ai/server-rpc", () => ({
  callServerRpc: (...args: unknown[]) => callServerRpcMock(...args),
}))

import { POST } from "../route"
import { mintGoBffBrokerToken } from "@/lib/ai/go-bff/GoBffBrokerCredential"

const SECRET = "broker-secret"
const REQUEST_ID = "req-broker-1"

function brokerToken(claims: Partial<Parameters<typeof mintGoBffBrokerToken>[0]> = {}): string {
  return mintGoBffBrokerToken({
    secret: SECRET,
    nowSeconds: 1_700_000_000,
    userId: 42,
    role: "technician",
    sessionFacilityId: 7,
    ...claims,
  })
}

function request(
  body: unknown,
  options: { token?: string | null; requestId?: string; headers?: Record<string, string> } = {}
): Request {
  return rawRequest(JSON.stringify(body), options)
}

function rawRequest(
  rawBody: string,
  options: { token?: string | null; requestId?: string; headers?: Record<string, string> } = {}
): Request {
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-Request-ID": options.requestId ?? REQUEST_ID,
    ...options.headers,
  })
  if (options.token !== null) {
    headers.set("Authorization", `Bearer ${options.token ?? brokerToken()}`)
  }
  return new Request("http://localhost/api/internal/ai/broker/v1", {
    method: "POST",
    headers,
    body: rawBody,
  })
}

function brokerTokenWithClaims(overrides: Record<string, unknown>): string {
  const [encodedBody] = brokerToken().split(".")
  const claims = JSON.parse(Buffer.from(encodedBody, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >
  const body = Buffer.from(JSON.stringify({ ...claims, ...overrides })).toString("base64url")
  const signature = createHmac("sha256", SECRET)
    .update(Buffer.from(body, "base64url").toString("utf8"))
    .digest("base64url")
  return `${body}.${signature}`
}

function bodyFor(
  rpc: string,
  payload: Record<string, unknown> = {},
  operation: "call" | "cleanup" = "call"
) {
  return {
    protocol_version: "v1",
    request_id: REQUEST_ID,
    operation,
    rpc,
    payload,
  }
}

describe("POST /api/internal/ai/broker/v1", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2023-11-14T22:13:40.000Z"))
    vi.stubEnv("AI_SERVICE_BFF_BROKER_SECRET", SECRET)
    vi.stubEnv("SUPABASE_JWT_SECRET", "supabase-secret")
    callServerRpcMock.mockReset()
    callServerRpcMock.mockResolvedValue({ data: [], total: 0, limit: 10, appliedFilters: {} })
  })

  it("validates the broker token, derives scope, and dispatches a catalog call", async () => {
    const response = await POST(
      request(bodyFor("ai_equipment_lookup", { query: "monitor" }), {
        headers: { "X-Browser-Role": "global" },
      }) as never
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Request-ID")).toBe(REQUEST_ID)
    await expect(response.json()).resolves.toEqual({
      protocol_version: "v1",
      request_id: REQUEST_ID,
      rpc: "ai_equipment_lookup",
      result: { data: [], total: 0, limit: 10, appliedFilters: {} },
    })
    expect(callServerRpcMock).toHaveBeenCalledWith(
      "ai_equipment_lookup",
      {
        query: "monitor",
        p_don_vi: 7,
        p_user_id: "42",
      },
      {
        id: "42",
        role: "technician",
        don_vi: 7,
        current_don_vi: 7,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it.each([
    ["missing", null],
    ["forged", `${brokerToken()}.tampered`],
    ["expired", brokerToken({ nowSeconds: 1_699_999_800 })],
    ["future-dated", brokerToken({ nowSeconds: 1_700_000_030 })],
    ["over-TTL", brokerTokenWithClaims({ exp: 1_700_000_121 })],
    ["wrong audience", brokerToken({ nowSeconds: 1_700_000_000 })],
  ])("rejects %s broker credentials before RPC", async (_label, token) => {
    const effectiveToken =
      _label === "wrong audience"
        ? (() => {
            const [encoded, signature] = brokerToken().split(".")
            const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<
              string,
              unknown
            >
            claims.aud = "other-service"
            const body = Buffer.from(JSON.stringify(claims)).toString("base64url")
            return `${body}.${signature}`
          })()
        : token
    const response = await POST(
      request(bodyFor("ai_equipment_lookup"), { token: effectiveToken }) as never
    )

    expect(response.status).toBe(401)
    expect(callServerRpcMock).not.toHaveBeenCalled()
    expect((await response.json()).error.request_id).toBe(REQUEST_ID)
  })

  it("generates a safe correlation id for a missing request id", async () => {
    const response = await POST(request(bodyFor("ai_equipment_lookup"), { requestId: "" }) as never)

    expect(response.status).toBe(400)
    const generated = response.headers.get("X-Request-ID")
    expect(generated).toMatch(/^[A-Za-z0-9._:-]{1,128}$/)
    expect((await response.json()).error.request_id).toBe(generated)
    expect(callServerRpcMock).not.toHaveBeenCalled()
  })

  it("rejects unknown RPCs, widened scope, and cleanup mismatches", async () => {
    for (const body of [
      bodyFor("unknown_rpc"),
      bodyFor("ai_equipment_lookup", { p_user_id: "999" }),
      bodyFor("ai_quota_reserve", {}, "cleanup"),
    ]) {
      const response = await POST(request(body) as never)
      expect(response.status).toBe(403)
    }
    expect(callServerRpcMock).not.toHaveBeenCalled()
  })

  it("rejects malformed and oversized JSON before RPC", async () => {
    const malformed = await POST(rawRequest("{invalid-json") as never)
    expect(malformed.status).toBe(400)

    const oversizedStream = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(new TextEncoder().encode("x".repeat(65 * 1024 + 1)))
        streamController.close()
      },
    })
    const oversized = await POST(
      new Request("http://localhost/api/internal/ai/broker/v1", {
        method: "POST",
        headers: new Headers({
          Authorization: `Bearer ${brokerToken()}`,
          "Content-Type": "application/json",
          "X-Request-ID": REQUEST_ID,
        }),
        body: oversizedStream,
        duplex: "half",
      } as RequestInit & { duplex: "half" })
    )
    expect(oversized.status).toBe(413)
    expect(callServerRpcMock).not.toHaveBeenCalled()
  })

  it("does not accept browser cookies or Supabase signing secrets as authority", async () => {
    for (const headers of [
      { Cookie: "next-auth.session-token" },
      { "X-Supabase-JWT-Secret": "project-secret" },
    ]) {
      const response = await POST(request(bodyFor("ai_equipment_lookup"), { headers }) as never)
      expect(response.status).toBe(401)
    }
    const body = bodyFor("ai_equipment_lookup", { SUPABASE_JWT_SECRET: SECRET })
    const response = await POST(request(body) as never)
    expect(response.status).toBe(403)
    expect(callServerRpcMock).not.toHaveBeenCalled()
  })

  it("treats Cloudflare Access headers as transport metadata, never authority", async () => {
    const accessHeaders = {
      "CF-Access-Client-Id": "browser-copy-id",
      "CF-Access-Client-Secret": "browser-copy-secret",
    }
    const missingBrokerToken = await POST(
      rawRequest(JSON.stringify(bodyFor("ai_equipment_lookup")), {
        token: null,
        headers: accessHeaders,
      }) as never
    )
    expect(missingBrokerToken.status).toBe(401)

    const validBrokerToken = await POST(
      request(bodyFor("ai_equipment_lookup"), { headers: accessHeaders }) as never
    )
    expect(validBrokerToken.status).toBe(200)
    expect(callServerRpcMock).toHaveBeenCalledOnce()
  })

  it("fails closed when the server-only Supabase signing secret is unavailable", async () => {
    vi.stubEnv("SUPABASE_JWT_SECRET", "")
    const response = await POST(request(bodyFor("ai_equipment_lookup")) as never)

    expect(response.status).toBe(503)
    expect((await response.json()).error.code).toBe("unavailable")
    expect(callServerRpcMock).not.toHaveBeenCalled()
  })

  it("fails closed when the server-only broker secret is unavailable", async () => {
    vi.stubEnv("AI_SERVICE_BFF_BROKER_SECRET", "")
    const response = await POST(request(bodyFor("ai_equipment_lookup")) as never)

    expect(response.status).toBe(503)
    expect((await response.json()).error.code).toBe("unavailable")
    expect(callServerRpcMock).not.toHaveBeenCalled()
  })

  it("derives audit telemetry and only permits cleanup-safe finalize fields", async () => {
    callServerRpcMock.mockResolvedValueOnce(true).mockResolvedValueOnce(null)
    const auditResponse = await POST(
      request(
        bodyFor("assistant_query_database_audit_log", {
          p_status: "success",
          p_tool_path: "query_database",
          p_sql_shape: "SELECT count(*)",
          p_latency_ms: 12,
        }),
        { token: brokerToken({ role: "admin", requestedFacilityId: 9 }) }
      ) as never
    )
    expect(auditResponse.status).toBe(200)
    expect(callServerRpcMock.mock.calls[0]?.[1]).toMatchObject({
      p_effective_facility_id: 9,
      p_facility_source: "selected",
      p_requested_facility_id: 9,
      p_session_facility_id: 7,
      p_raw_role: "admin",
    })

    const finalizeResponse = await POST(
      request(
        bodyFor(
          "ai_quota_finalize",
          {
            p_reservation_id: "reservation-1",
            p_status: "success",
            p_tokens_in: 2,
            p_tokens_out: 3,
            p_cost_usd: 0.01,
          },
          "cleanup"
        )
      ) as never
    )
    expect(finalizeResponse.status).toBe(200)
    expect(callServerRpcMock.mock.calls[1]?.[1]).toEqual({
      p_reservation_id: "reservation-1",
      p_status: "success",
      p_tokens_in: 2,
      p_tokens_out: 3,
      p_cost_usd: 0.01,
    })
  })

  it("dispatches a successful quota reservation with derived identity fields", async () => {
    callServerRpcMock.mockResolvedValueOnce([{ allowed: true, reservation_id: "reservation-1" }])
    const response = await POST(
      request(
        bodyFor("ai_quota_reserve", {
          p_rate_window_ms: 60_000,
          p_rate_max: 5,
          p_user_daily_max: 20,
          p_tenant_daily_max: 100,
          p_global_daily_max: 1000,
          p_ttl_ms: 30_000,
        })
      ) as never
    )

    expect(response.status).toBe(200)
    expect((await response.json()).result).toEqual([
      { allowed: true, reservation_id: "reservation-1" },
    ])
    expect(callServerRpcMock.mock.calls[0]?.[1]).toMatchObject({
      p_user_id: "42",
      p_tenant_id: 7,
    })
  })

  it("rejects an unknown result field and never returns a partial result", async () => {
    callServerRpcMock.mockResolvedValue({ data: [{ id: 1, secret: "leak" }], total: 1 })

    const response = await POST(request(bodyFor("ai_equipment_lookup")) as never)
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "result_too_large", retryable: false, request_id: REQUEST_ID },
    })
  })

  it("rejects applied-filter keys outside the seven-key contract", async () => {
    callServerRpcMock.mockResolvedValue({
      data: [],
      total: 0,
      limit: 10,
      appliedFilters: { unexpected: "leak" },
    })

    const response = await POST(request(bodyFor("ai_equipment_lookup")) as never)
    expect(response.status).toBe(502)
    expect((await response.json()).error.code).toBe("result_too_large")
  })

  it("rejects usage results with more than 100 condition-count keys", async () => {
    const conditionCounts = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [`condition-${index}`, index])
    )
    callServerRpcMock.mockResolvedValue({
      thiet_bi_id: 1,
      total_sessions: 101,
      avg_duration_hours: 1,
      sessions_last_30_days: 50,
      sessions_last_90_days: 90,
      condition_counts: conditionCounts,
      earliest_session: null,
      latest_session: null,
      months_range: 12,
    })

    const response = await POST(request(bodyFor("ai_usage_summary", { p_thiet_bi_id: 1 })) as never)
    expect(response.status).toBe(502)
    expect((await response.json()).error.code).toBe("result_too_large")
  })

  it("rejects unknown fields recursively inside bounded result objects", async () => {
    callServerRpcMock.mockResolvedValue({
      kind: "device_quota",
      device: { id: 1, ma_thiet_bi: "EQ-1", ten_thiet_bi: "Monitor", leaked: true },
    })

    const response = await POST(
      request(bodyFor("ai_device_quota_lookup", { p_thiet_bi_id: 1 })) as never
    )
    expect(response.status).toBe(502)
    expect((await response.json()).error.code).toBe("result_too_large")
  })

  it("rejects a valid result envelope that exceeds the 64 KiB response cap", async () => {
    callServerRpcMock.mockResolvedValue({
      data: [{ id: 1, ten_thiet_bi: "x".repeat(70 * 1024) }],
      total: 1,
      limit: 1,
      appliedFilters: {},
    })

    const response = await POST(request(bodyFor("ai_equipment_lookup")) as never)
    expect(response.status).toBe(502)
    expect((await response.json()).error.code).toBe("result_too_large")
  })

  it("maps downstream cancellation to 499 and does not start cleanup work", async () => {
    const controller = new AbortController()
    const pending = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener("abort", () => {
        const error = new Error("aborted")
        error.name = "AbortError"
        reject(error)
      })
    })
    pending.catch(() => undefined)
    callServerRpcMock.mockReturnValue(pending)
    const responsePromise = POST(
      new Request("http://localhost/api/internal/ai/broker/v1", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${brokerToken()}`,
          "Content-Type": "application/json",
          "X-Request-ID": REQUEST_ID,
        },
        body: JSON.stringify(bodyFor("ai_equipment_lookup")),
      }) as never
    )
    controller.abort()
    const response = await responsePromise
    expect(response.status).toBe(499)
    expect((await response.json()).error.code).toBe("cancelled")
  })

  it("maps cancellation while reading the request body to 499", async () => {
    const controller = new AbortController()
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(new TextEncoder().encode("{"))
      },
    })
    const headers = new Headers({
      Authorization: `Bearer ${brokerToken()}`,
      "Content-Type": "application/json",
      "X-Request-ID": REQUEST_ID,
    })
    const requestWithStreamingBody = new Request("http://localhost/api/internal/ai/broker/v1", {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      duplex: "half",
    } as RequestInit & { duplex: "half" })

    const responsePromise = POST(requestWithStreamingBody)
    await Promise.resolve()
    controller.abort()
    const response = await responsePromise

    expect(response.status).toBe(499)
    expect((await response.json()).error.code).toBe("cancelled")
    expect(callServerRpcMock).not.toHaveBeenCalled()
  })
})
