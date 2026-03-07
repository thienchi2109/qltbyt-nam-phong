/**
 * Tests for POST /api/embeddings/refresh-categories
 *
 * Verifies auth guard, input validation, DB fetch + Edge Function call + update flow.
 */
import { describe, test, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ============================================
// Mocks
// ============================================

const getServerSessionMock = vi.fn()
vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock("@/auth/config", () => ({
  authOptions: {},
}))

// Supabase mock
const selectMock = vi.fn()
const inMock = vi.fn()
const updateMock = vi.fn()
const eqMock = vi.fn()

const supabaseMock = {
  from: vi.fn(() => ({
    select: selectMock,
    update: updateMock,
  })),
}

// Chain: from().select().in()
selectMock.mockReturnValue({ in: inMock })

// Chain: from().update().eq()
updateMock.mockReturnValue({ eq: eqMock })

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => supabaseMock,
}))

// Mock fetch for Edge Function calls
const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

// Environment variables
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

beforeEach(() => {
  vi.clearAllMocks()

  // Default: chain from().select().in() returns categories
  supabaseMock.from.mockReturnValue({
    select: selectMock,
    update: updateMock,
  })
  selectMock.mockReturnValue({ in: inMock })
  updateMock.mockReturnValue({ eq: eqMock })
})

// ============================================
// Test helpers
// ============================================

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/embeddings/refresh-categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// ============================================
// Tests
// ============================================

describe("POST /api/embeddings/refresh-categories", () => {
  test("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({ category_ids: [1] }))
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toBe("Unauthorized")
  })

  test("returns 400 when category_ids is empty", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } })

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({ category_ids: [] }))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain("non-empty")
  })

  test("returns 400 when category_ids is missing", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } })

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({}))
    expect(response.status).toBe(400)
  })

  test("fetches categories and calls Edge Function then updates DB", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } })

    // DB returns categories
    inMock.mockResolvedValue({
      data: [
        { id: 42, ten_nhom: "Máy thở" },
        { id: 99, ten_nhom: "Bơm tiêm điện" },
      ],
      error: null,
    })

    // Edge Function returns embeddings
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ embeddings: [[0.1, 0.2], [0.3, 0.4]] }),
        { status: 200 }
      )
    )

    // DB update succeeds
    eqMock.mockResolvedValue({ error: null })

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({ category_ids: [42, 99] }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.refreshed).toBe(2)
    expect(body.failed).toBe(0)

    // Verify Edge Function called with correct texts
    expect(fetchMock).toHaveBeenCalledWith(
      "https://test.supabase.co/functions/v1/embed-device-name",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ texts: ["Máy thở", "Bơm tiêm điện"] }),
      })
    )
  })

  test("returns refreshed=0 when no categories found in DB", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } })

    inMock.mockResolvedValue({ data: [], error: null })

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({ category_ids: [999] }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.refreshed).toBe(0)
    expect(body.failed).toBe(0)
  })

  test("counts failed when Edge Function returns non-ok", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } })

    inMock.mockResolvedValue({
      data: [{ id: 42, ten_nhom: "Máy thở" }],
      error: null,
    })

    fetchMock.mockResolvedValue(
      new Response("Internal Server Error", { status: 500 })
    )

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({ category_ids: [42] }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.refreshed).toBe(0)
    expect(body.failed).toBe(1)
  })
})
