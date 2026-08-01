import { act, renderHook, waitFor } from "@testing-library/react"
import { useQuery } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ASSESSMENT_RPC_FUNCTIONS } from "@/lib/technical-configuration-assessment-rpcs"
import { useTechnicalConfigurationAssessments } from "../_hooks/useTechnicalConfigurationAssessments"
import {
  technicalConfigurationAssessmentsQueryKey,
  technicalConfigurationAssessmentsQueryKeyPrefix,
  technicalConfigurationEvaluationCriteriaQueryKeyPrefix,
  technicalConfigurationOptionResponsesQueryKey,
  technicalConfigurationReferenceRankingQueryKey,
} from "../technical-configuration-query-keys"
import {
  createAssessmentQueryWrapper,
  createAssessmentTestQueryClient,
  renderAssessmentsHook,
} from "./assessment-hook-test-support"
import {
  assessment,
  assessmentListResponse,
  assessmentUpsertInput,
  baselineVersionId,
  comparisonSet,
  comparisonSetId,
  criterionId,
  optionId,
  savedAssessment,
} from "./assessment-test-fixtures"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  getOrCreateComparisonSet: vi.fn(),
  readComparisonSet: vi.fn(),
}))

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: (...args: unknown[]) => mocks.callRpc(...args),
}))

vi.mock("../technical-configuration-option-response-operations", () => ({
  getOrCreateTechnicalConfigurationComparisonSet: (...args: unknown[]) =>
    mocks.getOrCreateComparisonSet(...args),
  readTechnicalConfigurationComparisonSet: (...args: unknown[]) => mocks.readComparisonSet(...args),
}))

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe("P11C assessment hook contract", () => {
  beforeEach(() => {
    mocks.callRpc.mockReset()
    mocks.getOrCreateComparisonSet.mockReset()
    mocks.readComparisonSet.mockReset()
  })

  it("keeps opening side-effect free when the nullable comparison set is absent", async () => {
    mocks.readComparisonSet.mockResolvedValue(null)

    const { result } = renderAssessmentsHook()

    await waitFor(() => expect(result.current.comparisonSetQuery.isSuccess).toBe(true))
    expect(mocks.readComparisonSet).toHaveBeenCalledWith(
      {
        p_option_id: optionId,
        p_baseline_version_id: baselineVersionId,
      },
      expect.any(AbortSignal)
    )
    expect(result.current.assessmentsQuery.fetchStatus).toBe("idle")
    expect(mocks.getOrCreateComparisonSet).not.toHaveBeenCalled()
    expect(mocks.callRpc).not.toHaveBeenCalled()
  })

  it("loads only the bounded assessment page when a comparison set exists", async () => {
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockResolvedValue(assessmentListResponse)

    const { result } = renderAssessmentsHook()

    await waitFor(() => expect(result.current.assessmentsQuery.isSuccess).toBe(true))
    expect(mocks.callRpc).toHaveBeenCalledWith(
      ASSESSMENT_RPC_FUNCTIONS.listAssessments,
      {
        p_comparison_set_id: comparisonSetId,
        p_page: 1,
        p_page_size: 25,
      },
      { signal: expect.any(AbortSignal) }
    )
    expect(mocks.callRpc).toHaveBeenCalledTimes(1)
  })

  it("does not synthesize a complete collection when bounded save has not loaded it", async () => {
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return Promise.resolve(assessmentListResponse)
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return Promise.resolve({ data: savedAssessment })
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const queryClient = createAssessmentTestQueryClient()
    const completeQueryKey = [
      ...technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSetId),
      "complete",
    ] as const
    const { result } = renderAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.assessmentsQuery.isSuccess).toBe(true))
    expect(queryClient.getQueryData(completeQueryKey)).toBeUndefined()

    await act(async () => {
      await result.current.upsertAssessment.mutateAsync(assessmentUpsertInput)
    })

    expect(queryClient.getQueryData(completeQueryKey)).toBeUndefined()
  })

  it("keeps an invalid assessment page disabled after the comparison set loads", async () => {
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    const queryClient = createAssessmentTestQueryClient()
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationAssessments({
          optionId,
          baselineVersionId,
          page: 0,
          pageSize: 101,
        }),
      { wrapper: createAssessmentQueryWrapper(queryClient) }
    )

    await waitFor(() => expect(result.current.comparisonSetQuery.isSuccess).toBe(true))
    expect(result.current.assessmentsQuery.fetchStatus).toBe("idle")
    expect(mocks.callRpc).not.toHaveBeenCalled()
  })

  it("publishes the first-save set before upsert and refreshes the affected caches", async () => {
    mocks.readComparisonSet.mockResolvedValue(null)
    mocks.getOrCreateComparisonSet.mockResolvedValue(comparisonSet)
    const queryClient = createAssessmentTestQueryClient()
    queryClient.setQueryDefaults(technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSetId), {
      gcTime: Infinity,
    })
    const comparisonSetQueryKey = technicalConfigurationOptionResponsesQueryKey(
      optionId,
      baselineVersionId
    )
    const secondPageQueryKey = technicalConfigurationAssessmentsQueryKey({
      comparisonSetId,
      page: 2,
      pageSize: 25,
    })
    const completeQueryKey = [
      ...technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSetId),
      "complete",
    ] as const
    queryClient.setQueryData(secondPageQueryKey, assessmentListResponse)
    queryClient.setQueryData(completeQueryKey, { [criterionId]: assessment })
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        expect(queryClient.getQueryData(comparisonSetQueryKey)).toEqual(comparisonSet)
        return Promise.resolve({ data: savedAssessment })
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return Promise.resolve(assessmentListResponse)
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const originalInvalidateQueries = queryClient.invalidateQueries.bind(queryClient)
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockImplementation((filters, options) => {
        expect(queryClient.getQueryData(completeQueryKey)).toEqual({
          [criterionId]: savedAssessment,
        })
        return originalInvalidateQueries(filters, options)
      })
    const resetQueries = vi.spyOn(queryClient, "resetQueries")
    const { result } = renderAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.comparisonSetQuery.isSuccess).toBe(true))

    let saved: unknown
    await act(async () => {
      saved = await result.current.upsertAssessment.mutateAsync({
        ...assessmentUpsertInput,
        expectedRevision: 0,
      })
    })

    expect(mocks.getOrCreateComparisonSet).toHaveBeenCalledTimes(1)
    expect(mocks.getOrCreateComparisonSet).toHaveBeenCalledWith({
      p_option_id: optionId,
      p_baseline_version_id: baselineVersionId,
      p_expected_revision: assessmentUpsertInput.expectedDossierRevision,
    })
    expect(queryClient.getQueryData(comparisonSetQueryKey)).toEqual(comparisonSet)
    expect(mocks.callRpc).toHaveBeenCalledWith(
      ASSESSMENT_RPC_FUNCTIONS.upsertAssessment,
      {
        p_comparison_set_id: comparisonSetId,
        p_criterion_id: criterionId,
        p_technical_axis: "meets",
        p_evidence_axis: "partial",
        p_notes: "Cần bổ sung chứng cứ.",
        p_expected_revision: 0,
      },
      { signal: undefined }
    )
    expect(saved).toEqual({ comparisonSet, assessment: savedAssessment })
    expect(queryClient.getQueryData(completeQueryKey)).toEqual({
      [criterionId]: savedAssessment,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSetId),
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: technicalConfigurationEvaluationCriteriaQueryKeyPrefix(optionId, baselineVersionId),
    })
    expect(resetQueries).toHaveBeenCalledWith({
      queryKey: technicalConfigurationReferenceRankingQueryKey({
        dossierId: comparisonSet.dossier_id,
        baselineVersionId,
      }),
      exact: true,
    })
    expect(result.current.completeQueryKey).toEqual(completeQueryKey)
    expect(queryClient.getQueryState(secondPageQueryKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(completeQueryKey)?.isInvalidated).toBe(true)
  })

  it("does not wait for the optional ranking refresh before completing a successful save", async () => {
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return Promise.resolve(assessmentListResponse)
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return Promise.resolve({ data: savedAssessment })
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const queryClient = createAssessmentTestQueryClient()
    const rankingReset = createDeferred<void>()
    const resetQueries = vi
      .spyOn(queryClient, "resetQueries")
      .mockImplementation((filters) => (filters?.exact ? rankingReset.promise : Promise.resolve()))
    const rankingQueryKey = technicalConfigurationReferenceRankingQueryKey({
      dossierId: comparisonSet.dossier_id,
      baselineVersionId,
    })
    const { result } = renderAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.assessmentsQuery.isSuccess).toBe(true))

    let saveSettled = false
    let savePromise!: ReturnType<typeof result.current.upsertAssessment.mutateAsync>
    act(() => {
      savePromise = result.current.upsertAssessment
        .mutateAsync(assessmentUpsertInput)
        .finally(() => {
          saveSettled = true
        })
    })

    await waitFor(() =>
      expect(resetQueries).toHaveBeenCalledWith({
        queryKey: rankingQueryKey,
        exact: true,
      })
    )
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    const settledBeforeRankingRefresh = saveSettled

    rankingReset.resolve(undefined)
    await act(async () => {
      await savePromise
    })

    expect(settledBeforeRankingRefresh).toBe(true)
  })

  it("restarts a pending pre-save ranking before it can enter the cache", async () => {
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return Promise.resolve(assessmentListResponse)
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return Promise.resolve({ data: savedAssessment })
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const preSaveRanking = createDeferred<string>()
    const rankingQueryFn = vi
      .fn()
      .mockImplementationOnce(() => preSaveRanking.promise)
      .mockResolvedValue("post-save-ranking")
    const rankingQueryKey = technicalConfigurationReferenceRankingQueryKey({
      dossierId: comparisonSet.dossier_id,
      baselineVersionId,
    })
    const queryClient = createAssessmentTestQueryClient()
    const { result } = renderHook(
      () => {
        const rankingQuery = useQuery({
          queryKey: rankingQueryKey,
          queryFn: rankingQueryFn,
          retry: false,
        })
        const assessments = useTechnicalConfigurationAssessments({
          optionId,
          baselineVersionId,
          page: 1,
          pageSize: 25,
        })
        return { assessments, rankingQuery }
      },
      { wrapper: createAssessmentQueryWrapper(queryClient) }
    )

    await waitFor(() => expect(result.current.assessments.assessmentsQuery.isSuccess).toBe(true))
    await waitFor(() => expect(rankingQueryFn).toHaveBeenCalledTimes(1))
    await act(async () => {
      await result.current.assessments.upsertAssessment.mutateAsync(assessmentUpsertInput)
    })

    try {
      await waitFor(() => expect(rankingQueryFn).toHaveBeenCalledTimes(2))
    } finally {
      preSaveRanking.resolve("pre-save-ranking")
    }
    await waitFor(() => expect(result.current.rankingQuery.data).toBe("post-save-ranking"))
    await act(async () => {
      await preSaveRanking.promise
      await Promise.resolve()
    })

    expect(queryClient.getQueryData(rankingQueryKey)).toBe("post-save-ranking")
  })

  it("deduplicates comparison-set acquisition across simultaneous first saves", async () => {
    const comparisonSetDeferred = createDeferred<typeof comparisonSet>()
    mocks.readComparisonSet.mockResolvedValue(null)
    mocks.getOrCreateComparisonSet.mockReturnValue(comparisonSetDeferred.promise)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return Promise.resolve({ data: assessment })
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return Promise.resolve(assessmentListResponse)
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const { result } = renderAssessmentsHook()

    await waitFor(() => expect(result.current.comparisonSetQuery.isSuccess).toBe(true))

    let saves: Promise<unknown>[] = []
    act(() => {
      saves = [
        result.current.upsertAssessment.mutateAsync({
          ...assessmentUpsertInput,
          expectedRevision: 0,
        }),
        result.current.upsertAssessment.mutateAsync({
          ...assessmentUpsertInput,
          criterionId: "criterion-id-2",
          expectedRevision: 0,
        }),
      ]
    })

    await waitFor(() => expect(mocks.getOrCreateComparisonSet).toHaveBeenCalledTimes(1))

    comparisonSetDeferred.resolve(comparisonSet)
    await act(async () => {
      await Promise.all(saves)
    })

    expect(
      mocks.callRpc.mock.calls.filter(([fn]) => fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment)
    ).toHaveLength(2)
  })

  it("skips get-or-create for an existing set and preserves stale-revision identity", async () => {
    const staleRevision = Object.assign(new Error("stale_revision"), {
      code: "PT409",
      status: 409,
    })
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return Promise.resolve(assessmentListResponse)
      }
      return Promise.reject(staleRevision)
    })
    const { result } = renderAssessmentsHook()

    await waitFor(() => expect(result.current.assessmentsQuery.isSuccess).toBe(true))

    await expect(result.current.upsertAssessment.mutateAsync(assessmentUpsertInput)).rejects.toBe(
      staleRevision
    )
    expect(mocks.getOrCreateComparisonSet).not.toHaveBeenCalled()
  })
})
