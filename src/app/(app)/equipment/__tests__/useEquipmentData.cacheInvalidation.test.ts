import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCallRpc = vi.hoisted(() => vi.fn())

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (args: unknown) => mockCallRpc(args),
}))

vi.mock("@/hooks/use-usage-logs", () => ({
  useActiveUsageLogs: () => ({
    data: [],
    isLoading: false,
  }),
}))

import { useEquipmentData } from "../_hooks/useEquipmentData"
import type { UseEquipmentDataParams } from "../_hooks/useEquipmentData"

type QueryPredicate = (query: { readonly queryKey: readonly unknown[] }) => boolean

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function createParams(overrides?: Partial<UseEquipmentDataParams>): UseEquipmentDataParams {
  return {
    isGlobal: false,
    isRegionalLeader: false,
    userRole: "user",
    userDiaBanId: undefined,
    shouldFetchEquipment: true,
    effectiveTenantKey: "5",
    selectedDonVi: 5,
    currentTenantId: 5,
    debouncedSearch: "",
    sortParam: "id.asc",
    pagination: { pageIndex: 0, pageSize: 20 },
    selectedDepartments: [],
    selectedUsers: [],
    selectedLocations: [],
    selectedStatuses: [],
    selectedClassifications: [],
    selectedFundingSources: [],
    selectedFacilityId: undefined,
    showSelector: false,
    facilities: [],
    isFacilitiesLoading: false,
    ...overrides,
  }
}

describe("useEquipmentData cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockImplementation(({ fn }: { fn: string }) => {
      switch (fn) {
        case "equipment_list_enhanced":
          return Promise.resolve({ data: [], total: 0 })
        case "equipment_filter_buckets":
          return Promise.resolve({})
        case "equipment_department_distribution":
          return Promise.resolve([])
        default:
          return Promise.resolve([])
      }
    })
  })

  it("invalidates tenant-scoped filter bucket caches with equipment data caches", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useEquipmentData(createParams()), {
      wrapper: createWrapper(queryClient),
    })

    act(() => {
      result.current.invalidateEquipmentForCurrentTenant()
    })

    const filters = invalidateQueries.mock.calls.at(-1)?.[0] as
      { readonly predicate?: QueryPredicate } | undefined
    expect(filters?.predicate).toBeDefined()

    const matchesFilterBuckets = filters?.predicate?.({
      queryKey: [
        "equipment_filter_buckets",
        {
          tenant: "5",
          role: "user",
          diaBan: undefined,
          donVi: 5,
        },
      ],
    })

    expect(matchesFilterBuckets).toBe(true)
  })
})
