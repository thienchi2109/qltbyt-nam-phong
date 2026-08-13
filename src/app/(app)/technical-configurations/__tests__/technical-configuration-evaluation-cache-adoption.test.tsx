import { act, renderHook, waitFor } from "@testing-library/react"
import { useQuery } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ASSESSMENT_RPC_FUNCTIONS } from "@/lib/technical-configuration-assessment-rpcs"
import { useTechnicalConfigurationAssessments } from "../_hooks/useTechnicalConfigurationAssessments"
import {
  technicalConfigurationAssessmentsQueryKeyPrefix,
  technicalConfigurationEvaluationCriteriaQueryKeyPrefix,
} from "../technical-configuration-query-keys"
import {
  createAssessmentQueryWrapper,
  createAssessmentTestQueryClient,
  renderAssessmentsHook,
  renderCompleteAssessmentsHook,
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
import {
  completeQueryKey,
  createDeferred,
  pinAssessmentCache,
} from "./technical-configuration-evaluation-cache-adoption-test-support"

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

function mockExistingSetSave() {
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
}

describe("P5C authoritative assessment cache adoption", () => {
  beforeEach(() => {
    mocks.callRpc.mockReset()
    mocks.getOrCreateComparisonSet.mockReset()
    mocks.readComparisonSet.mockReset()
  })

  it.each([
    ["loaded data", { [criterionId]: assessment }],
    ["loaded empty map", {}],
  ])("merges a saved assessment into a known-complete %s cache", async (_label, current) => {
    mockExistingSetSave()
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    queryClient.setQueryData(completeQueryKey(), current)
    const { result } = renderAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.assessmentsQuery.isSuccess).toBe(true))
    await act(async () => {
      await result.current.upsertAssessment.mutateAsync(assessmentUpsertInput)
    })

    expect(queryClient.getQueryData(completeQueryKey())).toEqual({
      ...current,
      [criterionId]: savedAssessment,
    })
  })

  it("seeds the authoritative cache when this save creates a known-absent comparison set", async () => {
    mocks.readComparisonSet.mockResolvedValue(null)
    mocks.getOrCreateComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string, args: { p_page_size?: number }) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        expect(args.p_page_size).toBe(100)
        return Promise.resolve({ ...assessmentListResponse, data: [], total: 0, page_size: 100 })
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return Promise.resolve({ data: savedAssessment })
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    const { result } = renderAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.comparisonSetQuery.isSuccess).toBe(true))
    await act(async () => {
      await result.current.upsertAssessment.mutateAsync(assessmentUpsertInput)
    })

    expect(queryClient.getQueryData(completeQueryKey())).toEqual({
      [criterionId]: savedAssessment,
    })
  })

  it("preserves concurrent assessments created after the known-absent read", async () => {
    const concurrentAssessment = {
      ...assessment,
      id: "00000000-0000-0000-0000-000000000007",
      criterion_id: "00000000-0000-0000-0000-000000000008",
    }
    mocks.readComparisonSet.mockResolvedValue(null)
    mocks.getOrCreateComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string, args: { p_page_size?: number }) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        expect(args.p_page_size).toBe(100)
        return Promise.resolve({
          ...assessmentListResponse,
          data: [concurrentAssessment],
          page_size: 100,
        })
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return Promise.resolve({ data: savedAssessment })
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    const { result } = renderAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.comparisonSetQuery.isSuccess).toBe(true))
    await act(async () => {
      await result.current.upsertAssessment.mutateAsync(assessmentUpsertInput)
    })

    expect(queryClient.getQueryData(completeQueryKey())).toEqual({
      [concurrentAssessment.criterion_id]: concurrentAssessment,
      [criterionId]: savedAssessment,
    })
  })

  it("waits for a delayed known-absent snapshot before completing the save and refreshing aggregates", async () => {
    const listDeferred = createDeferred<typeof assessmentListResponse>()
    mocks.readComparisonSet.mockResolvedValue(null)
    mocks.getOrCreateComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return listDeferred.promise
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return Promise.resolve({ data: savedAssessment })
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    const assessmentInvalidationSnapshots: unknown[] = []
    const assessmentQueryPrefix = technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSetId)
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async (filters) => {
      const queryKey = filters?.queryKey
      if (
        Array.isArray(queryKey) &&
        assessmentQueryPrefix.every((part, index) => queryKey[index] === part)
      ) {
        assessmentInvalidationSnapshots.push(queryClient.getQueryData(completeQueryKey()))
      }
    })
    const { result } = renderAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.comparisonSetQuery.isSuccess).toBe(true))
    let saveSettled = false
    let savePromise!: Promise<unknown>
    await act(async () => {
      savePromise = result.current.upsertAssessment
        .mutateAsync(assessmentUpsertInput)
        .finally(() => {
          saveSettled = true
        })
      await Promise.resolve()
    })

    expect(queryClient.getQueryData(completeQueryKey())).toBeUndefined()
    expect(assessmentInvalidationSnapshots).toEqual([])
    expect(saveSettled).toBe(false)

    await act(async () => {
      listDeferred.resolve({ ...assessmentListResponse, data: [], total: 0, page_size: 100 })
      await savePromise
    })

    expect(assessmentInvalidationSnapshots).toEqual([
      {
        [criterionId]: savedAssessment,
      },
    ])
    expect(queryClient.getQueryData(completeQueryKey())).toEqual({
      [criterionId]: savedAssessment,
    })
  })

  it("does not replace a newer cached revision when an older known-absent save settles later", async () => {
    const listDeferred = createDeferred<typeof assessmentListResponse>()
    const upsertDeferred = createDeferred<{ data: typeof savedAssessment }>()
    const newerAssessment = {
      ...savedAssessment,
      revision: savedAssessment.revision + 1,
      notes: "newer save",
    }
    mocks.readComparisonSet.mockResolvedValue(null)
    mocks.getOrCreateComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return listDeferred.promise
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return upsertDeferred.promise
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()
    const { result } = renderAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.comparisonSetQuery.isSuccess).toBe(true))
    let savePromise!: Promise<unknown>
    await act(async () => {
      savePromise = result.current.upsertAssessment.mutateAsync(assessmentUpsertInput)
      await Promise.resolve()
    })

    await act(async () => {
      queryClient.setQueryData(completeQueryKey(), {
        [criterionId]: newerAssessment,
      })
      listDeferred.resolve({ ...assessmentListResponse, data: [], total: 0, page_size: 100 })
      upsertDeferred.resolve({ data: savedAssessment })
      await savePromise
    })

    expect(queryClient.getQueryData(completeQueryKey())).toEqual({
      [criterionId]: newerAssessment,
    })
  })

  it("continues the save without seeding when the known-absent complete load fails", async () => {
    mocks.readComparisonSet.mockResolvedValue(null)
    mocks.getOrCreateComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return Promise.reject(new Error("complete cache unavailable"))
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return Promise.resolve({ data: savedAssessment })
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    const { result } = renderAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.comparisonSetQuery.isSuccess).toBe(true))
    await expect(
      act(async () => result.current.upsertAssessment.mutateAsync(assessmentUpsertInput))
    ).resolves.toEqual({ comparisonSet, assessment: savedAssessment })
    expect(queryClient.getQueryData(completeQueryKey())).toBeUndefined()
  })

  it("does not promote an unavailable existing complete cache from one saved row", async () => {
    mockExistingSetSave()
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    const { result } = renderAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.assessmentsQuery.isSuccess).toBe(true))
    await act(async () => {
      await result.current.upsertAssessment.mutateAsync(assessmentUpsertInput)
    })

    expect(
      mocks.callRpc.mock.calls.filter(
        ([fn, args]) => fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments && args.p_page_size === 100
      )
    ).toHaveLength(0)
    expect(queryClient.getQueryData(completeQueryKey())).toBeUndefined()
  })

  it("does not promote a loading existing complete cache from one saved row", async () => {
    const listDeferred = createDeferred<typeof assessmentListResponse>()
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return listDeferred.promise
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        expect(
          mocks.callRpc.mock.calls.filter(
            ([calledFn]) => calledFn === ASSESSMENT_RPC_FUNCTIONS.listAssessments
          )
        ).toHaveLength(1)
        return Promise.resolve({ data: savedAssessment })
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()
    const { result } = renderCompleteAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.completeAssessmentsQuery.isFetching).toBe(true))
    await act(async () => {
      await result.current.upsertAssessment.mutateAsync(assessmentUpsertInput)
    })

    expect(queryClient.getQueryData(completeQueryKey())).toBeUndefined()
    listDeferred.resolve(assessmentListResponse)
  })

  it("does not promote a failed existing complete cache from one saved row", async () => {
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return Promise.reject(new Error("complete cache unavailable"))
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        expect(
          mocks.callRpc.mock.calls.filter(
            ([calledFn]) => calledFn === ASSESSMENT_RPC_FUNCTIONS.listAssessments
          )
        ).toHaveLength(1)
        return Promise.resolve({ data: savedAssessment })
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()
    const { result } = renderCompleteAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.completeAssessmentsQuery.isError).toBe(true))
    await act(async () => {
      await result.current.upsertAssessment.mutateAsync(assessmentUpsertInput)
    })

    expect(queryClient.getQueryData(completeQueryKey())).toBeUndefined()
  })

  it("retains the full authoritative cache when its post-save refetch fails", async () => {
    const otherAssessment = {
      ...assessment,
      id: "00000000-0000-0000-0000-000000000007",
      criterion_id: "00000000-0000-0000-0000-000000000008",
    }
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return Promise.reject(new Error("complete cache refresh failed"))
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return Promise.resolve({ data: savedAssessment })
      }
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    })
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    queryClient.setQueryData(completeQueryKey(), {
      [criterionId]: assessment,
      [otherAssessment.criterion_id]: otherAssessment,
    })
    const { result } = renderCompleteAssessmentsHook(queryClient)

    await waitFor(() => expect(result.current.completeAssessmentsQuery.isSuccess).toBe(true))
    await act(async () => {
      await result.current.upsertAssessment.mutateAsync(assessmentUpsertInput)
    })
    await waitFor(() => expect(result.current.completeAssessmentsQuery.isError).toBe(true))

    expect(queryClient.getQueryData(completeQueryKey())).toEqual({
      [criterionId]: savedAssessment,
      [otherAssessment.criterion_id]: otherAssessment,
    })
    expect(result.current.completeAssessmentsQuery.refetch).toEqual(expect.any(Function))
  })

  it("keeps authoritative aggregate data and exposes retry when filtered refresh fails", async () => {
    mockExistingSetSave()
    const filteredQueryKey = [
      ...technicalConfigurationEvaluationCriteriaQueryKeyPrefix(optionId, baselineVersionId),
      "all",
    ] as const
    const filteredQueryFn = vi
      .fn()
      .mockResolvedValueOnce("initial")
      .mockRejectedValueOnce(new Error("filtered refresh failed"))
      .mockResolvedValueOnce("retried")
    const queryClient = createAssessmentTestQueryClient()
    pinAssessmentCache(queryClient)
    queryClient.setQueryData(completeQueryKey(), { [criterionId]: assessment })
    const { result } = renderHook(
      () => ({
        assessments: useTechnicalConfigurationAssessments({
          optionId,
          baselineVersionId,
          page: 1,
          pageSize: 25,
        }),
        filteredQuery: useQuery({
          queryKey: filteredQueryKey,
          queryFn: filteredQueryFn,
          retry: false,
        }),
      }),
      { wrapper: createAssessmentQueryWrapper(queryClient) }
    )

    await waitFor(() => expect(result.current.filteredQuery.isSuccess).toBe(true))
    await act(async () => {
      await result.current.assessments.upsertAssessment.mutateAsync(assessmentUpsertInput)
    })
    await waitFor(() => expect(result.current.filteredQuery.isError).toBe(true))

    expect(queryClient.getQueryData(completeQueryKey())).toEqual({
      [criterionId]: savedAssessment,
    })
    expect(result.current.filteredQuery.refetch).toEqual(expect.any(Function))

    await act(async () => {
      await result.current.filteredQuery.refetch()
    })
    await waitFor(() => expect(result.current.filteredQuery.data).toBe("retried"))
  })
})
