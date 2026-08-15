import { type QueryClient, type UseMutationResult } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { expect } from "vitest"

import { createReactQueryWrapper } from "@/test-utils/react-query"
import * as categoryAssignmentHooks from "../_hooks/useDeviceQuotaCategoryAssignment"
import {
  AFFECTED_QUERY_KEYS,
  CATEGORY_LIST_KEY,
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
