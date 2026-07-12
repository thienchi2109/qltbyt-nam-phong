import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest"

import { useActiveUsageLogs } from "@/hooks/use-usage-logs"
import { callRpc, type RpcOptions } from "@/lib/rpc-client"

import { useEquipmentData, type UseEquipmentDataParams } from "../useEquipmentData"

vi.mock("@/hooks/use-usage-logs", () => ({
  useActiveUsageLogs: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

type RpcClientMock = MockedFunction<
  (options: RpcOptions<Record<string, unknown>>) => Promise<unknown>
>

const callRpcMock = callRpc as unknown as RpcClientMock
const useActiveUsageLogsMock = useActiveUsageLogs as unknown as MockedFunction<
  typeof useActiveUsageLogs
>

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

const baseParams: UseEquipmentDataParams = {
  isGlobal: false,
  isRegionalLeader: false,
  userRole: "to_qltb",
  userDiaBanId: 7,
  shouldFetchEquipment: true,
  effectiveTenantKey: "tenant-42",
  selectedDonVi: 42,
  currentTenantId: 42,
  debouncedSearch: "monitor",
  sortParam: "id.asc",
  pagination: { pageIndex: 0, pageSize: 20 },
  selectedDepartments: ["ICU"],
  selectedUsers: ["Dr A"],
  selectedLocations: ["Room 1"],
  selectedStatuses: ["Hoat dong"],
  selectedClassifications: ["Class A"],
  selectedFundingSources: ["Fund A"],
  selectedFacilityId: null,
  showSelector: false,
  facilities: [],
  isFacilitiesLoading: false,
}

function getBucketCalls() {
  return callRpcMock.mock.calls
    .map(([options]) => options)
    .filter((options) => options.fn === "equipment_filter_buckets")
}

function getRpcCall(fn: string) {
  return callRpcMock.mock.calls.map(([options]) => options).find((options) => options.fn === fn)
}

describe("useEquipmentData filter bucket query", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useActiveUsageLogsMock.mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useActiveUsageLogs>)

    callRpcMock.mockImplementation(async ({ fn }) => {
      if (fn === "equipment_list_enhanced") {
        return { data: [], total: 0 }
      }
      if (fn === "equipment_department_distribution") {
        return []
      }
      if (fn === "equipment_filter_buckets") {
        return {
          department: [],
          user: [],
          location: [],
          status: [],
          classification: [],
          fundingSource: [],
        }
      }
      return []
    })
  })

  it("passes active search and filters to equipment_filter_buckets", async () => {
    const queryClient = createQueryClient()

    renderHook(() => useEquipmentData(baseParams), {
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

  it("keys list, distribution, and bucket data by their current cache scopes", async () => {
    const queryClient = createQueryClient()
    const { rerender } = renderHook((params: UseEquipmentDataParams) => useEquipmentData(params), {
      initialProps: baseParams,
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(getBucketCalls()).toHaveLength(1))

    const sharedKeyParams = {
      tenant: "tenant-42",
      role: "to_qltb",
      diaBan: 7,
      donVi: 42,
      q: "monitor",
      khoa_phong_array: ["ICU"],
      nguoi_su_dung_array: ["Dr A"],
      vi_tri_lap_dat_array: ["Room 1"],
      tinh_trang_array: ["Hoat dong"],
      phan_loai_array: ["Class A"],
      nguon_kinh_phi_array: ["Fund A"],
    }
    const listKeyParams = queryClient
      .getQueryCache()
      .findAll({ queryKey: ["equipment_list_enhanced"] })
      .at(-1)?.queryKey[1]
    const distributionKeyParams = queryClient
      .getQueryCache()
      .findAll({ queryKey: ["equipment_department_distribution"] })
      .at(-1)?.queryKey[1]
    const bucketKeyParams = queryClient
      .getQueryCache()
      .findAll({ queryKey: ["equipment_filter_buckets"] })
      .at(-1)?.queryKey[1]

    expect(listKeyParams).toEqual({
      ...sharedKeyParams,
      page: 0,
      size: 20,
      sort: "id.asc",
    })
    expect(distributionKeyParams).toEqual(sharedKeyParams)
    expect(bucketKeyParams).toEqual(sharedKeyParams)

    rerender({
      ...baseParams,
      debouncedSearch: "pump",
      selectedStatuses: ["Bao tri"],
    })

    await waitFor(() => expect(getBucketCalls()).toHaveLength(2))

    expect(getBucketCalls()[1]?.args).toMatchObject({
      p_q: "pump",
      p_tinh_trang_array: ["Bao tri"],
    })

    rerender({
      ...baseParams,
      debouncedSearch: "pump",
      selectedStatuses: ["Bao tri"],
      pagination: { pageIndex: 3, pageSize: 20 },
    })

    await waitFor(() => expect(getBucketCalls()).toHaveLength(2))
  })

  it("normalizes empty filters across list, distribution, and bucket query scopes", async () => {
    const queryClient = createQueryClient()
    const emptyFilterParams: UseEquipmentDataParams = {
      ...baseParams,
      debouncedSearch: "",
      selectedDepartments: [],
      selectedUsers: [],
      selectedLocations: [],
      selectedStatuses: [],
      selectedClassifications: [],
      selectedFundingSources: [],
    }

    renderHook(() => useEquipmentData(emptyFilterParams), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(getBucketCalls()).toHaveLength(1))

    const sharedKeyParams = {
      tenant: "tenant-42",
      role: "to_qltb",
      diaBan: 7,
      donVi: 42,
      q: null,
      khoa_phong_array: null,
      nguoi_su_dung_array: null,
      vi_tri_lap_dat_array: null,
      tinh_trang_array: null,
      phan_loai_array: null,
      nguon_kinh_phi_array: null,
    }
    const listKeyParams = queryClient
      .getQueryCache()
      .findAll({ queryKey: ["equipment_list_enhanced"] })
      .at(-1)?.queryKey[1]
    const distributionKeyParams = queryClient
      .getQueryCache()
      .findAll({ queryKey: ["equipment_department_distribution"] })
      .at(-1)?.queryKey[1]
    const bucketKeyParams = queryClient
      .getQueryCache()
      .findAll({ queryKey: ["equipment_filter_buckets"] })
      .at(-1)?.queryKey[1]

    expect(listKeyParams).toEqual({
      ...sharedKeyParams,
      page: 0,
      size: 20,
      sort: "id.asc",
    })
    expect(distributionKeyParams).toEqual(sharedKeyParams)
    expect(bucketKeyParams).toEqual(sharedKeyParams)

    const emptyRpcFilters = {
      p_q: null,
      p_don_vi: 42,
      p_khoa_phong_array: null,
      p_nguoi_su_dung_array: null,
      p_vi_tri_lap_dat_array: null,
      p_tinh_trang_array: null,
      p_phan_loai_array: null,
      p_nguon_kinh_phi_array: null,
    }

    expect(getRpcCall("equipment_list_enhanced")?.args).toMatchObject(emptyRpcFilters)
    expect(getRpcCall("equipment_department_distribution")?.args).toMatchObject(emptyRpcFilters)
    expect(getRpcCall("equipment_filter_buckets")?.args).toMatchObject(emptyRpcFilters)
  })
})
