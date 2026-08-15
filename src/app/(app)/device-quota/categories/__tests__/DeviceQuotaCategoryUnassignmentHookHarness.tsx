import { type QueryClient, type UseMutationResult } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"

import { createReactQueryWrapper } from "@/test-utils/react-query"
import * as categoryAssignmentHooks from "../_hooks/useDeviceQuotaCategoryAssignment"
import { type UnassignmentVariables, VARIABLES } from "./DeviceQuotaCategoryUnassignmentTestSupport"

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
