import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { focusManager, onlineManager } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import type { UsageLog } from "@/types/database"
import { useActiveUsageLogs, useEndUsageSession, useStartUsageSession } from "../use-usage-logs"

const { rpc, toast } = vi.hoisted(() => ({ rpc: vi.fn(), toast: vi.fn() }))
vi.mock("@/lib/rpc-client", () => ({ callRpc: rpc }))
vi.mock("@/hooks/use-toast", () => ({ toast }))

const active = (id = 1): UsageLog => ({
  id,
  thiet_bi_id: id,
  nguoi_su_dung_id: 7,
  trang_thai: "dang_su_dung",
  thoi_gian_bat_dau: "2026-10-28T00:00:00Z",
  created_at: "",
  updated_at: "",
})
const scopeKey = ["usage-logs", "active", 1, "regular"]

function mount() {
  const client = createTestQueryClient()
  const hook = renderHook(
    () => ({
      query: useActiveUsageLogs({ tenantId: 1 }),
      start: useStartUsageSession(),
      end: useEndUsageSession(),
    }),
    { wrapper: createReactQueryWrapper(client) }
  )
  return { client, ...hook }
}

describe("active usage synchronization", () => {
  beforeEach(() => {
    rpc.mockReset()
    toast.mockReset()
    focusManager.setFocused(true)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    focusManager.setFocused(undefined)
    onlineManager.setOnline(true)
  })

  it("loads beyond 200 rows with all nine scoped arguments on every batch", async () => {
    rpc.mockImplementation(({ args }) =>
      Promise.resolve(
        args.p_offset === 0 ? Array.from({ length: 200 }, (_, i) => active(i + 1)) : [active(201)]
      )
    )
    const { result } = mount()
    await waitFor(() => expect(result.current.query.data).toHaveLength(201))
    expect(rpc.mock.calls.map(([call]) => call.args.p_offset)).toEqual([0, 200])
    for (const [call] of rpc.mock.calls)
      expect(call.args).toEqual({
        p_thiet_bi_id: null,
        p_trang_thai: null,
        p_active_only: true,
        p_started_from: null,
        p_started_to: null,
        p_limit: 200,
        p_offset: expect.any(Number),
        p_don_vi: 1,
        p_equipment_dataset: "regular",
      })
  })

  it.each([null, {}, { data: [] }, [null]])(
    "rejects malformed active payload %j",
    async (payload) => {
      rpc.mockResolvedValue(payload)
      const { result } = mount()
      await waitFor(() => expect(result.current.query.isError).toBe(true))
      expect(result.current.query.data).toBeUndefined()
    }
  )

  it("does not publish a partial result if a later batch fails", async () => {
    rpc
      .mockResolvedValueOnce(Array.from({ length: 200 }, (_, i) => active(i + 1)))
      .mockRejectedValueOnce(new Error("page failed"))
    const { result } = mount()
    await waitFor(() => expect(result.current.query.isError).toBe(true))
    expect(result.current.query.data).toBeUndefined()
  })

  it("keeps known busy data after a refetch error", async () => {
    rpc.mockResolvedValue([active()])
    const { result } = mount()
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))
    rpc.mockRejectedValue(new Error("offline"))
    await act(async () => {
      await result.current.query.refetch()
    })
    await waitFor(() => expect(result.current.query.isError).toBe(true))
    expect(result.current.query.data).toEqual([active()])
  })

  it("never borrows data across tenant or dataset while the next scope is loading", async () => {
    rpc.mockResolvedValue([active()])
    const client = createTestQueryClient()
    const { result, rerender } = renderHook(
      ({ tenantId, equipmentDataset }) => useActiveUsageLogs({ tenantId, equipmentDataset }),
      {
        initialProps: { tenantId: 1, equipmentDataset: "regular" as "regular" | "placed" },
        wrapper: createReactQueryWrapper(client),
      }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    rpc.mockImplementation(() => new Promise(() => {}))
    rerender({ tenantId: 2, equipmentDataset: "placed" })
    expect(result.current.data).toBeUndefined()
    expect(result.current.isPending).toBe(true)
    expect(client.getQueryData(scopeKey)).toEqual([active()])
  })

  it("refreshes after a competing start rejection without inserting into unrelated caches", async () => {
    let busy = false
    rpc.mockImplementation(({ fn }) => {
      if (fn === "usage_session_start") {
        busy = true
        return Promise.reject(new Error("Thiết bị đang được sử dụng"))
      }
      return Promise.resolve(busy ? [active()] : [])
    })
    const { result, client } = mount()
    client.setQueryDefaults(["usage-logs", "active", 2, "placed"], { gcTime: Infinity })
    client.setQueryData(["usage-logs", "active", 2, "placed"], [])
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))
    await act(async () => {
      await result.current.start
        .mutateAsync({ thiet_bi_id: 1, nguoi_su_dung_id: 7 })
        .catch(() => {})
    })
    await waitFor(() => expect(result.current.query.data).toEqual([active()]))
    expect(client.getQueryData(["usage-logs", "active", 2, "placed"])).toEqual([])
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Thiết bị đang được sử dụng" })
    )
  })

  it("keeps busy data while end is pending and after server rejection", async () => {
    let rejectEnd: (error: Error) => void = () => {}
    rpc.mockImplementation(({ fn }) =>
      fn === "usage_session_end"
        ? new Promise((_, reject) => {
            rejectEnd = reject
          })
        : Promise.resolve([active()])
    )
    const { result } = mount()
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))
    act(() => result.current.end.mutate({ id: 1 }))
    await waitFor(() => expect(result.current.end.isPending).toBe(true))
    expect(result.current.query.data).toEqual([active()])
    act(() => rejectEnd(new Error("end failed")))
    await waitFor(() => expect(result.current.end.isError).toBe(true))
    expect(result.current.query.data).toEqual([active()])
  })

  it("keeps start pending until confirmed active-cache refresh completes", async () => {
    let resolveRefresh: (logs: UsageLog[]) => void = () => {}
    let started = false
    rpc.mockImplementation(({ fn }) => {
      if (fn === "usage_session_start") {
        started = true
        return Promise.resolve(active())
      }
      return started
        ? new Promise<UsageLog[]>((resolve) => {
            resolveRefresh = resolve
          })
        : Promise.resolve([])
    })
    const { result } = mount()
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))
    act(() => result.current.start.mutate({ thiet_bi_id: 1, nguoi_su_dung_id: 7 }))
    await waitFor(() => expect(started).toBe(true))
    expect(result.current.start.isPending).toBe(true)
    expect(result.current.query.data).toEqual([])
    await act(async () => {
      resolveRefresh([active()])
    })
    await waitFor(() => expect(result.current.start.isSuccess).toBe(true))
    expect(result.current.query.data).toEqual([active()])
  })

  it("does not mark equipment busy before start is confirmed by the server", async () => {
    let resolveStart: (log: UsageLog) => void = () => {}
    let started = false
    rpc.mockImplementation(({ fn }) =>
      fn === "usage_session_start"
        ? new Promise<UsageLog>((resolve) => {
            resolveStart = resolve
          })
        : Promise.resolve(started ? [active()] : [])
    )
    const { result } = mount()
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))
    act(() => result.current.start.mutate({ thiet_bi_id: 1, nguoi_su_dung_id: 7 }))
    await waitFor(() => expect(result.current.start.isPending).toBe(true))
    expect(result.current.query.data).toEqual([])
    await act(async () => {
      started = true
      resolveStart(active())
    })
    await waitFor(() => expect(result.current.start.isSuccess).toBe(true))
    expect(result.current.query.data).toEqual([active()])
  })

  it.each(["start", "end"])(
    "exposes refresh failure after server-confirmed %s without discarding the last snapshot",
    async (action) => {
      let confirmed = false
      const before = action === "end" ? [active()] : []
      rpc.mockImplementation(({ fn }) => {
        if (fn !== "usage_log_list") {
          confirmed = true
          return Promise.resolve(active())
        }
        return confirmed ? Promise.reject(new Error("refresh failed")) : Promise.resolve(before)
      })
      const { result } = mount()
      await waitFor(() => expect(result.current.query.isSuccess).toBe(true))
      await act(async () => {
        if (action === "start")
          await result.current.start.mutateAsync({ thiet_bi_id: 1, nguoi_su_dung_id: 7 })
        else await result.current.end.mutateAsync({ id: 1 })
      })
      await waitFor(() => expect(result.current.query.isError).toBe(true))
      expect(result.current.query.data).toEqual(before)
    }
  )

  it("polls start/end into a second independent client at five seconds, pauses hidden, refetches focus/reconnect", async () => {
    let logs: UsageLog[] = []
    rpc.mockImplementation(({ fn }) => {
      if (fn === "usage_session_start") {
        logs = [active()]
        return Promise.resolve(active())
      }
      if (fn === "usage_session_end") {
        logs = []
        return Promise.resolve({ ...active(), trang_thai: "hoan_thanh" })
      }
      return Promise.resolve(logs)
    })
    vi.useFakeTimers()
    const a = mount(),
      b = mount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(b.client.getQueryData(scopeKey)).toEqual([])
    await act(async () => {
      await a.result.current.start.mutateAsync({ thiet_bi_id: 1, nguoi_su_dung_id: 7 })
    })
    expect(a.client.getQueryData(scopeKey)).toEqual([active()])
    expect(b.client.getQueryData(scopeKey)).toEqual([])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999)
    })
    expect(b.client.getQueryData(scopeKey)).toEqual([])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(b.client.getQueryData(scopeKey)).toEqual([active()])
    await act(async () => {
      await a.result.current.end.mutateAsync({ id: 1 })
    })
    expect(a.client.getQueryData(scopeKey)).toEqual([])
    expect(b.client.getQueryData(scopeKey)).toEqual([active()])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(b.client.getQueryData(scopeKey)).toEqual([])
    focusManager.setFocused(false)
    logs = [active()]
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(b.client.getQueryData(scopeKey)).toEqual([])
    await act(async () => {
      focusManager.setFocused(true)
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(b.client.getQueryData(scopeKey)).toEqual([active()])
    logs = []
    await act(async () => {
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(b.client.getQueryData(scopeKey)).toEqual([])
  })
})
