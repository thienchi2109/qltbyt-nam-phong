import {
  getEvaluationDraftMocks,
  mockExistingAssessmentSave,
  renderEvaluationDraftHook,
  resetEvaluationDraftMocks,
} from "./evaluation-draft-test-support"

import { act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ASSESSMENT_RPC_FUNCTIONS } from "@/lib/technical-configuration-assessment-rpcs"
import type { TechnicalConfigurationAssessmentListWireResponse } from "../assessment-types"
import {
  assessment,
  baselineVersionId,
  comparisonSet,
  comparisonSetId,
  criterionId,
  optionId,
  savedAssessment,
} from "./assessment-test-fixtures"

const mocks = getEvaluationDraftMocks()
const otherComparisonSetId = "00000000-0000-0000-0000-000000000010"

describe("P12A1 evaluation draft state", () => {
  beforeEach(() => resetEvaluationDraftMocks(mocks))

  it("consumes the P11D complete collection and adopts successful save locally", async () => {
    const onDossierRevisionChange = vi.fn()
    mockExistingAssessmentSave(mocks)

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
    expect(onDossierRevisionChange).not.toHaveBeenCalled()
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

  it("saves the latest draft update when editing and saving in one turn", async () => {
    mockExistingAssessmentSave(mocks)

    const { result } = renderEvaluationDraftHook()

    await waitFor(() => expect(result.current.isReady).toBe(true))

    await act(async () => {
      result.current.setTechnicalAxis("exceeds")
      result.current.setEvidenceAxis("complete")
      result.current.setNotes("Nội dung vừa cập nhật.")
      await result.current.save()
    })

    expect(mocks.callRpc).toHaveBeenCalledWith(
      ASSESSMENT_RPC_FUNCTIONS.upsertAssessment,
      {
        p_comparison_set_id: comparisonSetId,
        p_criterion_id: criterionId,
        p_technical_axis: "exceeds",
        p_evidence_axis: "complete",
        p_notes: "Nội dung vừa cập nhật.",
        p_expected_revision: assessment.revision,
      },
      { signal: undefined }
    )
  })

  it("discards the current dirty draft back to the persisted assessment", async () => {
    mockExistingAssessmentSave(mocks)
    const { result } = renderEvaluationDraftHook()

    await waitFor(() => expect(result.current.isReady).toBe(true))

    act(() => {
      result.current.setTechnicalAxis("fails")
      result.current.setEvidenceAxis("none")
      result.current.setNotes("Nháp sẽ bỏ.")
    })
    expect(result.current.draft).toMatchObject({
      technicalAxis: "fails",
      evidenceAxis: "none",
      notes: "Nháp sẽ bỏ.",
      isDirty: true,
    })

    act(() => {
      result.current.discard()
    })

    expect(result.current.draft).toMatchObject({
      technicalAxis: "meets",
      evidenceAxis: "partial",
      notes: "Cần bổ sung chứng cứ.",
      isDirty: false,
    })
  })

  it("rejects a misrouted assessment row and preserves the local draft", async () => {
    const onDossierRevisionChange = vi.fn()
    const misroutedAssessment = {
      ...savedAssessment,
      comparison_set_id: otherComparisonSetId,
    }
    mockExistingAssessmentSave(mocks, misroutedAssessment)

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

  it("keeps the first-save draft while the newly created comparison set starts loading", async () => {
    const onDossierRevisionChange = vi.fn()
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

    const { result } = renderEvaluationDraftHook(onDossierRevisionChange)

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
    expect(onDossierRevisionChange).toHaveBeenCalledWith(7)
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

  it("propagates the acquired comparison-set revision when assessment upsert fails", async () => {
    const onDossierRevisionChange = vi.fn()
    const persistenceError = new Error("assessment persistence failed")
    mocks.readComparisonSet.mockResolvedValue(null)
    mocks.getOrCreateComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string) => {
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
        return Promise.resolve({
          data: [],
          total: 0,
          page: 1,
          page_size: 100,
        })
      }
      if (fn === ASSESSMENT_RPC_FUNCTIONS.upsertAssessment) {
        return Promise.reject(persistenceError)
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    const { result } = renderEvaluationDraftHook(onDossierRevisionChange)

    await waitFor(() => expect(result.current.isReady).toBe(true))
    act(() => {
      result.current.setTechnicalAxis("meets")
      result.current.setEvidenceAxis("partial")
    })

    await act(async () => {
      await expect(result.current.save()).rejects.toBe(persistenceError)
    })

    expect(onDossierRevisionChange).toHaveBeenCalledWith(comparisonSet.revision)
    expect(result.current.draft).toMatchObject({
      isDirty: true,
      error: persistenceError,
    })
  })
})
