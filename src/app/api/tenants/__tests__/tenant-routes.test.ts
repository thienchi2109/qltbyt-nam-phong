import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const createClientMock = vi.fn()
const jwtSignMock = vi.fn()
const fetchMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock("@/auth/config", () => ({
  authOptions: {},
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}))

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: (...args: unknown[]) => jwtSignMock(...args),
  },
}))

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/tenants", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function createClientForMemberships(rows: Array<{ id: number; name: string; code: string }>) {
  const orderMock = vi.fn().mockResolvedValue({ data: rows, error: null })
  const selectMock = vi.fn(() => ({
    or: vi.fn(() => ({
      order: orderMock,
    })),
  }))

  createClientMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table !== "don_vi") {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select: selectMock,
      }
    }),
  })
}

function createClientForNonGlobalMemberships(
  rows: Array<{
    don_vi:
      | {
          id: number | null
          name: string | null
          code: string | null
        }
      | number
      | null
  }>
) {
  const eqMock = vi.fn().mockResolvedValue({ data: rows, error: null })
  const selectMock = vi.fn(() => ({
    eq: eqMock,
  }))

  createClientMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table !== "user_don_vi_memberships") {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select: selectMock,
      }
    }),
  })

  return {
    eqMock,
    selectMock,
  }
}

describe("tenant routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("returns 401 for tenant switch when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const { POST } = await import("../switch/route")
    const response = await POST(buildRequest({ don_vi: 17 }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ ok: false })
    expect(jwtSignMock).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("maps active tenants for memberships when the user is global", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "1", role: "admin" },
    })
    createClientForMemberships([
      { id: 17, name: "Khoa CNTT", code: "CNTT" },
      { id: 18, name: "Khoa Y", code: "Y" },
    ])

    const { GET } = await import("../memberships/route")
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      memberships: [
        { don_vi: 17, name: "Khoa CNTT", code: "CNTT" },
        { don_vi: 18, name: "Khoa Y", code: "Y" },
      ],
    })
    expect(createClientMock).toHaveBeenCalledWith("https://test.supabase.co", "test-anon-key")
  })

  it("maps memberships for a non-global user when Supabase returns embedded tenant rows", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "7", role: "to_qltb" },
    })
    const { eqMock, selectMock } = createClientForNonGlobalMemberships([
      { don_vi: { id: 17, name: "Khoa CNTT", code: "CNTT" } },
      { don_vi: { id: 18, name: null, code: null } },
    ])

    const { GET } = await import("../memberships/route")
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      memberships: [
        { don_vi: 17, name: "Khoa CNTT", code: "CNTT" },
        { don_vi: 18, name: "", code: "" },
      ],
    })
    expect(selectMock).toHaveBeenCalledWith("don_vi, don_vi:don_vi(id, name, code)")
    expect(eqMock).toHaveBeenCalledWith("user_id", "7")
  })

  it("maps memberships for a non-global user when Supabase returns scalar tenant ids", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "7", role: "technician" },
    })
    const { eqMock, selectMock } = createClientForNonGlobalMemberships([{ don_vi: 19 }])

    const { GET } = await import("../memberships/route")
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      memberships: [{ don_vi: 19, name: "", code: "" }],
    })
    expect(selectMock).toHaveBeenCalledWith("don_vi, don_vi:don_vi(id, name, code)")
    expect(eqMock).toHaveBeenCalledWith("user_id", "7")
  })

  it("returns an empty memberships list when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)

    const { GET } = await import("../memberships/route")
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ memberships: [] })
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it("switches tenant for an authenticated global admin", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "1", role: "admin" },
    })
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-jwt-secret")
    vi.stubGlobal("fetch", fetchMock)
    jwtSignMock.mockReturnValue("signed-jwt")
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

    const { POST } = await import("../switch/route")
    const response = await POST(buildRequest({ don_vi: 17 }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(jwtSignMock).toHaveBeenCalledWith(
      expect.objectContaining({
        app_role: "global",
        sub: "1",
        user_id: "1",
      }),
      "test-jwt-secret",
      { algorithm: "HS256" }
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "https://test.supabase.co/rest/v1/rpc/user_set_current_don_vi",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer signed-jwt",
          Accept: "application/json",
          apikey: "test-anon-key",
        },
        body: JSON.stringify({
          p_user_id: 1,
          p_don_vi: 17,
        }),
      }
    )
  })
})
