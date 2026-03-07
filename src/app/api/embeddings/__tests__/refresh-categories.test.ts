/**
 * Tests for POST /api/embeddings/refresh-categories
 *
 * Verifies auth guard, role guard, tenant isolation,
 * input validation, DB fetch + Edge Function call + update flow.
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

const WRITE_SESSION = { user: { id: "1", role: "to_qltb", don_vi: "17" } }
const ADMIN_SESSION = { user: { id: "2", role: "admin", don_vi: "17" } }
const ADMIN_NO_TENANT_SESSION = { user: { id: "2b", role: "admin", don_vi: null } }
const GLOBAL_SESSION = { user: { id: "3", role: "global", don_vi: null } }
const VIEWER_SESSION = { user: { id: "4", role: "viewer", don_vi: "17" } }
const OTHER_TENANT_SESSION = { user: { id: "5", role: "to_qltb", don_vi: "99" } }

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
  // --- Auth guard ---
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

  // --- Role guard ---
  test("returns 403 when user has viewer role", async () => {
    getServerSessionMock.mockResolvedValue(VIEWER_SESSION)

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({ category_ids: [1] }))
    expect(response.status).toBe(403)

    const body = await response.json()
    expect(body.error).toContain("Forbidden")
  })

  test("allows to_qltb role", async () => {
    getServerSessionMock.mockResolvedValue(WRITE_SESSION)
    inMock.mockResolvedValue({ data: [], error: null })

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({ category_ids: [1] }))
    expect(response.status).toBe(200)
  })

  test("allows admin role", async () => {
    getServerSessionMock.mockResolvedValue(ADMIN_SESSION)
    inMock.mockResolvedValue({ data: [], error: null })

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({ category_ids: [1] }))
    expect(response.status).toBe(200)
  })

  test("allows global role", async () => {
    getServerSessionMock.mockResolvedValue(GLOBAL_SESSION)
    inMock.mockResolvedValue({ data: [], error: null })

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({ category_ids: [1] }))
    expect(response.status).toBe(200)
  })

  // --- Tenant isolation ---
  test("filters out categories not belonging to non-global user tenant", async () => {
    getServerSessionMock.mockResolvedValue(OTHER_TENANT_SESSION)

    // DB returns categories for don_vi=17, but user is don_vi=99
    inMock.mockResolvedValue({
      data: [
        { id: 42, ten_nhom: "Máy thở", don_vi_id: 17 },
      ],
      error: null,
    })

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({ category_ids: [42] }))
    expect(response.status).toBe(200)

    const body = await response.json()
    // Category belongs to tenant 17 but user is tenant 99 → filtered out
    expect(body.refreshed).toBe(0)
  })

  test("admin with don_vi=null refreshes ALL categories (admin is alias for global)", async () => {
    getServerSessionMock.mockResolvedValue(ADMIN_NO_TENANT_SESSION)

    // DB returns categories across multiple tenants
    inMock.mockResolvedValue({
      data: [
        { id: 42, ten_nhom: "Máy thở", don_vi_id: 17 },
        { id: 99, ten_nhom: "Bơm tiêm điện", don_vi_id: 23 },
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
    // admin should see ALL categories regardless of don_vi
    expect(body.refreshed).toBe(2)
    expect(body.failed).toBe(0)
  })

  test("global with don_vi=null refreshes ALL categories", async () => {
    getServerSessionMock.mockResolvedValue(GLOBAL_SESSION)

    inMock.mockResolvedValue({
      data: [
        { id: 42, ten_nhom: "Máy thở", don_vi_id: 17 },
        { id: 99, ten_nhom: "Bơm tiêm điện", don_vi_id: 23 },
      ],
      error: null,
    })

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ embeddings: [[0.1, 0.2], [0.3, 0.4]] }),
        { status: 200 }
      )
    )

    eqMock.mockResolvedValue({ error: null })

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({ category_ids: [42, 99] }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.refreshed).toBe(2)
    expect(body.failed).toBe(0)
  })

  // --- Input validation ---
  test("returns 400 when category_ids is empty", async () => {
    getServerSessionMock.mockResolvedValue(WRITE_SESSION)

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({ category_ids: [] }))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain("non-empty")
  })

  test("returns 400 when category_ids is missing", async () => {
    getServerSessionMock.mockResolvedValue(WRITE_SESSION)

    const { POST } = await import(
      "@/app/api/embeddings/refresh-categories/route"
    )

    const response = await POST(createRequest({}))
    expect(response.status).toBe(400)
  })

  // --- Full flow ---
  test("fetches categories and calls Edge Function then updates DB", async () => {
    getServerSessionMock.mockResolvedValue(WRITE_SESSION)

    // DB returns categories matching user's tenant
    inMock.mockResolvedValue({
      data: [
        { id: 42, ten_nhom: "Máy thở", don_vi_id: 17 },
        { id: 99, ten_nhom: "Bơm tiêm điện", don_vi_id: 17 },
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
    getServerSessionMock.mockResolvedValue(WRITE_SESSION)

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
    getServerSessionMock.mockResolvedValue(WRITE_SESSION)

    inMock.mockResolvedValue({
      data: [{ id: 42, ten_nhom: "Máy thở", don_vi_id: 17 }],
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
