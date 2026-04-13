import * as React from "react"
import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("@/hooks/use-debounce", () => ({
  useSearchDebounce: (value: string) => value,
}))

import {
  useTransferDepartments,
  useTransferEquipmentSearch,
} from "@/components/transfer-dialog.data"

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("transfer-dialog.data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("reuses cached departments data when the add dialog reopens", async () => {
    mocks.callRpc.mockResolvedValue([{ name: "Khoa A" }, { name: "Khoa B" }])
    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const { result, rerender } = renderHook(
      ({ open }) => useTransferDepartments({ open }),
      {
        initialProps: { open: true },
        wrapper,
      },
    )

    await waitFor(() => {
      expect(result.current.departments).toEqual(["Khoa A", "Khoa B"])
    })

    rerender({ open: false })
    rerender({ open: true })

    await waitFor(() => {
      expect(result.current.departments).toEqual(["Khoa A", "Khoa B"])
    })

    expect(mocks.callRpc).toHaveBeenCalledTimes(1)
    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "departments_list",
      args: {},
    })
  })

  it("does not search equipment until the dialog can search with at least two characters", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const { rerender } = renderHook(
      ({ open, canSearch, searchTerm }) =>
        useTransferEquipmentSearch({ open, canSearch, searchTerm }),
      {
        initialProps: {
          open: false,
          canSearch: true,
          searchTerm: "Máy",
        },
        wrapper,
      },
    )

    rerender({ open: true, canSearch: false, searchTerm: "Máy" })
    rerender({ open: true, canSearch: true, searchTerm: "M" })

    await waitFor(() => {
      expect(mocks.callRpc).not.toHaveBeenCalled()
    })
  })

  it("searches equipment with the existing RPC contract and maps the result rows", async () => {
    mocks.callRpc.mockResolvedValue({
      data: [
        {
          id: 11,
          ma_thiet_bi: "TB-11",
          ten_thiet_bi: "Máy siêu âm",
          khoa_phong_quan_ly: "Khoa A",
        },
      ],
    })
    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    const { result } = renderHook(
      () =>
        useTransferEquipmentSearch({
          open: true,
          canSearch: true,
          searchTerm: " Máy ",
        }),
      {
        wrapper,
      },
    )

    await waitFor(() => {
      expect(result.current.equipmentResults).toEqual([
        {
          id: 11,
          ma_thiet_bi: "TB-11",
          ten_thiet_bi: "Máy siêu âm",
          khoa_phong_quan_ly: "Khoa A",
        },
      ])
    })

    expect(result.current.trimmedSearch).toBe("Máy")
    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "equipment_list_enhanced",
      args: {
        p_q: "Máy",
        p_sort: "ten_thiet_bi.asc",
        p_page: 1,
        p_page_size: 20,
      },
      signal: expect.any(AbortSignal),
    })
  })

  it("shows a toast for equipment search errors but skips abort errors", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createWrapper(queryClient)

    mocks.callRpc.mockRejectedValueOnce(new Error("Boom"))

    const { unmount } = renderHook(
      () =>
        useTransferEquipmentSearch({
          open: true,
          canSearch: true,
          searchTerm: "Máy",
        }),
      {
        wrapper,
      },
    )

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Lỗi tìm kiếm thiết bị",
          description: "Boom",
        }),
      )
    })

    unmount()
    mocks.toast.mockClear()
    mocks.callRpc.mockRejectedValueOnce(new DOMException("aborted", "AbortError"))

    renderHook(
      () =>
        useTransferEquipmentSearch({
          open: true,
          canSearch: true,
          searchTerm: "Máy",
        }),
      {
        wrapper: createWrapper(createTestQueryClient()),
      },
    )

    await waitFor(() => {
      expect(mocks.callRpc).toHaveBeenCalled()
    })

    expect(mocks.toast).not.toHaveBeenCalled()
  })
})
