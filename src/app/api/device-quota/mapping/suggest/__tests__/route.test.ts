import { beforeEach, describe, expect, test, vi } from "vitest"
import { NextRequest } from "next/server"

const getServerSessionMock = vi.fn()
vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock("@/auth/config", () => ({
  authOptions: {},
}))

const assertSuggestionAccessMock = vi.fn()
const runSuggestMappingMock = vi.fn()

vi.mock("@/app/api/device-quota/mapping/suggest/suggestion-service", () => ({
  assertSuggestionAccess: (...args: unknown[]) => assertSuggestionAccessMock(...args),
  runSuggestMapping: (...args: unknown[]) => runSuggestMappingMock(...args),
  SuggestionRouteError: class SuggestionRouteError extends Error {
    status: number

    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

const consoleInfoMock = vi.spyOn(console, "info").mockImplementation(() => {})
const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {})

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/device-quota/mapping/suggest", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function createRawRequest(body: string): NextRequest {
  return new NextRequest("http://localhost/api/device-quota/mapping/suggest", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  })
}

const SESSION = {
  user: {
    id: "42",
    role: "to_qltb",
    don_vi: "17",
    dia_ban_id: null,
  },
}

const PREVIEW_RESULT = {
  groups: [
    {
      nhom_id: 10,
      nhom_label: "May tho",
      nhom_code: "A.01",
      phan_loai: "Loai B",
      rrf_score: 0.95,
      device_names: ["May tho"],
      device_ids: [1, 2],
      device_name_to_ids: { "May tho": [1, 2] },
    },
  ],
  unmatched: [],
  totalDevices: 2,
  matchedDevices: 2,
}

describe("POST /api/device-quota/mapping/suggest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    getServerSessionMock.mockResolvedValue(SESSION)
    assertSuggestionAccessMock.mockResolvedValue(undefined)
    runSuggestMappingMock.mockResolvedValue({
      result: PREVIEW_RESULT,
      itemCounts: { unassignedNames: 1, unassignedDevices: 2, categories: 3 },
      catalogSignature: "catalog-123",
    })
  })

  test("returns 401 before preview work when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)

    const { POST } = await import("@/app/api/device-quota/mapping/suggest/route")
    const response = await POST(createRequest({ donViId: 17 }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual(
      expect.objectContaining({ error: "Unauthorized", requestId: expect.any(String) })
    )
    expect(assertSuggestionAccessMock).not.toHaveBeenCalled()
    expect(runSuggestMappingMock).not.toHaveBeenCalled()
  })

  test("returns 403 before preview provider work when facility scope is denied", async () => {
    assertSuggestionAccessMock.mockRejectedValue(
      Object.assign(new Error("Forbidden: facility scope denied"), { status: 403 })
    )

    const { POST } = await import("@/app/api/device-quota/mapping/suggest/route")
    const response = await POST(createRequest({ donViId: 18 }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: "Forbidden: facility scope denied",
        requestId: expect.any(String),
      })
    )
    expect(runSuggestMappingMock).not.toHaveBeenCalled()
  })

  test("returns 400 before preview work when donViId is missing", async () => {
    const { POST } = await import("@/app/api/device-quota/mapping/suggest/route")
    const response = await POST(createRequest({}))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: "donViId must be a positive integer",
        requestId: expect.any(String),
      })
    )
    expect(assertSuggestionAccessMock).not.toHaveBeenCalled()
    expect(runSuggestMappingMock).not.toHaveBeenCalled()
  })

  test("returns 400 before preview work when JSON is malformed", async () => {
    const { POST } = await import("@/app/api/device-quota/mapping/suggest/route")
    const response = await POST(createRawRequest("{bad"))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: "Invalid JSON body",
        requestId: expect.any(String),
      })
    )
    expect(assertSuggestionAccessMock).not.toHaveBeenCalled()
    expect(runSuggestMappingMock).not.toHaveBeenCalled()
  })

  test("invokes the Supabase provider once and preserves preview semantics", async () => {
    const { POST } = await import("@/app/api/device-quota/mapping/suggest/route")
    const response = await POST(createRequest({ donViId: 17 }))

    expect(response.status).toBe(200)
    expect(runSuggestMappingMock).toHaveBeenCalledTimes(1)
    expect(runSuggestMappingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        donViId: 17,
        provider: "supabase",
      })
    )

    const body = await response.json()
    expect(body.result).toEqual(PREVIEW_RESULT)
    expect(body.meta).toEqual(
      expect.objectContaining({
        provider: "supabase",
        requestId: expect.any(String),
        catalogSignature: "catalog-123",
        itemCounts: { unassignedNames: 1, unassignedDevices: 2, categories: 3 },
      })
    )
  })

  test("selects the VM provider when explicitly configured", async () => {
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_PROVIDER", "vm")

    const { POST } = await import("@/app/api/device-quota/mapping/suggest/route")
    const response = await POST(createRequest({ donViId: 17 }))

    expect(response.status).toBe(200)
    expect(runSuggestMappingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        donViId: 17,
        provider: "vm",
      })
    )
    expect(await response.json()).toEqual(
      expect.objectContaining({
        meta: expect.objectContaining({
          provider: "vm",
        }),
      })
    )
  })

  test("selects the VM provider for non-canary facilities during all-unit rollout", async () => {
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_PROVIDER", "vm")

    const { POST } = await import("@/app/api/device-quota/mapping/suggest/route")
    const response = await POST(createRequest({ donViId: 21 }))

    expect(response.status).toBe(200)
    expect(runSuggestMappingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        donViId: 21,
        provider: "vm",
      })
    )
    expect(await response.json()).toEqual(
      expect.objectContaining({
        meta: expect.objectContaining({
          provider: "vm",
        }),
      })
    )
  })

  test("uses VM only for canary allow-listed facilities", async () => {
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_PROVIDER", "canary")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_CANARY_DON_VI_IDS", "17,21")

    const { POST } = await import("@/app/api/device-quota/mapping/suggest/route")
    const response = await POST(createRequest({ donViId: 17 }))

    expect(response.status).toBe(200)
    expect(runSuggestMappingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        donViId: 17,
        provider: "vm",
      })
    )
    expect(await response.json()).toEqual(
      expect.objectContaining({
        meta: expect.objectContaining({
          provider: "vm",
        }),
      })
    )
  })

  test("keeps Supabase for canary facilities outside the allow-list", async () => {
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_PROVIDER", "canary")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_CANARY_DON_VI_IDS", "17,21")

    const { POST } = await import("@/app/api/device-quota/mapping/suggest/route")
    const response = await POST(createRequest({ donViId: 18 }))

    expect(response.status).toBe(200)
    expect(runSuggestMappingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        donViId: 18,
        provider: "supabase",
      })
    )
    expect(await response.json()).toEqual(
      expect.objectContaining({
        meta: expect.objectContaining({
          provider: "supabase",
        }),
      })
    )
  })

  test("logs request metadata without secrets on success and failure", async () => {
    const { POST } = await import("@/app/api/device-quota/mapping/suggest/route")
    await POST(createRequest({ donViId: 17 }))

    expect(consoleInfoMock).toHaveBeenCalledWith(
      "[device-quota-suggest]",
      expect.objectContaining({
        requestId: expect.any(String),
        donViId: 17,
        role: "to_qltb",
        provider: "supabase",
        status: "success",
        durationMs: expect.any(Number),
      })
    )

    runSuggestMappingMock.mockRejectedValueOnce(new Error("provider failed"))
    const failedResponse = await POST(createRequest({ donViId: 17 }))
    expect(failedResponse.status).toBe(500)
    expect(await failedResponse.json()).toEqual(
      expect.objectContaining({
        error: "Internal server error",
        requestId: expect.any(String),
      })
    )
    expect(consoleErrorMock).toHaveBeenCalledWith(
      "[device-quota-suggest]",
      expect.objectContaining({
        requestId: expect.any(String),
        donViId: 17,
        role: "to_qltb",
        provider: "supabase",
        status: "error",
        failureReason: "provider failed",
        durationMs: expect.any(Number),
      })
    )
  })

  test("preserves structured details for safe client errors", async () => {
    assertSuggestionAccessMock.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden: facility scope denied"), {
        status: 403,
        details: { reason: "region_mismatch" },
      })
    )

    const { POST } = await import("@/app/api/device-quota/mapping/suggest/route")
    const response = await POST(createRequest({ donViId: 18 }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: "Forbidden: facility scope denied",
        details: { reason: "region_mismatch" },
        requestId: expect.any(String),
      })
    )
  })

  test.each([
    [429, "Suggestion request cooldown is active"],
    [503, "VM suggestion provider circuit is open"],
    [413, "VM suggestion payload is too large"],
  ])("surfaces controlled %s suggestion errors to the client", async (status, message) => {
    runSuggestMappingMock.mockRejectedValueOnce(
      Object.assign(new Error(message), {
        status,
        details: { requestScope: "device-quota-suggest" },
      })
    )

    const { POST } = await import("@/app/api/device-quota/mapping/suggest/route")
    const response = await POST(createRequest({ donViId: 17 }))

    expect(response.status).toBe(status)
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: message,
        requestId: expect.any(String),
        details: { requestScope: "device-quota-suggest" },
      })
    )
  })
})
