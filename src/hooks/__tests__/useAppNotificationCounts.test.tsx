import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

let consoleErrorSpy: ReturnType<typeof vi.spyOn>

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import { useAppNotificationCounts } from "../useAppNotificationCounts"

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe("useAppNotificationCounts", () => {
  beforeEach(() => {
    mocks.callRpc.mockReset()
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy.mockRestore()
  })

  it("merges header notifications with approved maintenance counts", async () => {
    mocks.callRpc
      .mockResolvedValueOnce({
        pending_repairs: 2,
        pending_transfers: 3,
      })
      .mockResolvedValueOnce({
        "Bản nháp": 5,
        "Đã duyệt": 4,
        "Không duyệt": 1,
      })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const { result } = renderHook(() => useAppNotificationCounts({ enabled: true }), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() =>
      expect(result.current.counts).toEqual({
        repair: 2,
        transfer: 3,
        maintenance: 4,
      })
    )

    const [headerCall, maintenanceCall] = mocks.callRpc.mock.calls.map(([call]) => call)

    expect(headerCall).toEqual(
      expect.objectContaining({
        fn: "header_notifications_summary",
        signal: expect.any(AbortSignal),
      })
    )
    expect(headerCall).not.toHaveProperty("args")
    expect(maintenanceCall).toEqual(
      expect.objectContaining({
        fn: "maintenance_plan_status_counts",
        args: {},
        signal: expect.any(AbortSignal),
      })
    )
    expect(result.current.isLoading).toBe(false)
  })

  it("passes selected facility scope to notification count RPCs", async () => {
    mocks.callRpc
      .mockResolvedValueOnce({
        pending_repairs: 7,
        pending_transfers: 0,
      })
      .mockResolvedValueOnce({
        "Đã duyệt": 1,
      })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const { result } = renderHook(
      () => useAppNotificationCounts({ enabled: true, facilityId: 21 }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() =>
      expect(result.current.counts).toEqual({
        repair: 7,
        transfer: 0,
        maintenance: 1,
      })
    )

    const [headerCall, maintenanceCall] = mocks.callRpc.mock.calls.map(([call]) => call)

    expect(headerCall).toEqual(
      expect.objectContaining({
        fn: "header_notifications_summary",
        args: { p_don_vi: 21 },
        signal: expect.any(AbortSignal),
      })
    )
    expect(maintenanceCall).toEqual(
      expect.objectContaining({
        fn: "maintenance_plan_status_counts",
        args: { p_don_vi: 21 },
        signal: expect.any(AbortSignal),
      })
    )
  })

  it("falls back maintenance to zero when maintenance counts fail", async () => {
    mocks.callRpc
      .mockResolvedValueOnce({
        pending_repairs: 1,
        pending_transfers: 2,
      })
      .mockRejectedValueOnce(new Error("unstable maintenance counts"))

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const { result } = renderHook(() => useAppNotificationCounts({ enabled: true }), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() =>
      expect(result.current.counts).toEqual({
        repair: 1,
        transfer: 2,
        maintenance: 0,
      })
    )

    expect(result.current.isLoading).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Maintenance notification counts error:",
      expect.any(Error)
    )
  })

  it("does not fetch when disabled", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const { result } = renderHook(() => useAppNotificationCounts({ enabled: false }), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mocks.callRpc).not.toHaveBeenCalled()
    expect(result.current.counts).toEqual({
      repair: 0,
      transfer: 0,
      maintenance: 0,
    })
  })

  it("dedupes concurrent consumers through the shared query cache", async () => {
    mocks.callRpc
      .mockResolvedValueOnce({
        pending_repairs: 6,
        pending_transfers: 1,
      })
      .mockResolvedValueOnce({
        "Đã duyệt": 2,
      })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const wrapper = createWrapper(queryClient)
    const firstHook = renderHook(() => useAppNotificationCounts({ enabled: true }), { wrapper })
    const secondHook = renderHook(() => useAppNotificationCounts({ enabled: true }), { wrapper })

    await waitFor(() =>
      expect(firstHook.result.current.counts).toEqual({
        repair: 6,
        transfer: 1,
        maintenance: 2,
      })
    )
    await waitFor(() =>
      expect(secondHook.result.current.counts).toEqual({
        repair: 6,
        transfer: 1,
        maintenance: 2,
      })
    )

    expect(mocks.callRpc).toHaveBeenCalledTimes(2)
  })
})
