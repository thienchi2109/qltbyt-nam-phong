import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest"

import { callRpc, type RpcOptions } from "@/lib/rpc-client"

import { useEquipmentFilterSheetCascade } from "../useEquipmentFilterSheetCascade"
import type { FilterBottomSheetData } from "../../types"

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

type RpcClientMock = MockedFunction<
  (options: RpcOptions<Record<string, unknown>>) => Promise<unknown>
>

const callRpcMock = callRpc as unknown as RpcClientMock

const committedFilterData: FilterBottomSheetData = {
  status: [{ id: "Hoat dong", label: "Hoat dong", count: 10 }],
  department: [],
  location: [],
  user: [],
  classification: [],
  fundingSource: [],
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
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

function getBucketCalls() {
  return callRpcMock.mock.calls
    .map(([options]) => options)
    .filter((options) => options.fn === "equipment_filter_buckets")
}

describe("useEquipmentFilterSheetCascade", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    callRpcMock.mockResolvedValue({
      status: [{ name: "Hoat dong", count: 3 }],
      department: [{ name: "ICU", count: 2 }],
      location: [],
      user: [],
      classification: [],
      fundingSource: [],
    })
  })

  it("refreshes sheet bucket options from draft filters without applying them", async () => {
    const onApply = vi.fn()
    const queryClient = createQueryClient()
    const { result } = renderHook(
      () =>
        useEquipmentFilterSheetCascade({
          shouldFetchData: true,
          committedColumnFilters: [],
          committedFilterData,
          effectiveTenantKey: "tenant-42",
          userRole: "to_qltb",
          userDiaBanId: null,
          effectiveSelectedDonVi: 42,
          debouncedSearch: "monitor",
          onApply,
          onClearAll: vi.fn(),
        }),
      { wrapper: createWrapper(queryClient) }
    )

    act(() => result.current.setIsFilterSheetOpen(true))

    await waitFor(() => expect(getBucketCalls()).toHaveLength(1))

    act(() =>
      result.current.onDraftFiltersChange([{ id: "tinh_trang_hien_tai", value: ["Hoat dong"] }])
    )

    await waitFor(() => expect(getBucketCalls()).toHaveLength(2))

    expect(getBucketCalls()[1]?.args).toMatchObject({
      p_tinh_trang_array: ["Hoat dong"],
    })
    expect(onApply).not.toHaveBeenCalled()
  })
})
