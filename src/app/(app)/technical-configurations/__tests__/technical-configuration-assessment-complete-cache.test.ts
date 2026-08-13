import { describe, expect, it } from "vitest"

import { loadNewestCompleteAssessmentSnapshot } from "../_hooks/TechnicalConfigurationAssessmentCompleteCache"
import { assessment, criterionId, savedAssessment } from "./assessment-test-fixtures"
import { createAssessmentTestQueryClient } from "./assessment-hook-test-support"
import {
  completeQueryKey,
  createDeferred,
  pinAssessmentCache,
} from "./technical-configuration-evaluation-cache-adoption-test-support"

describe("technical configuration complete assessment cache", () => {
  it("drops a cascade-deleted assessment after the authoritative refetch", async () => {
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    queryClient.setQueryData(completeQueryKey(), { [criterionId]: assessment })

    expect(
      await loadNewestCompleteAssessmentSnapshot({
        queryClient,
        queryKey: completeQueryKey(),
        load: () => Promise.resolve({}),
      })
    ).toEqual({})
  })

  it("preserves an assessment inserted while the authoritative refetch is loading", async () => {
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    queryClient.setQueryData(completeQueryKey(), {})
    const snapshot = createDeferred<Record<string, never>>()
    const loadPromise = loadNewestCompleteAssessmentSnapshot({
      queryClient,
      queryKey: completeQueryKey(),
      load: () => snapshot.promise,
    })
    queryClient.setQueryData(completeQueryKey(), { [criterionId]: savedAssessment })
    snapshot.resolve({})

    await expect(loadPromise).resolves.toEqual({ [criterionId]: savedAssessment })
  })

  it("preserves a newer same-key revision written while the refetch is loading", async () => {
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    queryClient.setQueryData(completeQueryKey(), { [criterionId]: assessment })
    const snapshot = createDeferred<{ [criterionId]: typeof assessment }>()
    const loadPromise = loadNewestCompleteAssessmentSnapshot({
      queryClient,
      queryKey: completeQueryKey(),
      load: () => snapshot.promise,
    })
    queryClient.setQueryData(completeQueryKey(), { [criterionId]: savedAssessment })
    snapshot.resolve({ [criterionId]: assessment })

    await expect(loadPromise).resolves.toEqual({ [criterionId]: savedAssessment })
  })
})
