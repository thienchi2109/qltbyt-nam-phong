import { beforeEach, describe, expect, test, vi } from "vitest"

const callVmSuggestMock = vi.hoisted(() => vi.fn())
vi.mock("@/app/api/device-quota/mapping/suggest/suggestion-vm-client", () => ({
  callVmSuggest: (...args: unknown[]) => callVmSuggestMock(...args),
}))

import {
  resetSuggestionRuntimeStateForTests,
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  })
}

function queueVmCatalogResponse({
  categories,
  names,
}: {
  categories: unknown[]
  names: unknown[]
}): void {
  fetchMock.mockResolvedValueOnce(jsonResponse(names)).mockResolvedValueOnce(jsonResponse(categories))
}

describe("device quota suggestion guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-secret")
    vi.stubEnv("DEVICE_QUOTA_VM_MAX_PAYLOAD_BYTES", "1000000")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_RESULT_CACHE_TTL_MS", "60000")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_COOLDOWN_MS", "10000")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_RATE_LIMIT_MAX", "3")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_RATE_LIMIT_WINDOW_MS", "60000")
    vi.stubEnv("DEVICE_QUOTA_VM_CIRCUIT_THRESHOLD", "3")
    vi.stubEnv("DEVICE_QUOTA_VM_CIRCUIT_WINDOW_MS", "60000")
    vi.stubEnv("DEVICE_QUOTA_VM_CIRCUIT_OPEN_MS", "60000")
    resetSuggestionRuntimeStateForTests()
    callVmSuggestMock.mockReset()
  })

  test("returns respiratory devices unmatched instead of mapping them to ophthalmology surgery", async () => {
    queueVmCatalogResponse({
      names: [
        {
          ten_thiet_bi: "Máy giúp thở VSMART VFS-510",
          device_count: 1,
          device_ids: [510],
        },
      ],
      categories: [
        {
          id: 91,
          ma_nhom: "EYE.SURGERY",
          ten_nhom: "Máy mổ mắt",
          phan_loai: "Nhãn khoa",
        },
      ],
    })
    callVmSuggestMock.mockResolvedValueOnce({
      requestId: "vm-bad-respiratory",
      suggestions: [
        {
          deviceName: "Máy giúp thở VSMART VFS-510",
          deviceIds: [510],
          candidates: [
            {
              categoryId: 91,
              categoryCode: "EYE.SURGERY",
              categoryName: "Máy mổ mắt",
              classification: "Nhãn khoa",
              score: 0.92,
            },
          ],
        },
      ],
    })

    const result = await runSuggestMapping({ donViId: 17, user: USER })

    expect(result.result.groups).toEqual([])
    expect(result.result.unmatched).toEqual([
      { device_name: "Máy giúp thở VSMART VFS-510", device_ids: [510] },
    ])
  })

  test("returns rehab fitness devices unmatched instead of mapping them to ophthalmology measurement", async () => {
    queueVmCatalogResponse({
      names: [
        {
          ten_thiet_bi: "Thảm tập thể dục",
          device_count: 1,
          device_ids: [711],
        },
      ],
      categories: [
        {
          id: 92,
          ma_nhom: "EYE.PRESSURE",
          ten_nhom: "Bộ đo nhãn áp",
          phan_loai: "Nhãn khoa",
        },
      ],
    })
    callVmSuggestMock.mockResolvedValueOnce({
      requestId: "vm-bad-rehab",
      suggestions: [
        {
          deviceName: "Thảm tập thể dục",
          deviceIds: [711],
          candidates: [
            {
              categoryId: 92,
              categoryCode: "EYE.PRESSURE",
              categoryName: "Bộ đo nhãn áp",
              classification: "Nhãn khoa",
              score: 0.91,
            },
          ],
        },
      ],
    })

    const result = await runSuggestMapping({ donViId: 17, user: USER })

    expect(result.result.groups).toEqual([])
    expect(result.result.unmatched).toEqual([
      { device_name: "Thảm tập thể dục", device_ids: [711] },
    ])
  })
})
