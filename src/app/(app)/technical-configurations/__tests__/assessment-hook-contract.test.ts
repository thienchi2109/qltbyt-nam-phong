import { createElement, type PropsWithChildren } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ASSESSMENT_RPC_FUNCTIONS } from "@/lib/technical-configuration-assessment-rpcs"
import { useTechnicalConfigurationAssessments } from "../_hooks/useTechnicalConfigurationAssessments"
import {
  technicalConfigurationAssessmentsQueryKey,
  technicalConfigurationAssessmentsQueryKeyPrefix,
  technicalConfigurationOptionResponsesQueryKey,
} from "../technical-configuration-query-keys"
import {
  assessment,
  assessmentListResponse,
  assessmentUpsertInput,
  baselineVersionId,
  comparisonSet,
  comparisonSetId,
  criterionId,
  optionId,
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

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function createQueryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function renderAssessmentsHook(queryClient = createTestQueryClient()) {
  const hook = renderHook(
    () =>
      useTechnicalConfigurationAssessments({
        optionId,
        baselineVersionId,
        page: 1,
        pageSize: 25,
      }),
    { wrapper: createQueryWrapper(queryClient) }
  )
  return { ...hook, queryClient }
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
  })

  it("keeps an invalid assessment page disabled after the comparison set loads", async () => {
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    const queryClient = createTestQueryClient()
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationAssessments({
          optionId,
          baselineVersionId,
          page: 0,
          pageSize: 101,
        }),
      { wrapper: createQueryWrapper(queryClient) }
    )

    await waitFor(() => expect(result.current.comparisonSetQuery.isSuccess).toBe(true))
    expect(result.current.assessmentsQuery.fetchStatus).toBe("idle")
    expect(mocks.callRpc).not.toHaveBeenCalled()
  })

  it("publishes the first-save set before upsert and invalidates every cached page", async () => {
    mocks.readComparisonSet.mockResolvedValue(null)
    mocks.getOrCreateComparisonSet.mockResolvedValue(comparisonSet)
    const queryClient = createTestQueryClient()
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
    queryClient.setQueryData(secondPageQueryKey, assessmentListResponse)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        expect(queryClient.getQueryData(comparisonSetQueryKey)).toEqual(comparisonSet)
        return Promise.resolve({ data: assessment })
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return Promise.resolve(assessmentListResponse)
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
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
    expect(saved).toEqual({ comparisonSet, assessment })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSetId),
    })
    expect(queryClient.getQueryState(secondPageQueryKey)?.isInvalidated).toBe(true)
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
