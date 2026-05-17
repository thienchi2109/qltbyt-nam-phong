import { describe, expect, test, vi } from "vitest"

import {
  assertSuggestionAccess,
  createCatalogSignature,
  mergeSuggestionResults,
} from "@/app/api/device-quota/mapping/suggest/suggestion-service"

describe("device quota suggestion service", () => {
  test("denies restricted roles before provider work", async () => {
    await expect(
      assertSuggestionAccess(
        { id: "1", role: "technician", don_vi: "17", dia_ban_id: null },
        17,
        { lookupFacilityRegionId: vi.fn() }
      )
    ).rejects.toMatchObject({ message: "Forbidden: insufficient role", status: 403 })
  })

  test("denies tenant-scoped users requesting another facility", async () => {
    await expect(
      assertSuggestionAccess(
        { id: "1", role: "to_qltb", don_vi: "17", dia_ban_id: null },
        18,
        { lookupFacilityRegionId: vi.fn() }
      )
    ).rejects.toMatchObject({ message: "Forbidden: facility scope denied", status: 403 })
  })

  test("allows admin through global role normalization", async () => {
    const lookupFacilityRegionId = vi.fn()

    await expect(
      assertSuggestionAccess(
        { id: "1", role: "admin", don_vi: null, dia_ban_id: null },
        18,
        { lookupFacilityRegionId }
      )
    ).resolves.toBeUndefined()

    expect(lookupFacilityRegionId).not.toHaveBeenCalled()
  })

  test("checks regional leader facility scope by region", async () => {
    const lookupFacilityRegionId = vi.fn().mockResolvedValue(7)

    await expect(
      assertSuggestionAccess(
        { id: "1", role: "regional_leader", don_vi: null, dia_ban_id: "8" },
        18,
        { lookupFacilityRegionId }
      )
    ).rejects.toMatchObject({ message: "Forbidden: facility scope denied", status: 403 })

    expect(lookupFacilityRegionId).toHaveBeenCalledWith(18)
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
})
