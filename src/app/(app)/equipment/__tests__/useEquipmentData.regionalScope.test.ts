import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function createRegionalLeaderParams(
  overrides?: Partial<UseEquipmentDataParams>
): UseEquipmentDataParams {
  return {
    isGlobal: false,
    isRegionalLeader: true,
    userRole: "regional_leader",
    userDiaBanId: 10,
    shouldFetchEquipment: true,
    effectiveTenantKey: "regional-10",
    selectedDonVi: null,
    currentTenantId: null,
    debouncedSearch: "",
    sortParam: "id.asc",
    pagination: { pageIndex: 0, pageSize: 20 },
    selectedDepartments: [],
    selectedUsers: [],
    selectedLocations: [],
    selectedStatuses: [],
    selectedClassifications: [],
    selectedFundingSources: [],
    selectedFacilityId: null,
    showSelector: true,
    facilities: [],
    isFacilitiesLoading: false,
    ...overrides,
  }
}

describe("useEquipmentData regional leader facility scope", () => {
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

  it("fetches all allowed facilities when selected facility is null", async () => {
    renderHook(() => useEquipmentData(createRegionalLeaderParams()), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: "equipment_list_enhanced",
          args: expect.objectContaining({
            p_don_vi: null,
          }),
        })
      )
    })
  })

  it("waits for facility context while selected facility is undefined", async () => {
    const { result } = renderHook(
      () => useEquipmentData(createRegionalLeaderParams({ selectedFacilityId: undefined })),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.shouldFetchData).toBe(false)
    })

    expect(mockCallRpc).not.toHaveBeenCalledWith(
      expect.objectContaining({ fn: "equipment_list_enhanced" })
    )
  })
})
