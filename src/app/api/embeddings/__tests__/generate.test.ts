/**
 * Tests for POST /api/embeddings/generate
 *
 * Protected proxy route that generates text embeddings via Edge Function.
 * Verifies auth guard, input validation, and proxy behavior.
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

// Mock fetch for Edge Function calls
const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

// Environment variables
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================
// Test helpers
// ============================================

const AUTHENTICATED_SESSION = { user: { id: "1", role: "to_qltb", don_vi: "17" } }

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/embeddings/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// ============================================
// Tests
// ============================================

describe("POST /api/embeddings/generate", () => {
  // --- Auth guard ---
  test("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)

    const { POST } = await import("@/app/api/embeddings/generate/route")

    const response = await POST(createRequest({ texts: ["test"] }))
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toBe("Unauthorized")
  })

  // --- Role guard ---
  test("returns 403 when user has restricted role", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "1", role: "user", don_vi: "17" },
    })

    const { POST } = await import("@/app/api/embeddings/generate/route")

    const response = await POST(createRequest({ texts: ["test"] }))
    expect(response.status).toBe(403)

    const body = await response.json()
    expect(body.error).toContain("Forbidden")
  })

  test("allows regional_leader role (preview-only access)", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "1", role: "regional_leader", don_vi: null },
    })

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ embeddings: [[0.1]] }), { status: 200 })
    )

    const { POST } = await import("@/app/api/embeddings/generate/route")

    const response = await POST(createRequest({ texts: ["test"] }))
    expect(response.status).toBe(200)
  })

  // --- Input validation ---
  test("returns 400 when texts is missing", async () => {
    getServerSessionMock.mockResolvedValue(AUTHENTICATED_SESSION)

    const { POST } = await import("@/app/api/embeddings/generate/route")

    const response = await POST(createRequest({}))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain("non-empty")
  })

  test("returns 400 when texts is empty array", async () => {
    getServerSessionMock.mockResolvedValue(AUTHENTICATED_SESSION)

    const { POST } = await import("@/app/api/embeddings/generate/route")

    const response = await POST(createRequest({ texts: [] }))
    expect(response.status).toBe(400)
  })

  test("returns 400 when texts exceeds max batch size", async () => {
    getServerSessionMock.mockResolvedValue(AUTHENTICATED_SESSION)

    const { POST } = await import("@/app/api/embeddings/generate/route")

    const oversizedTexts = Array.from({ length: 51 }, (_, i) => `text-${i}`)
    const response = await POST(createRequest({ texts: oversizedTexts }))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain("50")
  })

  // --- Successful proxy ---
  test("proxies texts to Edge Function and returns embeddings", async () => {
    getServerSessionMock.mockResolvedValue(AUTHENTICATED_SESSION)

    const mockEmbeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ embeddings: mockEmbeddings }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )

    const { POST } = await import("@/app/api/embeddings/generate/route")

    const response = await POST(createRequest({ texts: ["Máy thở", "Bơm tiêm điện"] }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.embeddings).toEqual(mockEmbeddings)

    // Verify Edge Function called with correct params
    expect(fetchMock).toHaveBeenCalledWith(
      "https://test.supabase.co/functions/v1/embed-device-name",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ texts: ["Máy thở", "Bơm tiêm điện"] }),
      })
    )

    // Verify service role key is used (not user's JWT)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-service-role-key",
        }),
      })
    )
  })

  // --- Error forwarding ---
  test("returns 502 when Edge Function fails", async () => {
    getServerSessionMock.mockResolvedValue(AUTHENTICATED_SESSION)

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Model not available" }),
        { status: 500 }
      )
    )

    const { POST } = await import("@/app/api/embeddings/generate/route")

    const response = await POST(createRequest({ texts: ["test"] }))
    expect(response.status).toBe(502)

    const body = await response.json()
    expect(body.error).toContain("Edge Function")
  })

  test("returns 500 when env vars are missing", async () => {
    getServerSessionMock.mockResolvedValue(AUTHENTICATED_SESSION)

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")

    const { POST } = await import("@/app/api/embeddings/generate/route")

    const response = await POST(createRequest({ texts: ["test"] }))
    expect(response.status).toBe(500)
  })
})
