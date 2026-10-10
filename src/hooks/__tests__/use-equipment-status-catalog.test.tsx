import * as React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { callRpc } from "@/lib/rpc-client"
import type { EquipmentStatusRow } from "@/lib/equipment-status"
import {
  equipmentStatusCatalogKey,
  useEquipmentStatusCatalog,
} from "@/hooks/use-equipment-status-catalog"

vi.mock("@/lib/rpc-client", () => ({ callRpc: vi.fn() }))
const mockCallRpc = vi.mocked(callRpc)

const activeRow: EquipmentStatusRow = {
  status_value: "Hoạt động",
  display_order: 1,
  is_active: true,
  is_terminal: false,
  requires_end_date: false,
  blocks_operational_actions: false,
  is_liquidation: false,
}
const rows: EquipmentStatusRow[] = [
  { ...activeRow, status_value: "Trạng thái tương lai", display_order: 20 },
  activeRow,
  { ...activeRow, status_value: "Lịch sử", display_order: 8, is_active: false },
]

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("useEquipmentStatusCatalog", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    onlineManager.setOnline(true)
    mockCallRpc.mockReset()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
    })
  })

  afterEach(() => {
    queryClient.clear()
    onlineManager.setOnline(true)
  })

  it("keeps writes disabled while loading, then exposes validated rows and ordered active values", async () => {
    let resolve: (value: EquipmentStatusRow[]) => void = () => {}
    mockCallRpc.mockReturnValue(
      new Promise((done) => {
        resolve = done
      })
    )
    const { result } = renderHook(useEquipmentStatusCatalog, {
      wrapper: createWrapper(queryClient),
    })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.canWrite).toBe(false)
    expect(result.current.activeValues).toEqual([])
    await act(async () => {
      resolve(rows)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockCallRpc).toHaveBeenCalledWith({ fn: "equipment_status_catalog_list", args: {} })
    expect(result.current.data).toEqual(rows)
    expect(result.current.activeValues).toEqual(["Hoạt động", "Trạng thái tương lai"])
    expect(result.current.canWrite).toBe(true)
  })

  it("reports an exhausted RPC error without fallback labels and allows an explicit retry", async () => {
    const failure = new Error("Catalog unavailable")
    mockCallRpc.mockRejectedValue(failure)
    const { result } = renderHook(useEquipmentStatusCatalog, {
      wrapper: createWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(failure)
    expect(result.current.canWrite).toBe(false)
    expect(result.current.activeValues).toEqual([])
    expect(mockCallRpc).toHaveBeenCalledTimes(3)
    mockCallRpc.mockResolvedValue(rows)
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.canWrite).toBe(true))
  })

  it.each([
    ["null payload", null],
    ["object payload", { rows }],
    ["empty label", [{ ...activeRow, status_value: "" }]],
    ["whitespace-only label", [{ ...activeRow, status_value: "   " }]],
    ["duplicate labels", [activeRow, { ...activeRow, display_order: 2 }]],
    ["duplicate display order", [activeRow, { ...activeRow, status_value: "Future" }]],
    ["invalid order", [{ ...activeRow, display_order: "1" }]],
    ["fractional order", [{ ...activeRow, display_order: 1.5 }]],
    ["nonterminal required date", [{ ...activeRow, requires_end_date: true }]],
    ...[
      "is_active",
      "is_terminal",
      "requires_end_date",
      "blocks_operational_actions",
      "is_liquidation",
    ].map((flag) => [`nonboolean ${flag}`, [{ ...activeRow, [flag]: "false" }]]),
  ])("fails closed on %s and retries after the payload is repaired", async (_name, payload) => {
    mockCallRpc.mockResolvedValue(payload)
    const { result } = renderHook(useEquipmentStatusCatalog, {
      wrapper: createWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
    expect(result.current.canWrite).toBe(false)
    expect(result.current.activeValues).toEqual([])
    mockCallRpc.mockResolvedValue(rows)
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.canWrite).toBe(true))
  })

  it("validates metadata without normalizing exact labels", async () => {
    const terminal = {
      ...activeRow,
      status_value: " Thanh lý nội bộ ",
      is_terminal: true,
      requires_end_date: true,
      blocks_operational_actions: true,
      is_liquidation: true,
    }
    mockCallRpc.mockResolvedValue([terminal])
    const { result } = renderHook(useEquipmentStatusCatalog, {
      wrapper: createWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.canWrite).toBe(true))
    expect(result.current.data).toEqual([terminal])
    expect(result.current.activeValues).toEqual([terminal.status_value])
  })

  it.each([
    ["empty catalog", []],
    ["inactive catalog", [{ ...activeRow, is_active: false }]],
  ])("disables writes for an %s", async (_name, payload) => {
    mockCallRpc.mockResolvedValue(payload)
    const { result } = renderHook(useEquipmentStatusCatalog, {
      wrapper: createWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.canWrite).toBe(false)
    expect(result.current.activeValues).toEqual([])
  })

  it("shares one system-wide cache, reuses fresh data, and supports standard invalidation", async () => {
    mockCallRpc.mockResolvedValue(rows)
    const wrapper = createWrapper(queryClient)
    const first = renderHook(useEquipmentStatusCatalog, { wrapper })
    await waitFor(() => expect(first.result.current.canWrite).toBe(true))
    const second = renderHook(useEquipmentStatusCatalog, { wrapper })
    expect(second.result.current.data).toEqual(rows)
    expect(mockCallRpc).toHaveBeenCalledTimes(1)
    const changedRows = [{ ...activeRow, status_value: "New catalog label" }]
    mockCallRpc.mockResolvedValue(changedRows)
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: equipmentStatusCatalogKey })
    })
    await waitFor(() => expect(second.result.current.activeValues).toEqual(["New catalog label"]))
    expect(first.result.current.data).toEqual(changedRows)
    expect(mockCallRpc).toHaveBeenCalledTimes(2)
  })

  it("keeps historical cached data readable but disables writes while refreshing and after a failed refresh", async () => {
    mockCallRpc.mockResolvedValue(rows)
    const { result } = renderHook(useEquipmentStatusCatalog, {
      wrapper: createWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.canWrite).toBe(true))
    let reject: (reason: Error) => void = () => {}
    mockCallRpc.mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail
      })
    )
    let refresh: Promise<unknown>
    act(() => {
      refresh = result.current.refetch()
    })
    await waitFor(() => expect(result.current.isFetching).toBe(true))
    expect(result.current.canWrite).toBe(false)
    expect(result.current.data).toEqual(rows)
    mockCallRpc.mockRejectedValue(new Error("Refresh failed"))
    await act(async () => {
      reject(new Error("Refresh failed"))
      await refresh!
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toEqual(rows)
    expect(result.current.canWrite).toBe(false)
    mockCallRpc.mockResolvedValue(rows)
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => expect(result.current.canWrite).toBe(true))
  })

  it("disables writes when an offline refresh is paused with successful cached data, then resumes online", async () => {
    queryClient.setQueryData(equipmentStatusCatalogKey, rows)
    const refreshedRows = [{ ...activeRow, status_value: "Refreshed catalog" }]
    mockCallRpc.mockResolvedValue(refreshedRows)
    const { result } = renderHook(useEquipmentStatusCatalog, {
      wrapper: createWrapper(queryClient),
    })
    expect(result.current.canWrite).toBe(true)
    act(() => {
      onlineManager.setOnline(false)
      void queryClient.invalidateQueries({ queryKey: equipmentStatusCatalogKey })
    })
    await waitFor(() => expect(result.current.fetchStatus).toBe("paused"))
    expect(result.current.isSuccess).toBe(true)
    expect(result.current.isFetching).toBe(false)
    expect(result.current.isPaused).toBe(true)
    expect(result.current.data).toEqual(rows)
    expect(mockCallRpc).not.toHaveBeenCalled()
    expect(result.current.canWrite).toBe(false)
    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(result.current.data).toEqual(refreshedRows))
    expect(result.current.fetchStatus).toBe("idle")
    expect(result.current.canWrite).toBe(true)
    expect(mockCallRpc).toHaveBeenCalledTimes(1)
  })

  it("does not retain catalog data after the QueryClient cache is cleared", async () => {
    mockCallRpc.mockResolvedValue(rows)
    const wrapper = createWrapper(queryClient)
    const first = renderHook(useEquipmentStatusCatalog, { wrapper })
    await waitFor(() => expect(first.result.current.canWrite).toBe(true))
    first.unmount()
    queryClient.clear()
    mockCallRpc.mockRejectedValue(new Error("Next session cannot fetch catalog"))
    const second = renderHook(useEquipmentStatusCatalog, { wrapper })
    await waitFor(() => expect(second.result.current.isError).toBe(true))
    expect(second.result.current.data).toBeUndefined()
    expect(second.result.current.canWrite).toBe(false)
  })
})
