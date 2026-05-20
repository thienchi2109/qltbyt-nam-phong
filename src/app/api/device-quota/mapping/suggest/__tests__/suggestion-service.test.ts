import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import fs from "fs"
import path from "path"

const callVmSuggestMock = vi.hoisted(() => vi.fn())
vi.mock("@/app/api/device-quota/mapping/suggest/suggestion-vm-client", () => ({
  callVmSuggest: (...args: unknown[]) => callVmSuggestMock(...args),
}))

import {
  assertSuggestionAccess,
  createCatalogSignature,
  getSuggestionRuntimeStateSizeForTests,
  lookupAccessibleFacilityIds,
  mergeSuggestionResults,
  resetSuggestionRuntimeStateForTests,
  runSuggestMapping,
  SuggestionRouteError,
} from "@/app/api/device-quota/mapping/suggest/suggestion-service"
import { selectSuggestionProvider } from "@/app/api/device-quota/mapping/suggest/suggestion-config"

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

const USER = {
  id: "1",
  role: "to_qltb",
  don_vi: "17",
  dia_ban_id: null,
}

function collectSuggestionSourceFiles(dirPath: string): string[] {
  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "__tests__") return []

    const entryPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) return collectSuggestionSourceFiles(entryPath)
    if (entry.isFile() && /\.[tj]sx?$/.test(entry.name)) return [entryPath]
    return []
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function queueVmCatalogResponses(times = 1): void {
  for (let index = 0; index < times; index += 1) {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([{ ten_thiet_bi: "May tho", device_count: 2, device_ids: [1, 2] }])
      )
      .mockResolvedValueOnce(
        jsonResponse([{ id: 10, ma_nhom: "A.01", ten_nhom: "May tho", phan_loai: null }])
      )
  }
}

function queueVmCatalogResponse({
  names = [{ ten_thiet_bi: "May tho", device_count: 2, device_ids: [1, 2] }],
  categories = [{ id: 10, ma_nhom: "A.01", ten_nhom: "May tho", phan_loai: null }],
}: {
  names?: unknown[]
  categories?: unknown[]
}): void {
  fetchMock.mockResolvedValueOnce(jsonResponse(names)).mockResolvedValueOnce(jsonResponse(categories))
}

function successfulVmResponse() {
  return {
    requestId: "vm-req",
    suggestions: [
      {
        deviceName: "May tho",
        deviceIds: [1, 2],
        candidates: [
          {
            categoryId: 10,
            categoryCode: "A.01",
            categoryName: "May tho",
            classification: null,
            score: 0.91,
          },
        ],
      },
    ],
  }
}

describe("device quota suggestion service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-secret")
    vi.stubEnv("DEVICE_QUOTA_VM_MAX_PAYLOAD_BYTES", "1000000")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_RESULT_CACHE_TTL_MS", "60000")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_RESULT_CACHE_MAX_ENTRIES", "200")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_COOLDOWN_MS", "10000")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_RATE_LIMIT_MAX", "3")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_RATE_LIMIT_WINDOW_MS", "60000")
    vi.stubEnv("DEVICE_QUOTA_VM_CIRCUIT_THRESHOLD", "3")
    vi.stubEnv("DEVICE_QUOTA_VM_CIRCUIT_WINDOW_MS", "60000")
    vi.stubEnv("DEVICE_QUOTA_VM_CIRCUIT_OPEN_MS", "60000")
    resetSuggestionRuntimeStateForTests()
    callVmSuggestMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
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

  test("selects VM provider by default so suggestion routing uses 768-dimensional VM embeddings", () => {
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_PROVIDER", "")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_CANARY_DON_VI_IDS", "")

    expect(selectSuggestionProvider(17)).toMatchObject({
      configuredProvider: "vm",
      policy: "default",
    })
  })

  test("does not route canary misses back to the legacy Supabase 384-vector provider", () => {
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_PROVIDER", "canary")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_CANARY_DON_VI_IDS", "18")

    expect(selectSuggestionProvider(17)).toMatchObject({
      configuredProvider: "canary",
      policy: "canary-vm-default",
    })
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

  test("times out stalled Supabase RPC calls", async () => {
    vi.useFakeTimers()
    vi.stubEnv("SUPABASE_HTTP_TIMEOUT_MS", "5")
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("The operation was aborted")
          error.name = "AbortError"
          reject(error)
        })
      })
    })

    const pending = expect(lookupAccessibleFacilityIds(USER)).rejects.toMatchObject({
      message: "Supabase RPC get_accessible_facilities timed out",
      status: 503,
    })
    await vi.advanceTimersByTimeAsync(5)

    await pending
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

  test("uses a null-prototype device-name map for dynamic device names", () => {
    const result = mergeSuggestionResults(
      [{ ten_thiet_bi: "__proto__", device_count: 1, device_ids: [99] }],
      [
        {
          query_text: "__proto__",
          results: [
            {
              id: 10,
              ten_nhom: "Prototype literal",
              ma_nhom: "A.01",
              phan_loai: null,
              rrf_score: 0.9,
            },
          ],
        },
      ]
    )

    expect(Object.getPrototypeOf(result.groups[0].device_name_to_ids)).toBeNull()
    expect(result.groups[0].device_name_to_ids["__proto__"]).toEqual([99])
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
      runSuggestMapping({ donViId: 17, user: USER })
    ).rejects.toMatchObject({
      message: "RPC policy denied",
      details: { code: "42501" },
    })
  })

  test("bundles minimal VM payload and does not call Supabase embedding or hybrid search", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([{ ten_thiet_bi: "May tho", device_count: 2, device_ids: [1, 2] }])
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 10,
            ma_nhom: "A.01",
            ten_nhom: "May tho chuc nang cao",
            phan_loai: "Loai B",
            tu_khoa: ["icu"],
            parent_id: null,
          },
        ])
      )
    callVmSuggestMock.mockResolvedValueOnce({
      requestId: "vm-req",
      suggestions: [
        {
          deviceName: "May tho",
          deviceIds: [1, 2],
          candidates: [
            {
              categoryId: 10,
              categoryCode: "A.01",
              categoryName: "May tho chuc nang cao",
              classification: "Loai B",
              score: 0.91,
            },
          ],
        },
      ],
    })

    const result = await runSuggestMapping({ donViId: 17, user: USER })

    expect(callVmSuggestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        facilityId: 17,
        deviceNames: [{ name: "May tho", deviceIds: [1, 2] }],
        categories: [
          {
            id: 10,
            code: "A.01",
            name: "May tho chuc nang cao",
            classification: "Loai B",
          },
        ],
        options: expect.objectContaining({ topK: 3 }),
      })
    )
    const payload = callVmSuggestMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(JSON.stringify(payload)).not.toContain("tu_khoa")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("/functions/v1/embed-device-name"),
        expect.stringContaining("hybrid_search_category_batch"),
      ])
    )
    expect(result.result.groups).toEqual([
      expect.objectContaining({
        nhom_id: 10,
        nhom_label: "May tho chuc nang cao",
        device_ids: [1, 2],
      }),
    ])
  })

  test("rejects oversized VM payload before calling the VM service", async () => {
    vi.stubEnv("DEVICE_QUOTA_VM_MAX_PAYLOAD_BYTES", "10")
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([{ ten_thiet_bi: "May tho", device_count: 2, device_ids: [1, 2] }])
      )
      .mockResolvedValueOnce(
        jsonResponse([{ id: 10, ma_nhom: "A.01", ten_nhom: "May tho", phan_loai: null }])
      )

    await expect(
      runSuggestMapping({ donViId: 17, user: USER })
    ).rejects.toMatchObject({
      message: "VM suggestion payload is too large",
      status: 413,
    })

    expect(callVmSuggestMock).not.toHaveBeenCalled()
  })

  test("does not count local VM payload validation failures against the VM circuit", async () => {
    vi.stubEnv("DEVICE_QUOTA_VM_MAX_PAYLOAD_BYTES", "10")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_COOLDOWN_MS", "0")
    vi.stubEnv("DEVICE_QUOTA_VM_CIRCUIT_THRESHOLD", "1")
    queueVmCatalogResponse({})
    queueVmCatalogResponse({})

    await expect(
      runSuggestMapping({ donViId: 17, user: USER })
    ).rejects.toMatchObject({ status: 413 })
    await expect(
      runSuggestMapping({ donViId: 17, user: USER })
    ).rejects.toMatchObject({ status: 413 })

    expect(callVmSuggestMock).not.toHaveBeenCalled()
  })

  test("opens the VM circuit after repeated failures without falling back to Supabase search", async () => {
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_COOLDOWN_MS", "0")
    vi.stubEnv("DEVICE_QUOTA_VM_CIRCUIT_THRESHOLD", "2")
    queueVmCatalogResponses(3)
    callVmSuggestMock.mockRejectedValue(
      new SuggestionRouteError("VM suggestion provider request failed", 503)
    )

    await expect(
      runSuggestMapping({ donViId: 17, user: USER })
    ).rejects.toMatchObject({ status: 503 })
    await expect(
      runSuggestMapping({ donViId: 17, user: USER })
    ).rejects.toMatchObject({ status: 503 })
    await expect(
      runSuggestMapping({ donViId: 17, user: USER })
    ).rejects.toMatchObject({
      message: "VM suggestion provider circuit is open",
      status: 503,
    })

    expect(callVmSuggestMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("/functions/v1/embed-device-name"),
        expect.stringContaining("hybrid_search_category_batch"),
      ])
    )
  })

  test("serves VM result-cache hits before cooldown checks", async () => {
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_COOLDOWN_MS", "60000")
    queueVmCatalogResponses(2)
    callVmSuggestMock.mockResolvedValue(successfulVmResponse())

    const first = await runSuggestMapping({ donViId: 17, user: USER })
    const second = await runSuggestMapping({ donViId: 17, user: USER })

    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(callVmSuggestMock).toHaveBeenCalledTimes(1)
  })

  test("does not serve a VM result-cache hit when unassigned data changes", async () => {
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_COOLDOWN_MS", "60000")
    queueVmCatalogResponse({})
    queueVmCatalogResponse({
      names: [{ ten_thiet_bi: "May tho", device_count: 1, device_ids: [3] }],
    })
    callVmSuggestMock.mockResolvedValue(successfulVmResponse())

    await runSuggestMapping({ donViId: 17, user: USER })
    await runSuggestMapping({ donViId: 17, user: USER })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(callVmSuggestMock).toHaveBeenCalledTimes(2)
  })

  test("returns unmatched devices without calling VM when the category catalog is empty", async () => {
    queueVmCatalogResponse({
      categories: [],
    })

    const result = await runSuggestMapping({ donViId: 17, user: USER })

    expect(callVmSuggestMock).not.toHaveBeenCalled()
    expect(result.result).toEqual({
      groups: [],
      unmatched: [{ device_name: "May tho", device_ids: [1, 2] }],
      totalDevices: 2,
      matchedDevices: 0,
    })
  })

  test("returns cooldown 429 when a VM request is retried too quickly without a cache hit", async () => {
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_COOLDOWN_MS", "60000")
    queueVmCatalogResponses(2)
    callVmSuggestMock.mockRejectedValueOnce(
      new SuggestionRouteError("VM suggestion provider request failed", 503)
    )

    await expect(
      runSuggestMapping({ donViId: 17, user: USER })
    ).rejects.toMatchObject({ status: 503 })
    await expect(
      runSuggestMapping({ donViId: 17, user: USER })
    ).rejects.toMatchObject({
      message: "Suggestion request cooldown is active",
      status: 429,
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(callVmSuggestMock).toHaveBeenCalledTimes(1)
  })

  test("returns burst rate-limit 429 for repeated uncached VM requests", async () => {
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_RESULT_CACHE_TTL_MS", "0")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_COOLDOWN_MS", "0")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_RATE_LIMIT_MAX", "2")
    queueVmCatalogResponses(3)
    callVmSuggestMock.mockResolvedValue(successfulVmResponse())

    await runSuggestMapping({ donViId: 17, user: USER })
    await runSuggestMapping({ donViId: 17, user: USER })
    await expect(
      runSuggestMapping({ donViId: 17, user: USER })
    ).rejects.toMatchObject({
      message: "Suggestion request rate limit exceeded",
      status: 429,
    })

    expect(callVmSuggestMock).toHaveBeenCalledTimes(2)
  })

  test("cleans expired throttle keys during later throttle checks", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-18T00:00:00Z"))
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_RESULT_CACHE_TTL_MS", "0")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_COOLDOWN_MS", "0")
    vi.stubEnv("DEVICE_QUOTA_SUGGESTION_RATE_LIMIT_WINDOW_MS", "1000")
    queueVmCatalogResponse({})
    queueVmCatalogResponse({})
    callVmSuggestMock.mockResolvedValue(successfulVmResponse())

    await runSuggestMapping({ donViId: 17, user: USER })
    expect(getSuggestionRuntimeStateSizeForTests().throttleEntries).toBe(1)

    vi.setSystemTime(new Date("2026-05-18T00:00:02Z"))
    await runSuggestMapping({
      donViId: 18,
      user: { ...USER, id: "2", don_vi: "18" },
    })

    expect(getSuggestionRuntimeStateSizeForTests().throttleEntries).toBe(1)
  })

  test("has no Supabase Edge embedding or hybrid-search suggestion runtime path", () => {
    const suggestSourceDir = path.join(process.cwd(), "src/app/api/device-quota/mapping/suggest")
    const source = collectSuggestionSourceFiles(suggestSourceDir)
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n")

    expect(source).not.toContain("runSupabaseSuggestMapping")
    expect(source).not.toContain("/functions/v1/embed-device-name")
    expect(source).not.toContain("hybrid_search_category_batch")
    expect(source).not.toContain('"supabase" | "vm"')
  })
})
