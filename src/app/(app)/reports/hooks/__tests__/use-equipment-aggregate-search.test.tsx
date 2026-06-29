import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  EquipmentAggregateSearchData,
  EquipmentAggregateSearchRequest,
  EquipmentAggregateSearchRow,
  EquipmentAggregateSearchQuotaStatus,
} from "../use-equipment-aggregate-search.types"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import {
  buildEquipmentAggregateSearchQueryKey,
  canUseEquipmentAggregateSearch,
  normalizeEquipmentAggregateSearchError,
  useEquipmentAggregateSearch,
} from "../use-equipment-aggregate-search"

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
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

describe("equipment aggregate search types", () => {
  it("describes the RPC request and response contract", () => {
    const request: EquipmentAggregateSearchRequest = {
      query: "Máy thở",
      groupBy: "facility",
      regionId: 12,
      limit: 25,
    }
    const quotaStatus: EquipmentAggregateSearchQuotaStatus = "not_in_unit_quota"
    const row: EquipmentAggregateSearchRow = {
      groupType: "facility",
      groupId: 34,
      groupName: "Bệnh viện A",
      parentRegionId: 12,
      parentRegionName: "Miền Bắc",
      equipmentCount: 5,
      facilityCount: null,
      quotaCurrentCount: 5,
      quotaMinCount: 2,
      quotaMaxCount: 4,
      quotaStatus,
      quotaNotes: ["Gồm nhiều nhóm định mức"],
    }
    const rowWithoutNotes: EquipmentAggregateSearchRow = {
      ...row,
      quotaNotes: undefined,
    }
    const data: EquipmentAggregateSearchData = {
      rows: [row, rowWithoutNotes],
      summary: {
        totalEquipmentCount: 5,
        regionCount: 1,
        facilityCount: 1,
        query: "Máy thở",
        scopeLabel: "Theo địa bàn",
      },
    }

    expect(request.groupBy).toBe("facility")
    expect(data.rows[0]?.quotaStatus).toBe("not_in_unit_quota")
    expect(data.rows[0]?.quotaNotes?.[0]).toBe("Gồm nhiều nhóm định mức")
    expect(data.rows[1]?.quotaNotes).toBeUndefined()
  })
})

describe("useEquipmentAggregateSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps the query disabled for blank keywords", () => {
    const queryClient = createQueryClient()

    const { result } = renderHook(
      () =>
        useEquipmentAggregateSearch({
          query: "   ",
          groupBy: "region",
          role: "global",
        }),
      { wrapper: createWrapper(queryClient) }
    )

    expect(result.current.fetchStatus).toBe("idle")
    expect(mocks.callRpc).not.toHaveBeenCalled()
  })

  it("keeps the query disabled for unsupported roles", () => {
    const queryClient = createQueryClient()

    const { result } = renderHook(
      () =>
        useEquipmentAggregateSearch({
          query: "Máy thở",
          groupBy: "region",
          role: "to_qltb",
        }),
      { wrapper: createWrapper(queryClient) }
    )

    expect(result.current.fetchStatus).toBe("idle")
    expect(canUseEquipmentAggregateSearch("to_qltb")).toBe(false)
    expect(mocks.callRpc).not.toHaveBeenCalled()
  })

  it("calls the aggregate search RPC with trimmed keyword and stable params", async () => {
    mocks.callRpc.mockResolvedValueOnce({
      rows: [],
      summary: {
        totalEquipmentCount: 0,
        regionCount: 0,
        facilityCount: 0,
        query: "Máy thở/ICU",
        scopeLabel: "Toàn hệ thống",
      },
    })

    const queryClient = createQueryClient()

    renderHook(
      () =>
        useEquipmentAggregateSearch({
          query: "  Máy thở/ICU  ",
          groupBy: "region",
          role: "admin",
          regionId: null,
          limit: 50,
        }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => expect(mocks.callRpc).toHaveBeenCalledTimes(1))

    expect(
      buildEquipmentAggregateSearchQueryKey({
        query: "  Máy thở/ICU  ",
        groupBy: "region",
        role: "admin",
        regionId: null,
        limit: 50,
      })
    ).toEqual([
      "reports",
      "equipment-aggregate-search",
      {
        query: "Máy thở/ICU",
        groupBy: "region",
        role: "admin",
        regionId: null,
        limit: 50,
      },
    ])
    expect(mocks.callRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "equipment_aggregate_search",
        args: {
          p_query: "Máy thở/ICU",
          p_group_by: "region",
          p_region_id: null,
          p_limit: 50,
        },
        signal: expect.any(AbortSignal),
      })
    )
  })

  it("normalizes invalid and oversized limits before keying and calling the RPC", async () => {
    mocks.callRpc.mockResolvedValueOnce({
      rows: [],
      summary: {
        totalEquipmentCount: 0,
        regionCount: 0,
        facilityCount: 0,
        query: "Máy thở",
        scopeLabel: "Toàn hệ thống",
      },
    })

    const queryClient = createQueryClient()

    renderHook(
      () =>
        useEquipmentAggregateSearch({
          query: "Máy thở",
          groupBy: "region",
          role: "global",
          limit: 250,
        }),
      { wrapper: createWrapper(queryClient) }
    )

    await waitFor(() => expect(mocks.callRpc).toHaveBeenCalledTimes(1))

    expect(
      buildEquipmentAggregateSearchQueryKey({
        query: "Máy thở",
        groupBy: "region",
        role: "global",
        limit: Number.NaN,
      })[2].limit
    ).toBe(50)
    expect(
      buildEquipmentAggregateSearchQueryKey({
        query: "Máy thở",
        groupBy: "region",
        role: "global",
        limit: 0,
      })[2].limit
    ).toBe(1)
    expect(mocks.callRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          p_limit: 100,
        }),
      })
    )
  })

  it("does not keep previous aggregate rows when the query becomes disabled", async () => {
    mocks.callRpc.mockResolvedValueOnce({
      rows: [
        {
          groupType: "region",
          groupId: 1,
          groupName: "Miền Bắc",
          parentRegionId: null,
          parentRegionName: null,
          equipmentCount: 2,
          facilityCount: 1,
          quotaCurrentCount: null,
          quotaMinCount: null,
          quotaMaxCount: null,
          quotaStatus: null,
          quotaNotes: [],
        },
      ],
      summary: {
        totalEquipmentCount: 2,
        regionCount: 1,
        facilityCount: 1,
        query: "Máy thở",
        scopeLabel: "Toàn hệ thống",
      },
    } satisfies EquipmentAggregateSearchData)

    const queryClient = createQueryClient()
    const { result, rerender } = renderHook(
      ({ query }) =>
        useEquipmentAggregateSearch({
          query,
          groupBy: "region",
          role: "global",
        }),
      {
        initialProps: { query: "Máy thở" },
        wrapper: createWrapper(queryClient),
      }
    )

    await waitFor(() => expect(result.current.data?.rows).toHaveLength(1))

    rerender({ query: "   " })

    expect(result.current.fetchStatus).toBe("idle")
    expect(result.current.data?.rows).toEqual([])
  })

  it("normalizes unknown API errors for UI display", () => {
    expect(normalizeEquipmentAggregateSearchError(new Error("RPC failed"))).toBe("RPC failed")
    expect(normalizeEquipmentAggregateSearchError({ message: "Permission denied" })).toBe(
      "Permission denied"
    )
    expect(normalizeEquipmentAggregateSearchError(null)).toBe(
      "Không thể tải kết quả tìm kiếm thiết bị"
    )
  })
})
