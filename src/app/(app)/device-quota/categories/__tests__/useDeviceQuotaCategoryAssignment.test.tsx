import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useDeviceQuotaCategoryAssignment } from "../_hooks/useDeviceQuotaCategoryAssignment"
import { deviceQuotaCategoryAssignedEquipmentQueryKey } from "../_queries/deviceQuotaCategoryAssignedEquipmentQuery"
import { callRpc } from "@/lib/rpc-client"

const mockToast = vi.fn()

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("useDeviceQuotaCategoryAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("invalidates all link-dependent queries and fetches the exact category and tenant", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 5 * 60 * 1000 },
        mutations: { retry: false },
      },
    })
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
    const fetchQuery = vi.spyOn(queryClient, "fetchQuery")
    const clearEquipmentSelection = vi.fn()
    const onReconciled = vi.fn()
    queryClient.setQueryData(deviceQuotaCategoryAssignedEquipmentQueryKey(5, 7), [])

    mockCallRpc.mockImplementation((request) => {
      if (request.fn === "dinh_muc_thiet_bi_link") return Promise.resolve(1)
      if (request.fn === "dinh_muc_thiet_bi_by_nhom") {
        return Promise.resolve([
          {
            id: 101,
            ma_thiet_bi: "TB-001",
            ten_thiet_bi: "Máy X quang",
            model: null,
            serial: null,
            hang_san_xuat: null,
            khoa_phong_quan_ly: null,
            tinh_trang: "Hoạt động",
          },
        ])
      }
      return Promise.resolve([])
    })

    const { result } = renderHook(
      () =>
        useDeviceQuotaCategoryAssignment({
          clearEquipmentSelection,
          onReconciled,
        }),
      { wrapper: createWrapper(queryClient) }
    )

    act(() => {
      result.current.mutate({ thiet_bi_ids: [101], nhom_id: 5, donViId: 7 })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

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
    expect(fetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["dinh_muc_thiet_bi_by_nhom", { nhomId: 5, donViId: 7 }],
      })
    )
    expect(clearEquipmentSelection).toHaveBeenCalledTimes(1)
    expect(onReconciled).toHaveBeenCalledWith([101])
    expect(mockToast).toHaveBeenCalledWith({
      title: "Thành công",
      description: "Đã gán 1 thiết bị vào nhóm định mức.",
    })
  })

  it("reconciles against the tenant captured when the assignment starts", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const linkResult = createDeferred<number>()
    const clearEquipmentSelection = vi.fn()
    const onReconciled = vi.fn()

    mockCallRpc.mockImplementation((request) => {
      if (request.fn === "dinh_muc_thiet_bi_link") return linkResult.promise
      if (request.fn === "dinh_muc_thiet_bi_by_nhom") {
        return Promise.resolve([
          {
            id: 101,
            ma_thiet_bi: "TB-001",
            ten_thiet_bi: "Máy X quang",
            model: null,
            serial: null,
            hang_san_xuat: null,
            khoa_phong_quan_ly: null,
            tinh_trang: "Hoạt động",
          },
        ])
      }
      return Promise.resolve([])
    })

    const { result } = renderHook(
      () =>
        useDeviceQuotaCategoryAssignment({
          clearEquipmentSelection,
          onReconciled,
        }),
      {
        wrapper: createWrapper(queryClient),
      }
    )

    act(() => {
      result.current.mutate({ thiet_bi_ids: [101], nhom_id: 5, donViId: 7 })
    })
    linkResult.resolve(1)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "dinh_muc_thiet_bi_by_nhom",
      args: { p_nhom_id: 5, p_don_vi: 7 },
    })
  })

  it("clears stale selection and reports a reconciliation-specific error after a successful link", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const clearEquipmentSelection = vi.fn()
    const onReconciled = vi.fn()

    mockCallRpc.mockImplementation((request) => {
      if (request.fn === "dinh_muc_thiet_bi_link") return Promise.resolve(1)
      if (request.fn === "dinh_muc_thiet_bi_by_nhom") {
        return Promise.reject(new Error("detail unavailable"))
      }
      return Promise.resolve([])
    })

    const { result } = renderHook(
      () =>
        useDeviceQuotaCategoryAssignment({
          clearEquipmentSelection,
          onReconciled,
        }),
      { wrapper: createWrapper(queryClient) }
    )

    act(() => {
      result.current.mutate({ thiet_bi_ids: [101], nhom_id: 5, donViId: 7 })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(clearEquipmentSelection).toHaveBeenCalledTimes(1)
    expect(onReconciled).not.toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Đã gán, chưa tải được kết quả",
      description: "Thiết bị đã được gán nhưng chưa thể tải lại chi tiết. Vui lòng thử tải lại.",
    })
  })

  it("refreshes only unassigned equipment and keeps selection when zero rows are affected", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
    const fetchQuery = vi.spyOn(queryClient, "fetchQuery")
    const clearEquipmentSelection = vi.fn()
    const onReconciled = vi.fn()
    mockCallRpc.mockResolvedValue(0)

    const { result } = renderHook(
      () =>
        useDeviceQuotaCategoryAssignment({
          clearEquipmentSelection,
          onReconciled,
        }),
      { wrapper: createWrapper(queryClient) }
    )

    act(() => {
      result.current.mutate({ thiet_bi_ids: [101], nhom_id: 5, donViId: 7 })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateQueries).toHaveBeenCalledTimes(1)
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["dinh_muc_thiet_bi_unassigned"],
    })
    expect(fetchQuery).not.toHaveBeenCalled()
    expect(clearEquipmentSelection).not.toHaveBeenCalled()
    expect(onReconciled).not.toHaveBeenCalled()
  })
})
