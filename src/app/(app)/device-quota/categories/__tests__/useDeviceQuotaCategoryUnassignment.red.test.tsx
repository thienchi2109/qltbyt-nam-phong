import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { EquipmentPreviewItem } from "@/app/(app)/device-quota/_components/mapping-preview/MappingPreviewPrimitives"
import { callRpc } from "@/lib/rpc-client"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import type { CategoryListItem } from "../_types/categories"
import {
  expectTenantScopedCancellations,
  runUnassignment,
  useUnassignmentUnderTest,
} from "./DeviceQuotaCategoryUnassignmentHookHarness"
import {
  AFFECTED_QUERY_KEYS,
  AFFECTED_SEEDED_QUERY_KEYS,
  ASSIGNED_KEY,
  CATEGORY_LIST_KEY,
  COMPLIANCE_KEY,
  createDeferred,
  equipment,
  FILTER_OPTIONS_KEY,
  FILTERED_CATEGORY_LIST_KEY,
  FILTERED_UNASSIGNED_KEY,
  OTHER_TENANT_CATEGORY_LIST_KEY,
  SEEDED_CACHE_KEYS,
  seedVisibleCaches,
  STALE_ONLY_CACHE_KEYS,
  startDelayedExpandedReads,
  UNASSIGNED_KEY,
  VARIABLES,
} from "./DeviceQuotaCategoryUnassignmentTestSupport"

const mockToast = vi.fn()

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

describe("useDeviceQuotaCategoryUnassignment RED contract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sends one unlink RPC with the equipment, expected category, and captured tenant", async () => {
    const queryClient = createTestQueryClient()
    seedVisibleCaches(queryClient)
    mockCallRpc.mockResolvedValue(1)

    await runUnassignment(queryClient)

    expect(mockCallRpc).toHaveBeenCalledTimes(1)
    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "dinh_muc_thiet_bi_unlink",
      args: {
        p_thiet_bi_ids: [101],
        p_nhom_id: 5,
        p_don_vi: 7,
      },
    })
  })

  it("cancels matching reads before patching visible caches and avoids immediate reads", async () => {
    const queryClient = createTestQueryClient()
    seedVisibleCaches(queryClient)
    const delayedReads = startDelayedExpandedReads(queryClient)
    await waitFor(() => {
      expect(queryClient.getQueryState(FILTERED_CATEGORY_LIST_KEY)?.fetchStatus).toBe("fetching")
      expect(queryClient.getQueryState(FILTERED_UNASSIGNED_KEY)?.fetchStatus).toBe("fetching")
    })
    const assignedBefore = queryClient.getQueryData<EquipmentPreviewItem[]>(ASSIGNED_KEY)!
    const primaryCategoriesBefore = queryClient.getQueryData<CategoryListItem[]>(CATEGORY_LIST_KEY)!
    const filteredCategoriesBefore = queryClient.getQueryData<CategoryListItem[]>(
      FILTERED_CATEGORY_LIST_KEY
    )!
    const otherTenantCategoriesBefore = queryClient.getQueryData<CategoryListItem[]>(
      OTHER_TENANT_CATEGORY_LIST_KEY
    )!
    const staleOnlyCachesBefore = STALE_ONLY_CACHE_KEYS.map(
      (queryKey) => [queryKey, queryClient.getQueryData(queryKey)] as const
    )
    const cancelQueries = vi.spyOn(queryClient, "cancelQueries")
    const setQueryData = vi.spyOn(queryClient, "setQueryData")
    const setQueriesData = vi.spyOn(queryClient, "setQueriesData")
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
    const fetchQuery = vi.spyOn(queryClient, "fetchQuery")
    const refetchQueries = vi.spyOn(queryClient, "refetchQueries")
    const unlinkResult = createDeferred<number>()
    mockCallRpc.mockReturnValue(unlinkResult.promise)
    const cachesWhilePending = SEEDED_CACHE_KEYS.map(
      (queryKey) => [queryKey, queryClient.getQueryData(queryKey)] as const
    )
    const rendered = renderHook(() => useUnassignmentUnderTest(), {
      wrapper: createReactQueryWrapper(queryClient),
    })
    let mutationPromise!: Promise<number>

    act(() => {
      mutationPromise = rendered.result.current.mutateAsync(VARIABLES)
    })
    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledTimes(1)
    })
    for (const [queryKey, before] of cachesWhilePending) {
      expect(queryClient.getQueryData(queryKey)).toBe(before)
    }
    expect(cancelQueries).not.toHaveBeenCalled()
    expect(setQueryData).not.toHaveBeenCalled()
    expect(setQueriesData).not.toHaveBeenCalled()
    expect(invalidateQueries).not.toHaveBeenCalled()

    await act(async () => {
      unlinkResult.resolve(1)
      await mutationPromise
    })

    for (const queryKey of AFFECTED_QUERY_KEYS) {
      expect(cancelQueries).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey,
        })
      )
      expect(invalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey,
          refetchType: "none",
        })
      )
    }
    expectTenantScopedCancellations(cancelQueries.mock.calls)
    const cacheWriteOrders = [
      ...setQueryData.mock.invocationCallOrder,
      ...setQueriesData.mock.invocationCallOrder,
    ]
    expect(Math.max(...cancelQueries.mock.invocationCallOrder)).toBeLessThan(
      Math.min(...cacheWriteOrders)
    )
    const assignedAfter = queryClient.getQueryData<EquipmentPreviewItem[]>(ASSIGNED_KEY)!
    expect(assignedAfter).not.toBe(assignedBefore)
    expect(assignedAfter).toEqual([])
    for (const [queryKey, before, expectedBefore, expectedAfter] of [
      [CATEGORY_LIST_KEY, primaryCategoriesBefore, 3, 2],
      [FILTERED_CATEGORY_LIST_KEY, filteredCategoriesBefore, 0, 0],
    ] as const) {
      const after = queryClient.getQueryData<CategoryListItem[]>(queryKey)!
      if (expectedBefore !== expectedAfter) {
        expect(after).not.toBe(before)
        expect(after[1]).not.toBe(before[1])
      }
      expect(after[0]).toBe(before[0])
      expect(after[1]).toMatchObject({ id: 5, so_luong_hien_co: expectedAfter })
      expect(after[2]).toBe(before[2])
      expect(before[1]).toMatchObject({ id: 5, so_luong_hien_co: expectedBefore })
    }
    expect(queryClient.getQueryData(OTHER_TENANT_CATEGORY_LIST_KEY)).toBe(
      otherTenantCategoriesBefore
    )
    await delayedReads.settle()
    for (const [queryKey, before] of staleOnlyCachesBefore) {
      expect(queryClient.getQueryData(queryKey)).toBe(before)
    }
    expect(
      queryClient.getQueryData<CategoryListItem[]>(FILTERED_CATEGORY_LIST_KEY)?.[1]
    ).toMatchObject({ id: 5, so_luong_hien_co: 0 })
    for (const queryKey of AFFECTED_SEEDED_QUERY_KEYS) {
      expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true)
    }
    expect(queryClient.getQueryState(OTHER_TENANT_CATEGORY_LIST_KEY)?.isInvalidated).toBe(false)
    expect(fetchQuery).not.toHaveBeenCalled()
    expect(refetchQueries).not.toHaveBeenCalled()
    expect(mockCallRpc).toHaveBeenCalledTimes(1)
  })

  it("prevents a delayed pre-mutation assigned read from restoring the removed row", async () => {
    const queryClient = createTestQueryClient()
    seedVisibleCaches(queryClient)
    const delayedAssignedRead = createDeferred<EquipmentPreviewItem[]>()
    await queryClient.invalidateQueries({
      queryKey: ASSIGNED_KEY,
      exact: true,
      refetchType: "none",
    })
    const staleRead = queryClient
      .fetchQuery({
        queryKey: ASSIGNED_KEY,
        queryFn: () => delayedAssignedRead.promise,
        staleTime: 0,
      })
      .catch(() => undefined)
    mockCallRpc.mockResolvedValue(1)

    await waitFor(() => {
      expect(queryClient.getQueryState(ASSIGNED_KEY)?.fetchStatus).toBe("fetching")
    })
    await runUnassignment(queryClient)
    expect(queryClient.getQueryData(ASSIGNED_KEY)).toEqual([])

    delayedAssignedRead.resolve([equipment])
    await staleRead

    expect(queryClient.getQueryData(ASSIGNED_KEY)).toEqual([])
  })

  it("removes a stale assigned row without decrementing count when zero rows are affected", async () => {
    const queryClient = createTestQueryClient()
    seedVisibleCaches(queryClient)
    const delayedReads = startDelayedExpandedReads(queryClient)
    await waitFor(() => {
      expect(queryClient.getQueryState(FILTERED_CATEGORY_LIST_KEY)?.fetchStatus).toBe("fetching")
      expect(queryClient.getQueryState(FILTERED_UNASSIGNED_KEY)?.fetchStatus).toBe("fetching")
    })
    const assignedBefore = queryClient.getQueryData<EquipmentPreviewItem[]>(ASSIGNED_KEY)!
    const primaryCategoriesBefore = queryClient.getQueryData<CategoryListItem[]>(CATEGORY_LIST_KEY)!
    const filteredCategoriesBefore = queryClient.getQueryData<CategoryListItem[]>(
      FILTERED_CATEGORY_LIST_KEY
    )!
    const staleOnlyCachesBefore = STALE_ONLY_CACHE_KEYS.map(
      (queryKey) => [queryKey, queryClient.getQueryData(queryKey)] as const
    )
    const cancelQueries = vi.spyOn(queryClient, "cancelQueries")
    const setQueryData = vi.spyOn(queryClient, "setQueryData")
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
    const fetchQuery = vi.spyOn(queryClient, "fetchQuery")
    const refetchQueries = vi.spyOn(queryClient, "refetchQueries")
    mockCallRpc.mockResolvedValue(0)

    await runUnassignment(queryClient)
    await delayedReads.settle()

    const assignedAfter = queryClient.getQueryData<EquipmentPreviewItem[]>(ASSIGNED_KEY)!
    expect(assignedAfter).not.toBe(assignedBefore)
    expect(assignedAfter).toEqual([])
    expect(queryClient.getQueryData(CATEGORY_LIST_KEY)).toBe(primaryCategoriesBefore)
    expect(queryClient.getQueryData(FILTERED_CATEGORY_LIST_KEY)).toBe(filteredCategoriesBefore)
    expect(primaryCategoriesBefore[1]).toMatchObject({ id: 5, so_luong_hien_co: 3 })
    for (const [queryKey, before] of staleOnlyCachesBefore) {
      expect(queryClient.getQueryData(queryKey)).toBe(before)
    }
    for (const queryKey of AFFECTED_QUERY_KEYS) {
      expect(cancelQueries).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey,
        })
      )
    }
    expectTenantScopedCancellations(cancelQueries.mock.calls)
    expect(Math.max(...cancelQueries.mock.invocationCallOrder)).toBeLessThan(
      Math.min(...setQueryData.mock.invocationCallOrder)
    )
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ASSIGNED_KEY,
        refetchType: "none",
      })
    )
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: CATEGORY_LIST_KEY,
        refetchType: "none",
      })
    )
    expect(queryClient.getQueryState(ASSIGNED_KEY)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(CATEGORY_LIST_KEY)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(FILTERED_CATEGORY_LIST_KEY)?.isInvalidated).toBe(true)
    for (const queryKey of STALE_ONLY_CACHE_KEYS) {
      expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(false)
    }
    expect(fetchQuery).not.toHaveBeenCalled()
    expect(refetchQueries).not.toHaveBeenCalled()
    expect(mockCallRpc).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Dữ liệu đã thay đổi",
        description: expect.stringMatching(/không còn thuộc danh mục/i),
      })
    )
    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(mockToast.mock.calls[0]?.[0]).not.toMatchObject({
      variant: "destructive",
    })
  })

  it("leaves caches unchanged and reports the mutation error", async () => {
    const queryClient = createTestQueryClient()
    seedVisibleCaches(queryClient)
    const cachesBefore = SEEDED_CACHE_KEYS.map(
      (queryKey) => [queryKey, queryClient.getQueryData(queryKey)] as const
    )
    const cancelQueries = vi.spyOn(queryClient, "cancelQueries")
    const setQueryData = vi.spyOn(queryClient, "setQueryData")
    const setQueriesData = vi.spyOn(queryClient, "setQueriesData")
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
    const fetchQuery = vi.spyOn(queryClient, "fetchQuery")
    const refetchQueries = vi.spyOn(queryClient, "refetchQueries")
    mockCallRpc.mockRejectedValue(new Error("unlink denied"))

    const rendered = renderHook(() => useUnassignmentUnderTest(), {
      wrapper: createReactQueryWrapper(queryClient),
    })

    await expect(
      act(async () => {
        await rendered.result.current.mutateAsync(VARIABLES)
      })
    ).rejects.toThrow("unlink denied")

    for (const [queryKey, before] of cachesBefore) {
      expect(queryClient.getQueryData(queryKey)).toBe(before)
    }
    expect(cancelQueries).not.toHaveBeenCalled()
    expect(setQueryData).not.toHaveBeenCalled()
    expect(setQueriesData).not.toHaveBeenCalled()
    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(fetchQuery).not.toHaveBeenCalled()
    expect(refetchQueries).not.toHaveBeenCalled()
    expect(mockCallRpc).toHaveBeenCalledTimes(1)
    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "dinh_muc_thiet_bi_unlink",
      args: {
        p_thiet_bi_ids: [101],
        p_nhom_id: 5,
        p_don_vi: 7,
      },
    })
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Không thể bỏ thiết bị khỏi danh mục",
        description: expect.stringMatching(/Vui lòng thử lại/i),
      })
    )
    expect(JSON.stringify(mockToast.mock.calls)).not.toContain("unlink denied")
  })
})
