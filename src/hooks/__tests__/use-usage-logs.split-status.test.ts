import * as React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCallRpc = vi.fn()
const mockToast = vi.fn()

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (args: unknown) => mockCallRpc(args),
}))

vi.mock("@/hooks/use-toast", () => ({
  toast: (args: unknown) => mockToast(args),
}))

import { useEndUsageSession, useStartUsageSession } from "../use-usage-logs"

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe("use-usage-logs split status payloads", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockReset()
    mockCallRpc.mockResolvedValue({
      id: 123,
      thiet_bi_id: 456,
      trang_thai: "dang_su_dung",
    })
  })

  it("sends both the legacy and split initial status fields when starting usage", async () => {
    const queryClient = createQueryClient()
    const { result } = renderHook(() => useStartUsageSession(), {
      wrapper: createWrapper(queryClient),
    })

    act(() => {
      result.current.mutate({
        thiet_bi_id: 456,
        nguoi_su_dung_id: 789,
        tinh_trang_thiet_bi: "Hoạt động tốt",
        tinh_trang_ban_dau: "Hoạt động tốt",
      })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "usage_session_start",
      args: {
        p_thiet_bi_id: 456,
        p_nguoi_su_dung_id: 789,
        p_tinh_trang_thiet_bi: "Hoạt động tốt",
        p_ghi_chu: null,
        p_tinh_trang_ban_dau: "Hoạt động tốt",
      },
    })
  })

  it("sends both the legacy and split final status fields when ending usage", async () => {
    mockCallRpc.mockResolvedValueOnce({
      id: 123,
      thiet_bi_id: 456,
      trang_thai: "hoan_thanh",
    })

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useEndUsageSession(), {
      wrapper: createWrapper(queryClient),
    })

    act(() => {
      result.current.mutate({
        id: 123,
        tinh_trang_thiet_bi: "Cần bảo trì",
        tinh_trang_ket_thuc: "Cần bảo trì",
      })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "usage_session_end",
      args: {
        p_usage_log_id: 123,
        p_tinh_trang_thiet_bi: "Cần bảo trì",
        p_ghi_chu: null,
        p_tinh_trang_ket_thuc: "Cần bảo trì",
      },
    })
  })
})
