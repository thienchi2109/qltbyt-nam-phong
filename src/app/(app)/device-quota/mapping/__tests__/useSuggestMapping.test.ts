import { describe, test, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
const callRpcMock = vi.fn()
vi.mock("@/lib/rpc-client", () => ({
  callRpc: (...args: unknown[]) => callRpcMock(...args),
}))
const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)
import { useSuggestMapping } from "../_hooks/useSuggestMapping"
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const PREVIEW_RESULT = {
  groups: [
    {
      nhom_id: 10,
      nhom_label: "Máy thở chức năng cao",
      nhom_code: "A.01",
      phan_loai: "Loại B",
      rrf_score: 0.95,
      device_names: ["Máy thở"],
      device_ids: [1, 2, 3],
      device_name_to_ids: { "Máy thở": [1, 2, 3] },
    },
    {
      nhom_id: 20,
      nhom_label: "Bơm tiêm điện tự động",
      nhom_code: "B.02",
      phan_loai: "Loại C",
      rrf_score: 0.88,
      device_names: ["Bơm tiêm điện"],
      device_ids: [4, 5],
      device_name_to_ids: { "Bơm tiêm điện": [4, 5] },
    },
  ],
  unmatched: [{ device_name: "Máy X-quang", device_ids: [6] }],
  totalDevices: 6,
  matchedDevices: 5,
}

function setupSuccessfulPipeline(result = PREVIEW_RESULT) {
  fetchMock
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          job: {
            id: "job-1",
            processedUniqueNames: 0,
            status: "queued",
            totalUniqueNames: 3,
          },
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          job: {
            id: "job-1",
            processedUniqueNames: 3,
            result,
            status: "succeeded",
            totalUniqueNames: 3,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
}

describe("useSuggestMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  test("stays idle when not enabled", () => {
    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: false }),
      { wrapper: createWrapper() }
    )

    expect(result.current.status).toBe("idle")
    expect(result.current.result).toBeNull()
    expect(callRpcMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("stays idle when donViId is null", () => {
    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: null, enabled: true }),
      { wrapper: createWrapper() }
    )

    expect(result.current.status).toBe("idle")
    expect(callRpcMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("uses async jobs even when the old opt-out env is false", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEVICE_QUOTA_SUGGESTION_ASYNC_JOBS", "false")
    setupSuccessfulPipeline()

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/device-quota/mapping/suggest/jobs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ donViId: 1 }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/device-quota/mapping/suggest/jobs/job-1/process",
      expect.objectContaining({ method: "POST" }),
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

    const group1 = res.groups.find(g => g.nhom_id === 10)!
    expect(group1.nhom_label).toBe("Máy thở chức năng cao")
    expect(group1.nhom_code).toBe("A.01")
    expect(group1.device_ids).toEqual([1, 2, 3])

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

  test("sets error status on network error", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })

    expect(result.current.error).toBe("Network error")
  })

  test("sets error status on server-side job failure", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            job: {
              id: "job-1",
              processedUniqueNames: 0,
              status: "queued",
              totalUniqueNames: 3,
            },
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Preview failed", requestId: "req-err" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      )

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("error")
    })

    expect(result.current.error).toBe("Preview failed")
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

  test("passes the server-side job result through unchanged", async () => {
    const serverResult = {
      groups: [
        {
          nhom_id: 10,
          nhom_label: "Máy thở chức năng cao",
          nhom_code: "A.01",
          phan_loai: null,
          rrf_score: 0.95,
          device_names: ["Máy thở", "Bơm tiêm điện"],
          device_ids: [1, 2, 3, 4, 5],
          device_name_to_ids: {
            "Máy thở": [1, 2, 3],
            "Bơm tiêm điện": [4, 5],
          },
        },
      ],
      unmatched: [{ device_name: "Máy X-quang", device_ids: [6] }],
      totalDevices: 6,
      matchedDevices: 5,
    }
    setupSuccessfulPipeline(serverResult)

    const { result } = renderHook(() =>
      useSuggestMapping({ donViId: 1, enabled: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })

    const res = result.current.result!
    expect(res).toEqual(serverResult)
  })

  test("auto-resets to idle when enabled becomes false after pipeline started", async () => {
    setupSuccessfulPipeline()

    const wrapper = createWrapper()
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useSuggestMapping({ donViId: 1, enabled }),
      { initialProps: { enabled: true }, wrapper }
    )

    await waitFor(() => {
      expect(result.current.status).toBe("done")
    })
    expect(result.current.result).not.toBeNull()

    rerender({ enabled: false })

    expect(result.current.status).toBe("idle")
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.progress).toBe(0)
  })

  describe("saveBatch", () => {
    const SAVE_RESULT = {
      affected_count: 5,
      skipped_already_assigned: 1,
      skipped_not_found: 0,
      groups: [
        { nhom_id: 10, affected: 3, skipped: 0 },
        { nhom_id: 20, affected: 2, skipped: 1 },
      ],
    }

    test("calls dinh_muc_thiet_bi_link_batch RPC with correct payload", async () => {
      setupSuccessfulPipeline()
      callRpcMock.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === "dinh_muc_thiet_bi_link_batch") return Promise.resolve(SAVE_RESULT)
        return Promise.reject(new Error(`Unknown RPC: ${fn}`))
      })

      const { result } = renderHook(() =>
        useSuggestMapping({ donViId: 42, enabled: true }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => { expect(result.current.status).toBe("done") })

      const mappings = [
        { nhom_id: 10, thiet_bi_ids: [1, 2, 3] },
        { nhom_id: 20, thiet_bi_ids: [4, 5] },
      ]

      await act(async () => {
        result.current.saveBatch(mappings)
      })

      await waitFor(() => {
        expect(result.current.saveStatus).toBe("saved")
      })

      expect(callRpcMock).toHaveBeenCalledWith({
        fn: "dinh_muc_thiet_bi_link_batch",
        args: {
          p_mappings: mappings,
          p_don_vi: 42,
        },
      })
    })

    test("transitions through saving → saved status lifecycle", async () => {
      setupSuccessfulPipeline()

      let resolveSave: (value: unknown) => void
      callRpcMock.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === "dinh_muc_thiet_bi_link_batch") {
          return new Promise((resolve) => { resolveSave = resolve })
        }
        return Promise.reject(new Error(`Unknown RPC: ${fn}`))
      })

      const { result } = renderHook(() =>
        useSuggestMapping({ donViId: 1, enabled: true }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => { expect(result.current.status).toBe("done") })
      expect(result.current.saveStatus).toBe("idle")

      act(() => {
        result.current.saveBatch([{ nhom_id: 10, thiet_bi_ids: [1] }])
      })

      await waitFor(() => {
        expect(result.current.saveStatus).toBe("saving")
      })

      await act(async () => {
        resolveSave!(SAVE_RESULT)
      })

      await waitFor(() => {
        expect(result.current.saveStatus).toBe("saved")
      })
    })

    test("exposes save result with affected and skipped counts", async () => {
      setupSuccessfulPipeline()
      callRpcMock.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === "dinh_muc_thiet_bi_link_batch") return Promise.resolve(SAVE_RESULT)
        return Promise.reject(new Error(`Unknown RPC: ${fn}`))
      })

      const { result } = renderHook(() =>
        useSuggestMapping({ donViId: 1, enabled: true }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => { expect(result.current.status).toBe("done") })

      await act(async () => {
        result.current.saveBatch([{ nhom_id: 10, thiet_bi_ids: [1] }])
      })

      await waitFor(() => {
        expect(result.current.saveStatus).toBe("saved")
      })

      expect(result.current.saveResult).toEqual(SAVE_RESULT)
    })

    test("sets saveError on RPC failure", async () => {
      setupSuccessfulPipeline()
      callRpcMock.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === "dinh_muc_thiet_bi_link_batch") return Promise.reject(new Error("Permission denied"))
        return Promise.reject(new Error(`Unknown RPC: ${fn}`))
      })

      const { result } = renderHook(() =>
        useSuggestMapping({ donViId: 1, enabled: true }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => { expect(result.current.status).toBe("done") })

      await act(async () => {
        result.current.saveBatch([{ nhom_id: 10, thiet_bi_ids: [1] }])
      })

      await waitFor(() => {
        expect(result.current.saveStatus).toBe("save-error")
      })

      expect(result.current.saveError).toBe("Permission denied")
    })
  })
})
