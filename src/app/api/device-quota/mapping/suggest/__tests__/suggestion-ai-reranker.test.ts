import { beforeEach, describe, expect, test, vi } from "vitest"

const generateObjectMock = vi.hoisted(() => vi.fn())
const getChatModelMock = vi.hoisted(() => vi.fn())

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}))

vi.mock("@/lib/ai/provider", () => ({
  getChatModel: () => getChatModelMock(),
}))

import { rerankSuggestionResults } from "@/app/api/device-quota/mapping/suggest/suggestion-ai-reranker"
import { toVmRequest } from "@/app/api/device-quota/mapping/suggest/suggestion-vm-provider"
import type {
  CategoryCatalogItem,
  SearchResult,
  UnassignedName,
} from "@/app/api/device-quota/mapping/suggest/suggestion-types"

const names: UnassignedName[] = [
  { ten_thiet_bi: "Máy giúp thở VSMART VFS-510", device_count: 1, device_ids: [510] },
]

const categories: CategoryCatalogItem[] = [
  { id: 10, ma_nhom: "RESP", ten_nhom: "Máy thở", phan_loai: "Hô hấp" },
  { id: 91, ma_nhom: "EYE.SURGERY", ten_nhom: "Máy mổ mắt", phan_loai: "Nhãn khoa" },
]

const vmResults: SearchResult[] = [
  {
    query_text: "Máy giúp thở VSMART VFS-510",
    results: [
      {
        id: 91,
        ma_nhom: "EYE.SURGERY",
        ten_nhom: "Máy mổ mắt",
        phan_loai: "Nhãn khoa",
        rrf_score: 0.92,
      },
      {
        id: 10,
        ma_nhom: "RESP",
        ten_nhom: "Máy thở",
        phan_loai: "Hô hấp",
        rrf_score: 0.87,
      },
    ],
  },
]

describe("suggestion AI reranker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("DEVICE_QUOTA_AI_RERANK_ENABLED", "true")
    vi.stubEnv("DEVICE_QUOTA_AI_RERANK_MIN_CONFIDENCE", "0.72")
    getChatModelMock.mockReturnValue({
      model: "model",
      config: { provider: "test", model: "test-model" },
      keyIndex: 0,
    })
  })

  test("uses a valid high-confidence rerank category", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: { categoryId: 10, confidence: 0.86, reason: "respiratory device" },
    })

    const result = await rerankSuggestionResults({
      categories,
      names,
      requestId: "req-rerank-valid",
      searchResults: vmResults,
    })

    expect(result[0]?.results[0]?.id).toBe(10)
  })

  test("rejects AI category ids that were not returned by VM retrieval", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: { categoryId: 999, confidence: 0.91, reason: "invalid" },
    })

    const result = await rerankSuggestionResults({
      categories,
      names,
      requestId: "req-rerank-invalid-id",
      searchResults: vmResults,
    })

    expect(result[0]?.results).toEqual([])
  })

  test("rejects low-confidence AI reranks", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: { categoryId: 10, confidence: 0.61, reason: "too weak" },
    })

    const result = await rerankSuggestionResults({
      categories,
      names,
      requestId: "req-rerank-low-confidence",
      searchResults: vmResults,
    })

    expect(result[0]?.results).toEqual([])
  })

  test("falls back to non-conflicting VM output when AI rerank fails", async () => {
    generateObjectMock.mockRejectedValueOnce(new Error("model unavailable"))
    const safeResults: SearchResult[] = [
      {
        query_text: "Máy giúp thở VSMART VFS-510",
        results: [
          {
            id: 10,
            ma_nhom: "RESP",
            ten_nhom: "Máy thở",
            phan_loai: "Hô hấp",
            rrf_score: 0.87,
          },
        ],
      },
    ]

    const result = await rerankSuggestionResults({
      categories,
      names,
      requestId: "req-rerank-fallback",
      searchResults: safeResults,
    })

    expect(result).toEqual(safeResults)
  })

  test("increases VM candidate depth only when rerank is enabled", () => {
    vi.stubEnv("DEVICE_QUOTA_AI_RERANK_ENABLED", "false")
    const disabledRequest = toVmRequest({
      catalogSignature: "catalog",
      categories,
      donViId: 17,
      names,
      requestId: "req-disabled-top-k",
    })

    vi.stubEnv("DEVICE_QUOTA_AI_RERANK_ENABLED", "true")
    const enabledRequest = toVmRequest({
      catalogSignature: "catalog",
      categories,
      donViId: 17,
      names,
      requestId: "req-enabled-top-k",
    })

    expect(disabledRequest.options.topK).toBe(3)
    expect(enabledRequest.options.topK).toBe(8)
  })
})
