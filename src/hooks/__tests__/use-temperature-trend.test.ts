import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchTemperatureTrendPages, sortTemperatureTrendRows } from "@/lib/temperature-trend"
import { useTemperatureTrend } from "@/hooks/use-temperature-trend"
import { useTemperatureWorkspace } from "@/hooks/use-temperature-monitoring"
import { useTemperatureWorkspaceFilters } from "@/hooks/use-temperature-workspace-filters"
import type { TemperatureSlot, TemperatureWorkspace } from "@/types/temperature-monitoring"

const runtime = vi.hoisted(() => ({
  user: { id: 17, role: "to_qltb", don_vi: "D1", khoa_phong: "ICU" },
  callRpc:
    vi.fn<
      (request: {
        fn: string
        args: Record<string, unknown>
        signal?: AbortSignal
      }) => Promise<TemperatureWorkspace>
    >(),
}))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: runtime.user } }) }))
vi.mock("@/lib/rpc-client", () => ({ callRpc: runtime.callRpc }))

const slot = (overrides: Partial<TemperatureSlot>): TemperatureSlot =>
  ({
    equipment_id: 42,
    equipment_code: "FR-42",
    equipment_name: "Tủ lạnh",
    monitoring_date: "2026-10-18",
    shift_id: "shift-1",
    shift_code: "Sáng",
    shift_name: "Ca sáng",
    slot_start: "2026-10-18T01:00:00Z",
    slot_end: "2026-10-18T03:00:00Z",
    display_timezone: "Asia/Ho_Chi_Minh",
    configuration_version_id: "config-1",
    lower_c: 2,
    upper_c: 8,
    recording_method_code: "manual",
    recording_method_name: "Nhập tay",
    status: "Đã ghi",
    reading_id: "reading-1",
    value_c: 5,
    captured_at: "2026-10-18T01:05:00Z",
    created_at: "2026-10-18T01:06:00Z",
    operator_user_id: 17,
    proposal_author_user_id: null,
    revision: 0,
    state: null,
    deviation: null,
    ...overrides,
  }) as TemperatureSlot

const page = (items: TemperatureSlot[], next_cursor: Record<string, unknown> | null) =>
  ({
    items,
    total: 3,
    next_cursor,
    empty_reason: null,
    shift_choices: [],
    server_now: "2026-10-18T00:00:00Z",
    from_date: "2026-10-16",
    to_date: "2026-10-18",
  }) satisfies TemperatureWorkspace

describe("temperature trend workspace rows", () => {
  beforeEach(() => {
    runtime.callRpc.mockReset()
  })

  it("drains 200-row cursor pages and sorts observations by resolved time", async () => {
    const lateReading = slot({
      reading_id: "reading-b",
      captured_at: "2026-10-18T01:30:00Z",
      value_c: 5,
      deviation: { id: "deviation-1", status: "Mở", severity: "high", revision: 1 },
    })
    const earlierEmptySlot = slot({
      reading_id: null,
      value_c: null,
      captured_at: null,
      status: "Chưa ghi",
      slot_start: "2026-10-18T01:15:00Z",
    })
    const tiedReading = slot({
      reading_id: "reading-a",
      captured_at: "2026-10-18T01:30:00Z",
    })
    const fetchPage = vi
      .fn<(args: Record<string, unknown>) => Promise<TemperatureWorkspace>>()
      .mockResolvedValueOnce(page([lateReading], { captured_at: "2026-10-18T01:30:00Z" }))
      .mockResolvedValueOnce(page([tiedReading, earlierEmptySlot], null))

    const rows = await fetchTemperatureTrendPages(fetchPage, {
      p_from_date: "2026-10-16",
      p_to_date: "2026-10-18",
      p_equipment_id: 42,
      p_shift_codes: ["Sáng"],
      p_status: null,
    })

    expect(fetchPage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ p_limit: 200, p_cursor: null }),
      undefined
    )
    expect(fetchPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        p_limit: 200,
        p_cursor: { captured_at: "2026-10-18T01:30:00Z" },
        p_shift_codes: ["Sáng"],
        p_status: null,
      }),
      undefined
    )
    expect(sortTemperatureTrendRows(rows).map((row) => row.reading_id ?? "empty")).toEqual([
      "empty",
      "reading-a",
      "reading-b",
    ])
    expect(rows.find((row) => row.reading_id === "reading-b")).toMatchObject({
      value_c: 5,
      deviation: { id: "deviation-1" },
    })
  })

  it("rejects the full trend when any later cursor page fails", async () => {
    const fetchPage = vi
      .fn<(args: Record<string, unknown>) => Promise<TemperatureWorkspace>>()
      .mockResolvedValueOnce(page([slot({})], { reading_id: "reading-1" }))
      .mockRejectedValueOnce(new Error("page unavailable"))

    await expect(fetchTemperatureTrendPages(fetchPage, { p_equipment_id: 42 })).rejects.toThrow(
      "page unavailable"
    )
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it("passes cancellation to each page and stops before requesting another page", async () => {
    const controller = new AbortController()
    const fetchPage = vi.fn(async (_args: Record<string, unknown>, signal?: AbortSignal) => {
      expect(signal).toBe(controller.signal)
      controller.abort()
      return page([slot({})], { reading_id: "reading-1" })
    })

    await expect(
      fetchTemperatureTrendPages(fetchPage, { p_equipment_id: 42 }, controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it("rejects a cursor that does not advance", async () => {
    const cursor = { reading_id: "same" }
    const fetchPage = vi
      .fn<(args: Record<string, unknown>, signal?: AbortSignal) => Promise<TemperatureWorkspace>>()
      .mockResolvedValueOnce(page([slot({})], cursor))
      .mockResolvedValueOnce(page([slot({})], cursor))

    await expect(fetchTemperatureTrendPages(fetchPage, { p_equipment_id: 42 })).rejects.toThrow(
      /cursor/i
    )
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it("keeps trend cache identity and every filter in the query key", async () => {
    runtime.callRpc.mockResolvedValueOnce(page([slot({})], null))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client, children })

    const { result } = renderHook(
      () =>
        useTemperatureTrend({
          p_equipment_id: 42,
          p_from_date: "2026-10-16",
          p_to_date: "2026-10-18",
          p_shift_codes: ["Sáng"],
          p_status: "Đã ghi",
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(runtime.callRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "temperature_monitoring_workspace_list",
        args: expect.objectContaining({ p_limit: 200, p_cursor: null }),
        signal: expect.any(AbortSignal),
      })
    )
    expect(client.getQueryCache().getAll()[0]?.queryKey).toEqual(
      expect.arrayContaining([
        "temperature-monitoring",
        17,
        "to_qltb",
        "D1",
        "ICU",
        "temperature_monitoring_workspace_list",
        expect.objectContaining({
          p_equipment_id: 42,
          p_limit: 200,
          p_cursor: null,
          p_from_date: "2026-10-16",
          p_to_date: "2026-10-18",
          p_shift_codes: ["Sáng"],
          p_status: "Đã ghi",
        }),
      ])
    )
  })

  it("returns the complete trend only after draining the next RPC page", async () => {
    runtime.callRpc
      .mockResolvedValueOnce(page([slot({ reading_id: "reading-1" })], { reading_id: "reading-1" }))
      .mockResolvedValueOnce(page([slot({ reading_id: "reading-2" })], null))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client, children })

    const { result } = renderHook(
      () =>
        useTemperatureTrend({
          p_equipment_id: 42,
          p_from_date: "2026-10-16",
          p_to_date: "2026-10-18",
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(runtime.callRpc).toHaveBeenCalledTimes(2)
    expect(result.current.data).toHaveLength(2)
  })

  it("keeps the trend array cache separate from the ordinary workspace DTO", async () => {
    runtime.callRpc.mockResolvedValue(page([slot({})], null))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client, children })
    const args = {
      p_equipment_id: 42,
      p_from_date: "2026-10-16",
      p_to_date: "2026-10-18",
      p_limit: 200,
      p_cursor: null,
    }

    const ordinary = renderHook(() => useTemperatureWorkspace(args), { wrapper })
    await waitFor(() => expect(ordinary.result.current.isSuccess).toBe(true))
    const trend = renderHook(() => useTemperatureTrend(args), { wrapper })
    await waitFor(() => expect(trend.result.current.isSuccess).toBe(true))

    expect(Array.isArray(trend.result.current.data)).toBe(true)
    expect(client.getQueryCache().getAll()).toHaveLength(2)
  })

  it("exposes the same server arguments used by the existing workspace filter query", () => {
    runtime.callRpc.mockResolvedValue(page([], null))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client, children })
    const { result } = renderHook(
      () => useTemperatureWorkspaceFilters(new URLSearchParams("date=2026-10-18"), 42, vi.fn()),
      { wrapper }
    )

    expect(result.current.workspaceArgs).toMatchObject({
      p_equipment_id: 42,
      p_from_date: "2026-10-18",
      p_to_date: "2026-10-18",
      p_kind: "readings",
      p_shift_codes: null,
    })
  })

  it("aborts stale equipment loads and never shows their rows in the new scope", async () => {
    let finishOldRequest: ((workspace: TemperatureWorkspace) => void) | undefined
    let oldSignal: AbortSignal | undefined
    runtime.callRpc.mockImplementation(({ args, signal }) => {
      if (args.p_equipment_id === 42) {
        oldSignal = signal
        return new Promise((resolve) => {
          finishOldRequest = resolve
        })
      }
      return Promise.resolve(page([slot({ equipment_id: 43, reading_id: "new-scope" })], null))
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client, children })
    const options = { p_from_date: "2026-10-16", p_to_date: "2026-10-18" }
    const { result, rerender } = renderHook(
      ({ equipment }) => useTemperatureTrend({ ...options, p_equipment_id: equipment }),
      { initialProps: { equipment: 42 }, wrapper }
    )

    await waitFor(() => expect(runtime.callRpc).toHaveBeenCalledTimes(1))
    rerender({ equipment: 43 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(oldSignal?.aborted).toBe(true)
    expect(result.current.data?.map((row) => row.reading_id)).toEqual(["new-scope"])
    finishOldRequest?.(page([slot({ reading_id: "old-scope" })], null))
    expect(result.current.data?.map((row) => row.reading_id)).toEqual(["new-scope"])
  })
})
