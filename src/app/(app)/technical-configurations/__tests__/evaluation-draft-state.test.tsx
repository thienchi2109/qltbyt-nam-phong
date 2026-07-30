import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ASSESSMENT_RPC_FUNCTIONS } from "@/lib/technical-configuration-assessment-rpcs"
import { useTechnicalConfigurationEvaluationDraft } from "../_hooks/useTechnicalConfigurationEvaluationDraft"
import type { TechnicalConfigurationAssessmentListWireResponse } from "../assessment-types"
import {
  createAssessmentQueryWrapper,
  createAssessmentTestQueryClient,
} from "./assessment-hook-test-support"
import {
  assessment,
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

const otherOptionId = "00000000-0000-0000-0000-000000000007"
const otherBaselineVersionId = "00000000-0000-0000-0000-000000000008"
const otherCriterionId = "00000000-0000-0000-0000-000000000009"
const otherComparisonSetId = "00000000-0000-0000-0000-000000000010"

function renderEvaluationDraftHook(onDossierRevisionChange?: (revision: number) => void) {
  const queryClient = createAssessmentTestQueryClient()
  return renderHook(
    () =>
      useTechnicalConfigurationEvaluationDraft({
        optionId,
        baselineVersionId,
        criterionId,
        expectedDossierRevision: 6,
        onDossierRevisionChange,
      }),
    { wrapper: createAssessmentQueryWrapper(queryClient) }
  )
}

describe("P12A1 evaluation draft state", () => {
  beforeEach(() => {
    mocks.callRpc.mockReset()
    mocks.getOrCreateComparisonSet.mockReset()
    mocks.readComparisonSet.mockReset()
  })

  it("consumes the P11D complete collection and adopts successful save locally", async () => {
    const onDossierRevisionChange = vi.fn()
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
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
        return Promise.resolve({ data: savedAssessment })
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    const { result } = renderEvaluationDraftHook(onDossierRevisionChange)

    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(result.current.assessmentsByCriterionId[criterionId]).toEqual(assessment)
    expect(mocks.getOrCreateComparisonSet).not.toHaveBeenCalled()
    expect(
      mocks.callRpc.mock.calls.some(
        ([fn, args]) =>
          fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments &&
          typeof args === "object" &&
          args !== null &&
          "p_comparison_set_id" in args &&
          args.p_comparison_set_id === comparisonSetId &&
          "p_page_size" in args &&
          args.p_page_size === 100
      )
    ).toBe(true)

    act(() => {
      result.current.setTechnicalAxis("exceeds")
      result.current.setEvidenceAxis("complete")
      result.current.setNotes("Đã xác nhận.")
    })

    await act(async () => {
      await result.current.save()
    })

    expect(result.current.draft).toMatchObject({
      technicalAxis: "exceeds",
      evidenceAxis: "complete",
      notes: "Đã xác nhận.",
      expectedAssessmentRevision: 3,
      expectedDossierRevision: 7,
      isDirty: false,
    })
    expect(onDossierRevisionChange).toHaveBeenCalledWith(7)
    expect(mocks.callRpc).toHaveBeenCalledWith(
      ASSESSMENT_RPC_FUNCTIONS.upsertAssessment,
      {
        p_comparison_set_id: comparisonSetId,
        p_criterion_id: criterionId,
        p_technical_axis: "exceeds",
        p_evidence_axis: "complete",
        p_notes: "Đã xác nhận.",
        p_expected_revision: assessment.revision,
      },
      { signal: undefined }
    )
  })

  it("rejects a misrouted assessment row and preserves the local draft", async () => {
    const onDossierRevisionChange = vi.fn()
    const misroutedAssessment = {
      ...savedAssessment,
      comparison_set_id: otherComparisonSetId,
    }
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
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
        return Promise.resolve({ data: misroutedAssessment })
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    const { result } = renderEvaluationDraftHook(onDossierRevisionChange)

    await waitFor(() => expect(result.current.isReady).toBe(true))
    act(() => {
      result.current.setNotes("Giữ bản nháp này.")
    })

    await act(async () => {
      await expect(result.current.save()).rejects.toThrow(
        "technical_configuration_evaluation_save_result_comparison_set_mismatch"
      )
    })

    expect(result.current.draft).toMatchObject({
      criterionId,
      comparisonSetId,
      notes: "Giữ bản nháp này.",
      expectedAssessmentRevision: assessment.revision,
      expectedDossierRevision: 6,
      saveStatus: "error",
      isDirty: true,
    })
    expect(onDossierRevisionChange).not.toHaveBeenCalled()
  })

  it("starts a fresh draft when switching options for the same criterion", async () => {
    mocks.readComparisonSet.mockResolvedValueOnce(comparisonSet).mockResolvedValueOnce(null)
    mocks.callRpc.mockResolvedValue({
      data: [assessment],
      total: 1,
      page: 1,
      page_size: 100,
    })

    const queryClient = createAssessmentTestQueryClient()
    const { result, rerender } = renderHook(
      ({ currentOptionId }) =>
        useTechnicalConfigurationEvaluationDraft({
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
    expect(result.current.draft).toMatchObject({
      technicalAxis: "meets",
      evidenceAxis: "partial",
      notes: "Cần bổ sung chứng cứ.",
    })

    rerender({ currentOptionId: otherOptionId })
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
        useTechnicalConfigurationEvaluationDraft({
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
        useTechnicalConfigurationEvaluationDraft({
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
        useTechnicalConfigurationEvaluationDraft({
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

  it("keeps the first-save draft while the newly created comparison set starts loading", async () => {
    let resolveAssessmentList!: (value: TechnicalConfigurationAssessmentListWireResponse) => void
    const pendingAssessmentList = new Promise<TechnicalConfigurationAssessmentListWireResponse>(
      (resolve) => {
        resolveAssessmentList = resolve
      }
    )
    mocks.readComparisonSet.mockResolvedValue(null)
    mocks.getOrCreateComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return pendingAssessmentList
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return Promise.resolve({ data: savedAssessment })
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    const { result } = renderEvaluationDraftHook()

    await waitFor(() => expect(result.current.isReady).toBe(true))
    expect(mocks.getOrCreateComparisonSet).not.toHaveBeenCalled()

    act(() => {
      result.current.setTechnicalAxis("exceeds")
      result.current.setEvidenceAxis("complete")
      result.current.setNotes("Đánh giá lần đầu.")
    })

    await act(async () => {
      await result.current.save()
    })

    expect(result.current.draft).toMatchObject({
      criterionId,
      technicalAxis: "exceeds",
      evidenceAxis: "complete",
      notes: "Đã xác nhận.",
      expectedAssessmentRevision: 3,
      expectedDossierRevision: 7,
      isDirty: false,
    })
    expect(mocks.getOrCreateComparisonSet).toHaveBeenCalledWith({
      p_option_id: optionId,
      p_baseline_version_id: baselineVersionId,
      p_expected_revision: 6,
    })
    expect(mocks.callRpc).toHaveBeenCalledWith(
      ASSESSMENT_RPC_FUNCTIONS.upsertAssessment,
      {
        p_comparison_set_id: comparisonSetId,
        p_criterion_id: criterionId,
        p_technical_axis: "exceeds",
        p_evidence_axis: "complete",
        p_notes: "Đánh giá lần đầu.",
        p_expected_revision: 0,
      },
      { signal: undefined }
    )

    await act(async () => {
      resolveAssessmentList({
        data: [savedAssessment],
        total: 1,
        page: 1,
        page_size: 100,
      })
      await pendingAssessmentList
    })
  })
})
