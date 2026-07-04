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
  userDiaBanId: null,
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

  it("keys bucket data by active filters but not pagination", async () => {
    const queryClient = createQueryClient()
    const { rerender } = renderHook((params: UseEquipmentDataParams) => useEquipmentData(params), {
      initialProps: baseParams,
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(getBucketCalls()).toHaveLength(1))

    const initialBucketQueries = queryClient
      .getQueryCache()
      .findAll({ queryKey: ["equipment_filter_buckets"] })
    const initialBucketKeyParams = initialBucketQueries[0]?.queryKey[1] as
      Record<string, unknown> | undefined

    expect(initialBucketKeyParams).toMatchObject({
      q: "monitor",
      khoa_phong_array: ["ICU"],
      tinh_trang_array: ["Hoat dong"],
    })
    expect(initialBucketKeyParams).not.toHaveProperty("page")
    expect(initialBucketKeyParams).not.toHaveProperty("size")

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
})
