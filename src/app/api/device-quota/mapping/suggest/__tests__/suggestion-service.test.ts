import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  assertSuggestionAccess,
  createCatalogSignature,
  lookupAccessibleFacilityIds,
  mergeSuggestionResults,
  runSuggestMapping,
} from "@/app/api/device-quota/mapping/suggest/suggestion-service"

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

const USER = {
  id: "1",
  role: "to_qltb",
  don_vi: "17",
  dia_ban_id: null,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("device quota suggestion service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-secret")
  })

  test("denies restricted roles before provider work", async () => {
    await expect(
      assertSuggestionAccess(
        { id: "1", role: "technician", don_vi: "17", dia_ban_id: null },
        17,
        { lookupAccessibleFacilityIds: vi.fn() }
      )
    ).rejects.toMatchObject({ message: "Forbidden: insufficient role", status: 403 })
  })

  test("denies tenant-scoped users requesting another facility", async () => {
    await expect(
      assertSuggestionAccess(
        { id: "1", role: "to_qltb", don_vi: "17", dia_ban_id: null },
        18,
        { lookupAccessibleFacilityIds: vi.fn() }
      )
    ).rejects.toMatchObject({ message: "Forbidden: facility scope denied", status: 403 })
  })

  test("allows admin through global role normalization", async () => {
    const lookupAccessibleFacilityIds = vi.fn()

    await expect(
      assertSuggestionAccess(
        { id: "1", role: "admin", don_vi: null, dia_ban_id: null },
        18,
        { lookupAccessibleFacilityIds }
      )
    ).resolves.toBeUndefined()

    expect(lookupAccessibleFacilityIds).not.toHaveBeenCalled()
  })

  test("checks regional leader facility scope by region", async () => {
    const lookupAccessibleFacilityIds = vi.fn().mockResolvedValue([7])
    const user = { id: "1", role: "regional_leader", don_vi: null, dia_ban_id: "8" }

    await expect(
      assertSuggestionAccess(
        user,
        18,
        { lookupAccessibleFacilityIds }
      )
    ).rejects.toMatchObject({ message: "Forbidden: facility scope denied", status: 403 })

    expect(lookupAccessibleFacilityIds).toHaveBeenCalledWith(user)
  })

  test("looks up accessible facilities through a signed RPC", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 17, name: "Benh vien A" }]))

    await expect(lookupAccessibleFacilityIds(USER)).resolves.toEqual([17])

    expect(fetchMock).toHaveBeenCalledWith(
      "https://supabase.test/rest/v1/rpc/get_accessible_facilities",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "anon-key",
          Authorization: expect.stringMatching(/^Bearer /),
        }),
        body: "{}",
      })
    )
  })

  test("merges provider search results into the existing preview shape", () => {
    const result = mergeSuggestionResults(
      [
        { ten_thiet_bi: "May tho", device_count: 2, device_ids: [1, 2] },
        { ten_thiet_bi: "Bom tiem", device_count: 1, device_ids: [3] },
      ],
      [
        {
          query_text: "May tho",
          results: [
            {
              id: 10,
              ten_nhom: "May tho chuc nang cao",
              ma_nhom: "A.01",
              phan_loai: "Loai B",
              rrf_score: 0.95,
            },
          ],
        },
        { query_text: "Bom tiem", results: [] },
      ]
    )

    expect(result).toEqual({
      groups: [
        {
          nhom_id: 10,
          nhom_label: "May tho chuc nang cao",
          nhom_code: "A.01",
          phan_loai: "Loai B",
          rrf_score: 0.95,
          device_names: ["May tho"],
          device_ids: [1, 2],
          device_name_to_ids: { "May tho": [1, 2] },
        },
      ],
      unmatched: [{ device_name: "Bom tiem", device_ids: [3] }],
      totalDevices: 3,
      matchedDevices: 2,
    })
  })

  test("creates deterministic catalog signatures", () => {
    const first = createCatalogSignature([
      { id: 2, ma_nhom: "B", ten_nhom: "Beta", phan_loai: null, tu_khoa: ["b"] },
      { id: 1, ma_nhom: "A", ten_nhom: "Alpha", phan_loai: "Loai A", tu_khoa: ["a"] },
    ])
    const second = createCatalogSignature([
      { id: 1, ma_nhom: "A", ten_nhom: "Alpha", phan_loai: "Loai A", tu_khoa: ["a"] },
      { id: 2, ma_nhom: "B", ten_nhom: "Beta", phan_loai: null, tu_khoa: ["b"] },
    ])

    expect(first).toBe(second)
    expect(first).toMatch(/^v1-/)
  })

  test("preserves structured RPC error details", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ message: "RPC policy denied", details: "{\"code\":\"42501\"}" }, 403)
      )
      .mockResolvedValueOnce(jsonResponse([]))

    await expect(
      runSuggestMapping({ donViId: 17, provider: "supabase", user: USER })
    ).rejects.toMatchObject({
      message: "RPC policy denied",
      details: { code: "42501" },
    })
  })

  test("fails before search when embedding response count is incomplete", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          { ten_thiet_bi: "May tho", device_count: 1, device_ids: [1] },
          { ten_thiet_bi: "Bom tiem", device_count: 1, device_ids: [2] },
        ])
      )
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ embeddings: [[0.1, 0.2]] }))
      .mockResolvedValueOnce(jsonResponse([]))

    await expect(
      runSuggestMapping({ donViId: 17, provider: "supabase", user: USER })
    ).rejects.toThrow("Embedding response count mismatch")

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
