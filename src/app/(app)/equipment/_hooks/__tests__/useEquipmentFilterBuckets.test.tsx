import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest"

import { callRpc, type RpcOptions } from "@/lib/rpc-client"

import {
  useEquipmentFilterBuckets,
  type UseEquipmentFilterBucketsParams,
} from "../useEquipmentFilterBuckets"

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

type RpcClientMock = MockedFunction<
  (options: RpcOptions<Record<string, unknown>>) => Promise<unknown>
>

const callRpcMock = callRpc as unknown as RpcClientMock

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

const baseParams: UseEquipmentFilterBucketsParams = {
  shouldFetchData: true,
  effectiveTenantKey: "tenant-42",
  userRole: "to_qltb",
  userDiaBanId: 7,
  effectiveSelectedDonVi: 42,
  debouncedSearch: "monitor",
  selectedDepartments: ["ICU"],
  selectedUsers: ["Dr A"],
  selectedLocations: ["Room 1"],
  selectedStatuses: ["Hoat dong"],
  selectedClassifications: ["Class A"],
  selectedFundingSources: ["Fund A"],
}

function getBucketCalls() {
  return callRpcMock.mock.calls
    .map(([options]) => options)
    .filter((options) => options.fn === "equipment_filter_buckets")
}

describe("useEquipmentFilterBuckets", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    callRpcMock.mockResolvedValue({
      department: [{ name: "ICU", count: 3 }],
      user: [{ name: "Dr A", count: 2 }],
      location: [{ name: "Room 1", count: 1 }],
      status: [{ name: "Hoat dong", count: 4 }],
      classification: [{ name: "Class A", count: 5 }],
      fundingSource: [{ name: "Fund A", count: 6 }],
    })
  })

  it("passes selected filters to the shared equipment_filter_buckets RPC", async () => {
    const queryClient = createQueryClient()

    renderHook(() => useEquipmentFilterBuckets(baseParams), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(getBucketCalls()).toHaveLength(1))

    expect(getBucketCalls()[0]?.args).toMatchObject({
      p_q: "monitor",
      p_don_vi: 42,
      p_khoa_phong_array: ["ICU"],
      p_nguoi_su_dung_array: ["Dr A"],
      p_vi_tri_lap_dat_array: ["Room 1"],
      p_tinh_trang_array: ["Hoat dong"],
      p_phan_loai_array: ["Class A"],
      p_nguon_kinh_phi_array: ["Fund A"],
    })
  })

  it("maps bucket rows once for desktop strings and mobile sheet options", async () => {
    const queryClient = createQueryClient()
    const { result } = renderHook(() => useEquipmentFilterBuckets(baseParams), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.filterData.department).toHaveLength(1))

    expect(result.current.departments).toEqual(["ICU"])
    expect(result.current.filterData.department).toEqual([{ id: "ICU", label: "ICU", count: 3 }])
    expect(result.current.filterData.status).toEqual([
      { id: "Hoat dong", label: "Hoat dong", count: 4 },
    ])
  })

  it("keys bucket data by draft filters without pagination inputs", async () => {
    const queryClient = createQueryClient()
    const { rerender } = renderHook(
      (params: UseEquipmentFilterBucketsParams) => useEquipmentFilterBuckets(params),
      {
        initialProps: baseParams,
        wrapper: createWrapper(queryClient),
      }
    )

    await waitFor(() => expect(getBucketCalls()).toHaveLength(1))

    rerender({
      ...baseParams,
      selectedStatuses: ["Bao tri"],
    })

    await waitFor(() => expect(getBucketCalls()).toHaveLength(2))

    const bucketQueries = queryClient
      .getQueryCache()
      .findAll({ queryKey: ["equipment_filter_buckets"] })
    const latestBucketKeyParams = bucketQueries.at(-1)?.queryKey[1] as
      Record<string, unknown> | undefined

    expect(latestBucketKeyParams).toMatchObject({
      tenant: "tenant-42",
      role: "to_qltb",
      diaBan: 7,
      donVi: 42,
      q: "monitor",
      khoa_phong_array: ["ICU"],
      nguoi_su_dung_array: ["Dr A"],
      vi_tri_lap_dat_array: ["Room 1"],
      tinh_trang_array: ["Bao tri"],
      phan_loai_array: ["Class A"],
      nguon_kinh_phi_array: ["Fund A"],
    })
    expect(latestBucketKeyParams).not.toHaveProperty("page")
    expect(latestBucketKeyParams).not.toHaveProperty("size")
    expect(latestBucketKeyParams).not.toHaveProperty("sort")
  })
})
