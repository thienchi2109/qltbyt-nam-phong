import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import { maintenanceKeys } from "../use-cached-maintenance"
import { useMaintenancePlanCounts } from "../useMaintenancePlanCounts"

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe("useMaintenancePlanCounts", () => {
  beforeEach(() => {
    mocks.callRpc.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("calls RPC maintenance_plan_status_counts with facility filter", async () => {
    mocks.callRpc.mockResolvedValueOnce({
      "Bản nháp": 2,
      "Đã duyệt": 3,
      "Không duyệt": 1,
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const { result } = renderHook(() => useMaintenancePlanCounts({ facilityId: 42 }), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() =>
      expect(result.current.counts).toEqual({
        "Bản nháp": 2,
        "Đã duyệt": 3,
        "Không duyệt": 1,
      })
    )

    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "maintenance_plan_status_counts",
      args: {
        p_don_vi: 42,
      },
    })
  })

  it("forwards search filter as p_q arg", async () => {
    mocks.callRpc.mockResolvedValueOnce({
      "Bản nháp": 1,
      "Đã duyệt": 0,
      "Không duyệt": 0,
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    renderHook(
      () =>
        useMaintenancePlanCounts({
          facilityId: 11,
          search: "ngoai tim",
        }),
      {
        wrapper: createWrapper(queryClient),
      }
    )

    await waitFor(() => expect(mocks.callRpc).toHaveBeenCalledTimes(1))

    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "maintenance_plan_status_counts",
      args: {
        p_don_vi: 11,
        p_q: "ngoai tim",
      },
    })
  })

  it("returns typed MaintenancePlanStatusCounts record", async () => {
    mocks.callRpc.mockResolvedValueOnce({
      "Bản nháp": 5,
      "Đã duyệt": 6,
      "Không duyệt": 7,
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const { result } = renderHook(() => useMaintenancePlanCounts(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() =>
      expect(result.current.counts).toEqual({
        "Bản nháp": 5,
        "Đã duyệt": 6,
        "Không duyệt": 7,
      })
    )
  })

  it("returns undefined counts when data is null", async () => {
    mocks.callRpc.mockResolvedValueOnce(null)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const { result } = renderHook(() => useMaintenancePlanCounts(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.counts).toBeUndefined()
  })

  it("disables query when enabled is false", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const { result } = renderHook(() => useMaintenancePlanCounts({ enabled: false }), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mocks.callRpc).not.toHaveBeenCalled()
    expect(result.current.counts).toBeUndefined()
  })

  it("passes staleTime and gcTime for caching", async () => {
    mocks.callRpc.mockResolvedValueOnce({
      "Bản nháp": 0,
      "Đã duyệt": 0,
      "Không duyệt": 0,
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    renderHook(() => useMaintenancePlanCounts({ facilityId: 9, search: "2026" }), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(mocks.callRpc).toHaveBeenCalledTimes(1))

    const query = queryClient.getQueryCache().find({
      queryKey: maintenanceKeys.planStatusCounts({
        facilityId: 9,
        search: "2026",
      }),
    })

    expect(query?.options.staleTime).toBe(30_000)
    expect(query?.options.gcTime).toBe(10 * 60 * 1000)
  })

  it("surfaces RPC failures without crashing", async () => {
    mocks.callRpc.mockRejectedValueOnce(new Error("rpc fail"))

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const { result } = renderHook(() => useMaintenancePlanCounts(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.counts).toBeUndefined()
  })

  it("keeps facility-scoped cache entries isolated", async () => {
    mocks.callRpc
      .mockResolvedValueOnce({
        "Bản nháp": 1,
        "Đã duyệt": 2,
        "Không duyệt": 3,
      })
      .mockResolvedValueOnce({
        "Bản nháp": 4,
        "Đã duyệt": 5,
        "Không duyệt": 6,
      })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const wrapper = createWrapper(queryClient)

    const facilityOne = renderHook(() => useMaintenancePlanCounts({ facilityId: 1 }), {
      wrapper,
    })

    await waitFor(() =>
      expect(facilityOne.result.current.counts).toEqual({
        "Bản nháp": 1,
        "Đã duyệt": 2,
        "Không duyệt": 3,
      })
    )

    const facilityTwo = renderHook(() => useMaintenancePlanCounts({ facilityId: 2 }), {
      wrapper,
    })

    await waitFor(() =>
      expect(facilityTwo.result.current.counts).toEqual({
        "Bản nháp": 4,
        "Đã duyệt": 5,
        "Không duyệt": 6,
      })
    )

    expect(mocks.callRpc).toHaveBeenNthCalledWith(1, {
      fn: "maintenance_plan_status_counts",
      args: { p_don_vi: 1 },
    })
    expect(mocks.callRpc).toHaveBeenNthCalledWith(2, {
      fn: "maintenance_plan_status_counts",
      args: { p_don_vi: 2 },
    })

    const facilityOneQuery = queryClient.getQueryCache().find({
      queryKey: maintenanceKeys.planStatusCounts({ facilityId: 1, search: undefined }),
    })
    const facilityTwoQuery = queryClient.getQueryCache().find({
      queryKey: maintenanceKeys.planStatusCounts({ facilityId: 2, search: undefined }),
    })

    expect(facilityOneQuery?.state.data).toEqual({
      "Bản nháp": 1,
      "Đã duyệt": 2,
      "Không duyệt": 3,
    })
    expect(facilityTwoQuery?.state.data).toEqual({
      "Bản nháp": 4,
      "Đã duyệt": 5,
      "Không duyệt": 6,
    })
  })
})
