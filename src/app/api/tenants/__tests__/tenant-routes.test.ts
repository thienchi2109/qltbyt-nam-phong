import { beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const createClientMock = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock("@/auth/config", () => ({
  authOptions: {},
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
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

function createClientForSwitch() {
  const updateEqMock = vi.fn().mockResolvedValue({ error: null })
  const donViSingleMock = vi.fn().mockResolvedValue({ data: { id: 17, active: true }, error: null })
  const membershipSingleMock = vi.fn().mockResolvedValue({ data: { user_id: "1" }, error: null })

  createClientMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "don_vi") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: donViSingleMock,
            })),
          })),
        }
      }

      if (table === "user_don_vi_memberships") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: membershipSingleMock,
            })),
          })),
        }
      }

      if (table === "nhan_vien") {
        return {
          update: vi.fn(() => ({
            eq: updateEqMock,
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  })
}

describe("tenant routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
  })

  it("returns 401 for tenant switch when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)

    const { POST } = await import("../switch/route")
    const response = await POST(buildRequest({ don_vi: 17 }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ ok: false })
    expect(createClientMock).not.toHaveBeenCalled()
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
    expect(createClientMock).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key",
    )
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
    createClientForSwitch()

    const { POST } = await import("../switch/route")
    const response = await POST(buildRequest({ don_vi: 17 }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(createClientMock).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key",
    )
  })
})
