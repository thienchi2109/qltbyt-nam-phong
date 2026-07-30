import {
  getEvaluationDraftMocks,
  hasAssessmentUpsertCall,
  resetEvaluationDraftMocks,
  useEvaluationDraftForTest,
} from "./evaluation-draft-test-support"

import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { ASSESSMENT_RPC_FUNCTIONS } from "@/lib/technical-configuration-assessment-rpcs"
import {
  createAssessmentQueryWrapper,
  createAssessmentTestQueryClient,
} from "./assessment-hook-test-support"
import {
  assessment,
  baselineVersionId,
  comparisonSet,
  criterionId,
  optionId,
  savedAssessment,
} from "./assessment-test-fixtures"

const mocks = getEvaluationDraftMocks()
const otherOptionId = "00000000-0000-0000-0000-000000000007"
const otherBaselineVersionId = "00000000-0000-0000-0000-000000000008"
const otherCriterionId = "00000000-0000-0000-0000-000000000009"

describe("P12A1 evaluation draft context switches", () => {
  beforeEach(() => resetEvaluationDraftMocks(mocks))

  it("rejects stale callbacks across option switches, including an A-B-A cycle", async () => {
    mocks.readComparisonSet
      .mockResolvedValueOnce(comparisonSet)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(comparisonSet)
    mocks.callRpc.mockResolvedValue({
      data: [assessment],
      total: 1,
      page: 1,
      page_size: 100,
    })

    const queryClient = createAssessmentTestQueryClient()
    const { result, rerender } = renderHook(
      ({ currentOptionId }) =>
        useEvaluationDraftForTest({
          optionId: currentOptionId,
          baselineVersionId,
          criterionId,
          expectedDossierRevision: 6,
        }),
      {
        initialProps: { currentOptionId: optionId },
        wrapper: createAssessmentQueryWrapper(queryClient),
      }
    )

    await waitFor(() => expect(result.current.isReady).toBe(true))
    const staleSetNotes = result.current.setNotes
    const staleSave = result.current.save

    rerender({ currentOptionId: otherOptionId })
    await waitFor(() =>
      expect(result.current.draft).toMatchObject({
        technicalAxis: null,
        evidenceAxis: null,
        notes: "",
        expectedAssessmentRevision: 0,
      })
    )
    act(() => {
      result.current.setNotes("Bản nháp của phương án mới.")
      staleSetNotes("Không được ghi đè.")
    })
    await act(async () => {
      await expect(staleSave()).rejects.toThrow(
        "technical_configuration_evaluation_save_unavailable"
      )
    })
    expect(result.current.draft).toMatchObject({
      notes: "Bản nháp của phương án mới.",
      isDirty: true,
    })

    rerender({ currentOptionId: optionId })
    await waitFor(() =>
      expect(result.current.draft).toMatchObject({
        notes: assessment.notes,
        expectedAssessmentRevision: assessment.revision,
      })
    )
    act(() => staleSetNotes("Callback A cũ không được khôi phục."))
    await expect(staleSave()).rejects.toThrow("technical_configuration_evaluation_save_unavailable")
    expect(result.current.draft).toMatchObject({
      notes: assessment.notes,
      isDirty: false,
    })
    expect(hasAssessmentUpsertCall(mocks.callRpc)).toBe(false)
  })

  it("starts a fresh draft when switching baselines for the same option and criterion", async () => {
    mocks.readComparisonSet.mockResolvedValueOnce(comparisonSet).mockResolvedValueOnce(null)
    mocks.callRpc.mockResolvedValue({
      data: [assessment],
      total: 1,
      page: 1,
      page_size: 100,
    })

    const queryClient = createAssessmentTestQueryClient()
    const { result, rerender } = renderHook(
      ({ currentBaselineVersionId }) =>
        useEvaluationDraftForTest({
          optionId,
          baselineVersionId: currentBaselineVersionId,
          criterionId,
          expectedDossierRevision: 6,
        }),
      {
        initialProps: { currentBaselineVersionId: baselineVersionId },
        wrapper: createAssessmentQueryWrapper(queryClient),
      }
    )

    await waitFor(() => expect(result.current.isReady).toBe(true))
    rerender({ currentBaselineVersionId: otherBaselineVersionId })
    expect(result.current.draft).toBeNull()

    await waitFor(() =>
      expect(result.current.draft).toMatchObject({
        technicalAxis: null,
        evidenceAxis: null,
        notes: "",
        expectedAssessmentRevision: 0,
      })
    )
  })

  it("starts a fresh draft when switching criteria within one comparison set", async () => {
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockResolvedValue({
      data: [assessment],
      total: 1,
      page: 1,
      page_size: 100,
    })

    const queryClient = createAssessmentTestQueryClient()
    const { result, rerender } = renderHook(
      ({ currentCriterionId }) =>
        useEvaluationDraftForTest({
          optionId,
          baselineVersionId,
          criterionId: currentCriterionId,
          expectedDossierRevision: 6,
        }),
      {
        initialProps: { currentCriterionId: criterionId },
        wrapper: createAssessmentQueryWrapper(queryClient),
      }
    )

    await waitFor(() => expect(result.current.isReady).toBe(true))
    rerender({ currentCriterionId: otherCriterionId })

    expect(result.current.draft).toMatchObject({
      criterionId: otherCriterionId,
      technicalAxis: null,
      evidenceAxis: null,
      notes: "",
      expectedAssessmentRevision: 0,
    })
  })

  it("does not adopt a pending save into a newly selected option", async () => {
    let resolveSave!: (value: { data: typeof savedAssessment }) => void
    const pendingSave = new Promise<{ data: typeof savedAssessment }>((resolve) => {
      resolveSave = resolve
    })
    mocks.readComparisonSet.mockResolvedValueOnce(comparisonSet).mockResolvedValueOnce(null)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return Promise.resolve({
          data: [assessment],
          total: 1,
          page: 1,
          page_size: 100,
        })
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return pendingSave
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    const queryClient = createAssessmentTestQueryClient()
    const { result, rerender } = renderHook(
      ({ currentOptionId }) =>
        useEvaluationDraftForTest({
          optionId: currentOptionId,
          baselineVersionId,
          criterionId,
          expectedDossierRevision: 6,
        }),
      {
        initialProps: { currentOptionId: optionId },
        wrapper: createAssessmentQueryWrapper(queryClient),
      }
    )

    await waitFor(() => expect(result.current.isReady).toBe(true))
    act(() => {
      result.current.setNotes("Bản nháp của phương án cũ.")
    })

    let savePromise!: ReturnType<typeof result.current.save>
    await act(async () => {
      savePromise = result.current.save()
      await Promise.resolve()
    })
    expect(result.current.isSaving).toBe(true)

    rerender({ currentOptionId: otherOptionId })
    expect(result.current.isSaving).toBe(true)
    await expect(result.current.save()).rejects.toThrow(
      "technical_configuration_evaluation_save_unavailable"
    )
    await waitFor(() =>
      expect(result.current.draft).toMatchObject({
        technicalAxis: null,
        evidenceAxis: null,
        notes: "",
        expectedAssessmentRevision: 0,
      })
    )

    await act(async () => {
      resolveSave({ data: savedAssessment })
      await savePromise
    })

    expect(result.current.isSaving).toBe(false)
    expect(result.current.draft).toMatchObject({
      technicalAxis: null,
      evidenceAxis: null,
      notes: "",
      expectedAssessmentRevision: 0,
      isDirty: false,
    })
  })
})
