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

import { POST } from "@/app/api/rpc/[fn]/route"

type SessionUser = {
  id: string
  role: string
  don_vi: number | null
  dia_ban_id: number
  khoa_phong: string | null | undefined
}

const DEFAULT_SESSION_USER: SessionUser = {
  id: "31",
  role: "chuyen_gia",
  don_vi: 17,
  dia_ban_id: 10,
  khoa_phong: "ICU",
}

const EXPERT_DENIED_CRON_RPC_FUNCTION_NAMES = [
  "zbs_notification_outbox_claim_for_dispatch",
  "zbs_notification_outbox_mark_sent",
  "zbs_notification_outbox_mark_failed",
  "zbs_oauth_token_state_get",
  "zbs_oauth_token_state_persist_success",
  "zbs_oauth_token_state_record_error",
] as const

function buildRequest(fn: string, body: Record<string, unknown>) {
  const encodedBody = JSON.stringify(body)
  return new Request(`http://localhost/api/rpc/${fn}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(encodedBody)),
    },
    body: encodedBody,
  })
}

function setSessionUser(overrides: Partial<SessionUser> = {}) {
  getServerSessionMock.mockResolvedValue({
    user: {
      ...DEFAULT_SESSION_USER,
      ...overrides,
    },
  })
}

async function invokeRpcProxy(fn: string, body: Record<string, unknown> = {}) {
  return POST(buildRequest(fn, body) as never, {
    params: Promise.resolve({ fn }),
  })
}

function forwardedBody(): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

function signedClaims(): Record<string, unknown> {
  const [claims] = jwtSignMock.mock.calls[0] as [Record<string, unknown>]
  return claims
}

describe("RPC proxy expert boundary", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-secret")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")

    getServerSessionMock.mockReset()
    jwtSignMock.mockReset()
    fetchMock.mockReset()

    vi.stubGlobal("fetch", fetchMock)

    setSessionUser()
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

  it("rejects an expert-denied transport RPC before JWT minting or upstream fetch", async () => {
    const res = await invokeRpcProxy("dinh_muc_quyet_dinh_list", {
      p_don_vi: 999,
      p_dia_ban: 888,
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Function not allowed" })
    expect(jwtSignMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(EXPERT_DENIED_CRON_RPC_FUNCTION_NAMES)(
    'rejects expert access to cron RPC "%s" through the expert boundary',
    async (fn) => {
      const res = await invokeRpcProxy(fn)

      expect(res.status).toBe(403)
      await expect(res.json()).resolves.toEqual({ error: "Function not allowed" })
      expect(getServerSessionMock).toHaveBeenCalledOnce()
      expect(jwtSignMock).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it("preserves caller tenant parameters for an exact expert invoking a module RPC", async () => {
    const res = await invokeRpcProxy("technical_configuration_dossiers_list", {
      p_don_vi: 999,
      p_dia_ban: 888,
    })

    expect(res.status).toBe(200)
    expect(forwardedBody()).toEqual({
      p_don_vi: 999,
      p_dia_ban: 888,
    })
  })

  it("keeps assigned-unit branding scoped through the existing tenant rewrite", async () => {
    const res = await invokeRpcProxy("don_vi_branding_get", {
      p_id: 17,
    })

    expect(res.status).toBe(200)
    expect(forwardedBody()).toEqual({
      p_id: 17,
    })
    expect(signedClaims()).toMatchObject({
      app_role: "chuyen_gia",
      don_vi: "17",
    })
  })

  it("keeps tenant rewriting unchanged for non-experts invoking module RPCs", async () => {
    setSessionUser({ role: "to_qltb" })

    const res = await invokeRpcProxy("technical_configuration_dossiers_list", {
      p_don_vi: 999,
      p_dia_ban: 888,
    })

    expect(res.status).toBe(200)
    expect(forwardedBody()).toEqual({
      p_don_vi: 17,
      p_dia_ban: 10,
    })
  })

  it.each(["change_password", "don_vi_branding_get"])(
    'allows retained expert infrastructure RPC "%s"',
    async (fn) => {
      const res = await invokeRpcProxy(fn)

      expect(res.status).toBe(200)
      expect(jwtSignMock).toHaveBeenCalledOnce()
      expect(fetchMock).toHaveBeenCalledOnce()
    }
  )

  it.each(["global", "admin"])(
    "preserves representative non-module proxy access for %s sessions",
    async (role) => {
      setSessionUser({ role, don_vi: null })

      const res = await invokeRpcProxy("dinh_muc_quyet_dinh_list", {
        p_don_vi: 999,
      })

      expect(res.status).toBe(200)
      expect(signedClaims()).toMatchObject({
        app_role: "global",
        don_vi: null,
      })
      expect(forwardedBody()).toEqual({
        p_don_vi: 999,
      })
    }
  )

  it.each([
    ["null", null],
    ["empty", ""],
    ["absent", undefined],
  ])("accepts an expert %s department and signs it as null", async (_label, khoaPhong) => {
    setSessionUser({ khoa_phong: khoaPhong })

    const res = await invokeRpcProxy("technical_configuration_dossiers_list")

    expect(res.status).toBe(200)
    expect(signedClaims()).toMatchObject({
      app_role: "chuyen_gia",
      khoa_phong: null,
    })
  })

  it("rejects an expert malformed department before JWT minting", async () => {
    getServerSessionMock.mockResolvedValue({
      user: {
        ...DEFAULT_SESSION_USER,
        khoa_phong: { id: "ICU" },
      },
    })

    const res = await invokeRpcProxy("technical_configuration_dossiers_list")

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid session claims" })
    expect(jwtSignMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ["don_vi", { don_vi: " " }],
    ["dia_ban_id", { dia_ban_id: "" }],
    ["user id", { id: " " }],
  ])("rejects an expert with an empty required %s claim", async (_label, overrides) => {
    setSessionUser(overrides)

    const res = await invokeRpcProxy("technical_configuration_dossiers_list")

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid session claims" })
    expect(jwtSignMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects a non-expert null department before JWT minting", async () => {
    setSessionUser({ role: "to_qltb", khoa_phong: null })

    const res = await invokeRpcProxy("equipment_list")

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid session claims" })
    expect(jwtSignMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("preserves non-expert empty department normalization to a null JWT claim", async () => {
    setSessionUser({ role: "to_qltb", khoa_phong: "" })

    const res = await invokeRpcProxy("equipment_list")

    expect(res.status).toBe(200)
    expect(signedClaims()).toMatchObject({
      app_role: "to_qltb",
      khoa_phong: null,
    })
  })
})
