import { technicalConfigurationAssessmentsQueryKeyPrefix } from "../technical-configuration-query-keys"
import { comparisonSetId } from "./assessment-test-fixtures"
import { createAssessmentTestQueryClient } from "./assessment-hook-test-support"

export function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

export function completeQueryKey(id = comparisonSetId) {
  return [...technicalConfigurationAssessmentsQueryKeyPrefix(id), "complete"] as const
}

export function pinAssessmentCache(
  queryClient: ReturnType<typeof createAssessmentTestQueryClient>
) {
  queryClient.setQueryDefaults(technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSetId), {
    gcTime: Infinity,
  })
}
