import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { MaintenanceStats } from "../use-maintenance-stats"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import { useMaintenanceStats } from "../use-maintenance-stats"

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryDelay: 0,
      },
    },
  })
}

const dateRange = {
  from: new Date("2026-01-01T00:00:00.000Z"),
  to: new Date("2026-01-31T00:00:00.000Z"),
}

const stats: MaintenanceStats = {
  repair_summary: {
    total_requests: 12,
    completed: 8,
    pending: 2,
    in_progress: 2,
    total_cost: 125000,
    average_completed_cost: 15625,
    cost_recorded_count: 8,
    cost_missing_count: 0,
  },
  maintenance_summary: {
    total_plans: 4,
    total_tasks: 15,
    completed_tasks: 11,
  },
}

describe("useMaintenanceStats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("surfaces an RPC failure instead of returning zero-valued statistics", async () => {
    const rpcError = new Error("Maintenance statistics unavailable")
    mocks.callRpc.mockRejectedValue(rpcError)

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useMaintenanceStats(dateRange, "ICU", 17, "tenant-a"), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isFetched).toBe(true))

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBe(rpcError)
    expect(result.current.data).toBeUndefined()
  })

  it("returns the RPC statistics unchanged with the existing arguments", async () => {
    mocks.callRpc.mockResolvedValueOnce(stats)

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useMaintenanceStats(dateRange, "ICU", 17, "tenant-a"), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.data).toEqual(stats))

    expect(mocks.callRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "maintenance_stats_for_reports",
        args: {
          p_date_from: "2026-01-01",
          p_date_to: "2026-01-31",
          p_don_vi: 17,
          p_khoa_phong: "ICU",
          p_equipment_dataset: "regular",
        },
      })
    )
  })
})
