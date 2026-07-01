import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const getServerSessionMock = vi.fn()
const jwtSignMock = vi.fn()
const fetchMock = vi.fn()
const INTERNAL_RPC_SECRET = "test-internal-rpc-secret"

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: (...args: unknown[]) => jwtSignMock(...args),
  },
}))

import { POST } from "@/app/api/rpc/[fn]/route"
import { hashZbsInternalRpcBody, signZbsInternalRpc } from "@/lib/zbs/internal-rpc-signature"

function buildRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const encodedBody = JSON.stringify(body)
  return new Request("https://app.example.com/api/rpc/ai_equipment_lookup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(encodedBody)),
      host: "app.example.com",
      ...headers,
    },
    body: encodedBody,
  })
}

function signedInternalCronHeaders(
  fn: string,
  body: Record<string, unknown>,
  secret = INTERNAL_RPC_SECRET
) {
  const timestamp = String(Date.now())
  const bodySha256 = hashZbsInternalRpcBody(JSON.stringify(body))
  return {
    authorization: "Bearer cron-secret",
    "x-qltbyt-internal-rpc": "zbs-dispatch",
    "x-qltbyt-internal-rpc-body-sha256": bodySha256,
    "x-qltbyt-internal-rpc-signature": signZbsInternalRpc(secret, fn, timestamp, bodySha256),
    "x-qltbyt-internal-rpc-timestamp": timestamp,
  }
}

describe("RPC proxy same-origin guard", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-secret")
    vi.stubEnv("ZBS_INTERNAL_RPC_SECRET", INTERNAL_RPC_SECRET)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
    vi.stubEnv("CRON_SECRET", "cron-secret")

    getServerSessionMock.mockReset()
    jwtSignMock.mockReset()
    fetchMock.mockReset()

    vi.stubGlobal("fetch", fetchMock)

    getServerSessionMock.mockResolvedValue({
      user: {
        id: "31",
        role: "to_qltb",
        don_vi: 17,
        dia_ban_id: 10,
        khoa_phong: "ICU",
      },
    })

    jwtSignMock.mockReturnValue("signed-jwt")
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("rejects cross-origin POSTs before session or RPC forwarding", async () => {
    const res = await POST(
      buildRequest(
        { query: "SpO2" },
        {
          origin: "https://evil.example.com",
        }
      ) as never,
      { params: Promise.resolve({ fn: "ai_equipment_lookup" }) }
    )

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      error: "Cross-origin request rejected",
    })
    expect(getServerSessionMock).not.toHaveBeenCalled()
    expect(jwtSignMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("allows missing-origin POSTs through the existing RPC flow", async () => {
    const res = await POST(buildRequest({ query: "SpO2" }) as never, {
      params: Promise.resolve({ fn: "ai_equipment_lookup" }),
    })

    expect(res.status).toBe(200)
    expect(getServerSessionMock).toHaveBeenCalledOnce()
    expect(jwtSignMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("allows same-origin POSTs through the existing RPC flow", async () => {
    const res = await POST(
      buildRequest(
        { query: "SpO2" },
        {
          origin: "https://app.example.com",
        }
      ) as never,
      { params: Promise.resolve({ fn: "ai_equipment_lookup" }) }
    )

    expect(res.status).toBe(200)
    expect(getServerSessionMock).toHaveBeenCalledOnce()
    expect(jwtSignMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("rejects malformed session claim values before JWT minting", async () => {
    getServerSessionMock.mockResolvedValueOnce({
      user: {
        id: { value: "31" },
        role: "to_qltb",
        don_vi: 17,
        dia_ban_id: 10,
        khoa_phong: "ICU",
      },
    })

    const res = await POST(buildRequest({ query: "SpO2" }) as never, {
      params: Promise.resolve({ fn: "ai_equipment_lookup" }),
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: "Invalid session claims",
    })
    expect(jwtSignMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects missing required session claims before JWT minting", async () => {
    getServerSessionMock.mockResolvedValueOnce({
      user: {
        role: "to_qltb",
        don_vi: 17,
        dia_ban_id: 10,
        khoa_phong: "ICU",
      },
    })

    const res = await POST(buildRequest({ query: "SpO2" }) as never, {
      params: Promise.resolve({ fn: "ai_equipment_lookup" }),
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: "Invalid session claims",
    })
    expect(jwtSignMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects service-role RPCs before JWT minting for non-maintenance roles", async () => {
    getServerSessionMock.mockResolvedValueOnce({
      user: {
        id: "31",
        role: "user",
        don_vi: 17,
        dia_ban_id: 10,
        khoa_phong: "ICU",
      },
    })

    const res = await POST(buildRequest({ p_limit: 10 }) as never, {
      params: Promise.resolve({ fn: "zbs_notification_outbox_pending_for_dispatch" }),
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      error: "Service-role RPC not allowed",
    })
    expect(jwtSignMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("allows internal cron calls for ZBS service-role RPCs without a NextAuth session", async () => {
    getServerSessionMock.mockResolvedValueOnce(null)
    const body = { p_limit: 10 }

    const res = await POST(
      buildRequest(body, {
        ...signedInternalCronHeaders("zbs_notification_outbox_claim_for_dispatch", body),
        origin: "https://app.example.com",
      }) as never,
      { params: Promise.resolve({ fn: "zbs_notification_outbox_claim_for_dispatch" }) }
    )

    expect(res.status).toBe(200)
    expect(getServerSessionMock).not.toHaveBeenCalled()
    expect(jwtSignMock).toHaveBeenCalledOnce()
    expect(jwtSignMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        role: "service_role",
        app_role: "to_qltb",
        user_id: "zbs-dispatch-cron",
      })
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/rpc/zbs_notification_outbox_claim_for_dispatch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ p_limit: 10 }),
      })
    )
  })

  it("rejects internal cron ZBS RPCs signed with the Supabase JWT secret fallback", async () => {
    delete process.env.ZBS_INTERNAL_RPC_SECRET
    const body = { p_limit: 10 }

    const res = await POST(
      buildRequest(body, {
        ...signedInternalCronHeaders(
          "zbs_notification_outbox_claim_for_dispatch",
          body,
          "test-secret"
        ),
        origin: "https://app.example.com",
      }) as never,
      { params: Promise.resolve({ fn: "zbs_notification_outbox_claim_for_dispatch" }) }
    )

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Cron-only RPC not allowed" })
    expect(getServerSessionMock).not.toHaveBeenCalled()
    expect(jwtSignMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects internal cron ZBS RPCs when the signed body hash does not match the request", async () => {
    const signedBody = { p_limit: 10 }

    const res = await POST(
      buildRequest(
        { p_limit: 25 },
        {
          ...signedInternalCronHeaders("zbs_notification_outbox_claim_for_dispatch", signedBody),
          origin: "https://app.example.com",
        }
      ) as never,
      { params: Promise.resolve({ fn: "zbs_notification_outbox_claim_for_dispatch" }) }
    )

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Cron-only RPC not allowed" })
    expect(getServerSessionMock).not.toHaveBeenCalled()
    expect(jwtSignMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not treat the cron bearer as a session bypass for non-ZBS RPCs", async () => {
    getServerSessionMock.mockResolvedValueOnce(null)

    const res = await POST(
      buildRequest(
        { query: "SpO2" },
        {
          authorization: "Bearer cron-secret",
          "x-qltbyt-internal-rpc": "zbs-dispatch",
          origin: "https://app.example.com",
        }
      ) as never,
      { params: Promise.resolve({ fn: "ai_equipment_lookup" }) }
    )

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      error: "Unauthorized",
    })
    expect(jwtSignMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns a generic response for unexpected RPC proxy failures", async () => {
    jwtSignMock.mockImplementationOnce(() => {
      throw new Error("JWT secret internal detail")
    })

    const res = await POST(buildRequest({ query: "SpO2" }) as never, {
      params: Promise.resolve({ fn: "ai_equipment_lookup" }),
    })

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: "RPC proxy error",
    })
  })

  it("preserves upstream 4xx RPC errors for client-side validation handling", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Validation failed" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    )

    const res = await POST(buildRequest({ query: "" }) as never, {
      params: Promise.resolve({ fn: "ai_equipment_lookup" }),
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: {
        message: "Validation failed",
      },
    })
  })

  it("sanitizes upstream 5xx RPC errors before returning them to clients", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "database host internal detail" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    )

    const res = await POST(buildRequest({ query: "SpO2" }) as never, {
      params: Promise.resolve({ fn: "ai_equipment_lookup" }),
    })

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: "RPC upstream error",
    })
  })
})
