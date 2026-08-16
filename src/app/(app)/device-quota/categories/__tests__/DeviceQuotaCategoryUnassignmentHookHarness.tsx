import { type QueryClient, type UseMutationResult } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { expect, vi } from "vitest"

import type { EquipmentPreviewItem } from "@/app/(app)/device-quota/_components/mapping-preview/MappingPreviewPrimitives"
import { callRpc } from "@/lib/rpc-client"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import type { CategoryListItem } from "../_types/categories"
import * as categoryAssignmentHooks from "../_hooks/useDeviceQuotaCategoryAssignment"
import {
  AFFECTED_QUERY_KEYS,
  AFFECTED_SEEDED_QUERY_KEYS,
  ASSIGNED_KEY,
  CATEGORY_LIST_KEY,
  createDeferred,
  FILTERED_CATEGORY_LIST_KEY,
  FILTERED_UNASSIGNED_KEY,
  OTHER_TENANT_CATEGORY_LIST_KEY,
  SEEDED_CACHE_KEYS,
  seedVisibleCaches,
  STALE_ONLY_CACHE_KEYS,
  startDelayedExpandedReads,
  type UnassignmentVariables,
  VARIABLES,
} from "./DeviceQuotaCategoryUnassignmentTestSupport"

type UseDeviceQuotaCategoryUnassignment = () => UseMutationResult<
  number,
  Error,
  UnassignmentVariables,
  unknown
>

const useUnassignmentCandidate = (
  categoryAssignmentHooks as typeof categoryAssignmentHooks & {
    useDeviceQuotaCategoryUnassignment?: UseDeviceQuotaCategoryUnassignment
  }
).useDeviceQuotaCategoryUnassignment

export function useUnassignmentUnderTest() {
  if (!useUnassignmentCandidate) {
    throw new Error("Phase 0 RED: useDeviceQuotaCategoryUnassignment has not been implemented")
  }
  return useUnassignmentCandidate()
}

export async function runUnassignment(queryClient: QueryClient) {
  const rendered = renderHook(() => useUnassignmentUnderTest(), {
    wrapper: createReactQueryWrapper(queryClient),
  })

  await act(async () => {
    await rendered.result.current.mutateAsync(VARIABLES)
  })

  return rendered
}

export function expectTenantScopedCancellations(calls: ReadonlyArray<readonly unknown[]>) {
  expect(calls).toHaveLength(AFFECTED_QUERY_KEYS.length)
  const actualQueryKeys: unknown[] = []
  for (const [candidate] of calls) {
    const filters = candidate as {
      exact?: boolean
      queryKey?: readonly unknown[]
    }
    expect(filters.exact).not.toBe(true)
    expect(filters.queryKey?.[1]).toMatchObject({ donViId: 7 })
    actualQueryKeys.push(filters.queryKey)
  }
  for (const expectedQueryKey of AFFECTED_QUERY_KEYS) {
    expect(actualQueryKeys).toContainEqual(expectedQueryKey)
  }
}

export function expectTenantCategoryListUpdater(calls: ReadonlyArray<readonly unknown[]>) {
  const matchingCalls = calls.filter(([candidate]) => {
    const filters = candidate as {
      exact?: boolean
      queryKey?: readonly unknown[]
    }
    return JSON.stringify(filters.queryKey) === JSON.stringify(CATEGORY_LIST_KEY)
  })

  expect(matchingCalls).not.toHaveLength(0)
  for (const [filters, updater] of matchingCalls) {
    expect(filters).not.toMatchObject({ exact: true })
    expect(updater).toEqual(expect.any(Function))
  }
}

export async function expectSuccessfulCacheReconciliation() {
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
  const mockCallRpc = vi.mocked(callRpc)
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
  expect(setQueryData).toHaveBeenCalledWith(ASSIGNED_KEY, expect.any(Function))
  expect(setQueriesData).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: CATEGORY_LIST_KEY }),
    expect.any(Function)
  )
  expectTenantCategoryListUpdater(setQueriesData.mock.calls)
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
  expect(queryClient.getQueryData(OTHER_TENANT_CATEGORY_LIST_KEY)).toBe(otherTenantCategoriesBefore)
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
}
