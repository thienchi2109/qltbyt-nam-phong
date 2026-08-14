import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useLinkEquipmentMutation } from "../_components/DeviceQuotaMappingMutations"
import { callRpc } from "@/lib/rpc-client"

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

/** Creates an isolated React Query wrapper for mutation characterization tests. */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("useLinkEquipmentMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("preserves the current success toast, selection reset, and query invalidation behavior", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    })
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
    const toast = vi.fn()
    const clearSelection = vi.fn()
    mockCallRpc.mockResolvedValue(undefined)

    const { result } = renderHook(() => useLinkEquipmentMutation(toast, clearSelection, 7), {
      wrapper: createWrapper(queryClient),
    })

    act(() => {
      result.current.mutate({ thiet_bi_ids: [101, 102], nhom_id: 5 })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "dinh_muc_thiet_bi_link",
      args: {
        p_thiet_bi_ids: [101, 102],
        p_nhom_id: 5,
        p_don_vi: 7,
      },
    })
    expect(toast).toHaveBeenCalledWith({
      title: "Thành công",
      description: "Đã gán 2 thiết bị vào nhóm định mức.",
    })
    expect(clearSelection).toHaveBeenCalledTimes(1)
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["dinh_muc_thiet_bi_unassigned"],
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["dinh_muc_thiet_bi_unassigned_filter_options"],
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["dinh_muc_nhom_list"],
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["dinh_muc_compliance_summary"],
    })
  })

  it("preserves the current destructive error toast without clearing selection", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    })
    const toast = vi.fn()
    const clearSelection = vi.fn()
    mockCallRpc.mockRejectedValue(new Error("RPC unavailable"))

    const { result } = renderHook(() => useLinkEquipmentMutation(toast, clearSelection, 7), {
      wrapper: createWrapper(queryClient),
    })

    act(() => {
      result.current.mutate({ thiet_bi_ids: [101], nhom_id: 5 })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(toast).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Lỗi gán thiết bị",
      description: "RPC unavailable",
    })
    expect(clearSelection).not.toHaveBeenCalled()
  })
})
