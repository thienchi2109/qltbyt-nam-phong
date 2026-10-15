import * as React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCallRpc = vi.fn()

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (args: unknown) => mockCallRpc(args),
}))

import {
  useActiveUsageLogs,
  useEquipmentUsageLogs,
  useEquipmentUsageLogsMore,
} from "../use-usage-logs"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("usage log dataset routing", () => {
  beforeEach(() => {
    mockCallRpc.mockReset()
    mockCallRpc.mockResolvedValue([])
  })

  it("routes equipment history to the requested dataset", async () => {
    renderHook(() => useEquipmentUsageLogs("42", { equipmentDataset: "placed" }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockCallRpc).toHaveBeenCalled())
    expect(mockCallRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "usage_log_list",
        args: expect.objectContaining({ p_equipment_dataset: "placed" }),
      })
    )
  })

  it("routes paginated equipment history to the requested dataset", async () => {
    renderHook(() => useEquipmentUsageLogsMore("42", 50, { equipmentDataset: "placed" }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockCallRpc).toHaveBeenCalled())
    expect(mockCallRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "usage_log_list",
        args: expect.objectContaining({ p_equipment_dataset: "placed" }),
      })
    )
  })

  it("routes active usage logs to the requested dataset", async () => {
    renderHook(() => useActiveUsageLogs({ equipmentDataset: "placed" }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mockCallRpc).toHaveBeenCalled())
    expect(mockCallRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "usage_log_list",
        args: expect.objectContaining({ p_equipment_dataset: "placed" }),
      })
    )
  })
})
