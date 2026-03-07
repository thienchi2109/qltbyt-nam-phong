/**
 * Tests for useSuggestMapping orchestration hook.
 *
 * Verifies the 3-stage pipeline:
 * 1. Fetch unassigned names via RPC
 * 2. Generate embeddings via /api/embeddings/generate
 * 3. Hybrid search categories via RPC
 * Then merge results into grouped suggestions.
 */
import { describe, test, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// ============================================
// Mocks
// ============================================

const callRpcMock = vi.fn()
vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}))

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

import { useSuggestMapping } from "../_hooks/useSuggestMapping"

// Wrapper with fresh QueryClient per test
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

// ============================================
// Fixtures
// ============================================

const UNASSIGNED_NAMES = [
  { ten_thiet_bi: "Máy thở", device_count: 3, device_ids: [1, 2, 3] },
  { ten_thiet_bi: "Bơm tiêm điện", device_count: 2, device_ids: [4, 5] },
  { ten_thiet_bi: "Máy X-quang", device_count: 1, device_ids: [6] },
]

const EMBEDDINGS = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]

const SEARCH_RESULTS = [
  {
    query_text: "Máy thở",
    results: [{ id: 10, ten_nhom: "Máy thở chức năng cao", ma_nhom: "A.01", phan_loai: "Loại B", rrf_score: 0.95 }],
  },
  {
    query_text: "Bơm tiêm điện",
    results: [{ id: 20, ten_nhom: "Bơm tiêm điện tự động", ma_nhom: "B.02", phan_loai: "Loại C", rrf_score: 0.88 }],
  },
  {
    query_text: "Máy X-quang",
    results: [],  // unmatched
  },
]

function setupSuccessfulPipeline() {
  // Stage 1: unassigned names
  callRpcMock.mockImplementation(({ fn }: { fn: string }) => {
    if (fn === "dinh_muc_thiet_bi_unassigned_names") {
      return Promise.resolve(UNASSIGNED_NAMES)
    }
    if (fn === "hybrid_search_category_batch") {
      return Promise.resolve(SEARCH_RESULTS)
    }
    return Promise.reject(new Error(`Unknown RPC: ${fn}`))
  })

  // Stage 2: embeddings
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({ embeddings: EMBEDDINGS }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  )
}

// ============================================
// Tests
// ============================================

describe("useSuggestMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("stays idle when not enabled", () => {
    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: false }),
      { wrapper: createWrapper() }
    )

    expect(result.current.status).toBe("idle")
    expect(result.current.result).toBeNull()
    expect(callRpcMock).not.toHaveBeenCalled()
  })

  test("stays idle when donViId is null", () => {
    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: null, enabled: true }),
      { wrapper: createWrapper() }
    )

    expect(result.current.status).toBe("idle")
    expect(callRpcMock).not.toHaveBeenCalled()
  })

  test("runs full pipeline when enabled with valid donViId", async () => {
    setupSuccessfulPipeline()

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    // Step 1: called unassigned names RPC
    expect(callRpcMock).toHaveBeenCalledWith(
      expect.objectContaining({ fn: "dinh_muc_thiet_bi_unassigned_names" })
    )

    // Step 2: called embedding proxy
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/embeddings/generate",
      expect.objectContaining({
        method: "POST",
      })
    )

    // Step 3: called hybrid search
    expect(callRpcMock).toHaveBeenCalledWith(
      expect.objectContaining({ fn: "hybrid_search_category_batch" })
    )
  })

  test("merges results into groups by nhom_id", async () => {
    setupSuccessfulPipeline()

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    const res = result.current.result!
    expect(res.groups).toHaveLength(2)

    // First group: "Máy thở" → nhom_id=10
    const group1 = res.groups.find(g => g.nhom_id === 10)!
    expect(group1.nhom_label).toBe("Máy thở chức năng cao")
    expect(group1.nhom_code).toBe("A.01")
    expect(group1.device_ids).toEqual([1, 2, 3])

    // Second group: "Bơm tiêm điện" → nhom_id=20
    const group2 = res.groups.find(g => g.nhom_id === 20)!
    expect(group2.nhom_label).toBe("Bơm tiêm điện tự động")
    expect(group2.device_ids).toEqual([4, 5])
  })

  test("separates unmatched devices", async () => {
    setupSuccessfulPipeline()

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    const res = result.current.result!
    expect(res.unmatched).toHaveLength(1)
    expect(res.unmatched[0].device_name).toBe("Máy X-quang")
    expect(res.unmatched[0].device_ids).toEqual([6])
  })

  test("tracks total and matched device counts", async () => {
    setupSuccessfulPipeline()

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    const res = result.current.result!
    expect(res.totalDevices).toBe(6)
    expect(res.matchedDevices).toBe(5)
  })

  test("sets error status on RPC failure", async () => {
    callRpcMock.mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })

    expect(result.current.error).toBe("Network error")
  })

  test("sets error status on embedding proxy failure", async () => {
    callRpcMock.mockImplementation(({ fn }: { fn: string }) => {
      if (fn === "dinh_muc_thiet_bi_unassigned_names") {
        return Promise.resolve(UNASSIGNED_NAMES)
      }
      return Promise.reject(new Error("Unknown RPC"))
    })

    fetchMock.mockResolvedValue(
      new Response("Internal Server Error", { status: 500 })
    )

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })

    expect(result.current.error).toBeTruthy()
  })

  test("reset clears result and returns to idle", async () => {
    setupSuccessfulPipeline()

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe("idle")
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
  })

  test("groups devices with same nhom_id from different queries", async () => {
    // Two different device names map to the same category
    const duplicateCategoryResults = [
      {
        query_text: "Máy thở",
        results: [{ id: 10, ten_nhom: "Máy thở chức năng cao", ma_nhom: "A.01", phan_loai: null, rrf_score: 0.95 }],
      },
      {
        query_text: "Bơm tiêm điện",
        results: [{ id: 10, ten_nhom: "Máy thở chức năng cao", ma_nhom: "A.01", phan_loai: null, rrf_score: 0.88 }],
      },
      {
        query_text: "Máy X-quang",
        results: [],
      },
    ]

    callRpcMock.mockImplementation(({ fn }: { fn: string }) => {
      if (fn === "dinh_muc_thiet_bi_unassigned_names") {
        return Promise.resolve(UNASSIGNED_NAMES)
      }
      if (fn === "hybrid_search_category_batch") {
        return Promise.resolve(duplicateCategoryResults)
      }
      return Promise.reject(new Error(`Unknown RPC: ${fn}`))
    })

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ embeddings: EMBEDDINGS }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    const res = result.current.result!
    // Should merge into a single group with combined device_ids
    expect(res.groups).toHaveLength(1)
    expect(res.groups[0].device_ids).toEqual([1, 2, 3, 4, 5])
    expect(res.groups[0].device_names).toContain("Máy thở")
    expect(res.groups[0].device_names).toContain("Bơm tiêm điện")
  })

  test("auto-resets to idle when enabled becomes false after pipeline started", async () => {
    setupSuccessfulPipeline()

    const wrapper = createWrapper()
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useSuggestMapping({ donViId: 1, enabled }),
      { initialProps: { enabled: true }, wrapper }
    )

    // Wait for pipeline to complete
    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })
    expect(result.current.result).not.toBeNull()

    // Disable the hook — should auto-reset all state
    rerender({ enabled: false })

    expect(result.current.status).toBe("idle")
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.progress).toBe(0)
  })
})
