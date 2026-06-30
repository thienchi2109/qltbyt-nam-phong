import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const getServerSessionMock = vi.fn()
const jwtSignMock = vi.fn()
const fetchMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: (...args: unknown[]) => jwtSignMock(...args),
  },
}))

import { POST } from "../[fn]/route"

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

describe("RPC proxy same-origin guard", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-secret")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")

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
