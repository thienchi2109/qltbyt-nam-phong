import { describe, expect, it } from "vitest"

import {
  adoptTechnicalConfigurationEvaluationSave,
  applyTechnicalConfigurationEvaluationSaveFailure,
  beginTechnicalConfigurationEvaluationSave,
  createTechnicalConfigurationEvaluationDraftState,
  toTechnicalConfigurationAssessmentUpsertInput,
  updateTechnicalConfigurationEvaluationDraft,
} from "../technical-configuration-evaluation-state"
import { assessment, comparisonSet, criterionId, savedAssessment } from "./assessment-test-fixtures"

const otherComparisonSetId = "00000000-0000-0000-0000-000000000010"
const otherCriterionId = "00000000-0000-0000-0000-000000000011"

describe("P12A1 evaluation draft transitions", () => {
  it("creates first-save revision zero and adopts both saved row and comparison-set revisions", () => {
    const initial = createTechnicalConfigurationEvaluationDraftState({
      criterionId,
      comparisonSetId: null,
      assessment: null,
      expectedDossierRevision: 6,
    })
    const edited = updateTechnicalConfigurationEvaluationDraft(initial, {
      technicalAxis: "exceeds",
      evidenceAxis: "complete",
      notes: "Đã xác nhận.",
    })

    expect(toTechnicalConfigurationAssessmentUpsertInput(edited)).toEqual({
      criterionId,
      technicalAxis: "exceeds",
      evidenceAxis: "complete",
      notes: "Đã xác nhận.",
      expectedRevision: 0,
      expectedDossierRevision: 6,
    })

    const saving = beginTechnicalConfigurationEvaluationSave(edited)
    const saved = adoptTechnicalConfigurationEvaluationSave(saving, {
      comparisonSet,
      assessment: savedAssessment,
    })

    expect(saved).toMatchObject({
      criterionId,
      comparisonSetId: comparisonSet.id,
      technicalAxis: "exceeds",
      evidenceAxis: "complete",
      notes: "Đã xác nhận.",
      expectedAssessmentRevision: 3,
      expectedDossierRevision: 7,
      saveStatus: "idle",
      error: null,
      isDirty: false,
    })
  })

  it("allows both nullable axes to be cleared back to not evaluated", () => {
    const initial = createTechnicalConfigurationEvaluationDraftState({
      criterionId,
      comparisonSetId: comparisonSet.id,
      assessment,
      expectedDossierRevision: 6,
    })
    const cleared = updateTechnicalConfigurationEvaluationDraft(initial, {
      technicalAxis: null,
      evidenceAxis: null,
    })

    expect(cleared).toMatchObject({
      technicalAxis: null,
      evidenceAxis: null,
      isDirty: true,
    })
    expect(toTechnicalConfigurationAssessmentUpsertInput(cleared)).toMatchObject({
      technicalAxis: null,
      evidenceAxis: null,
    })
  })

  it.each([
    ["validation", Object.assign(new Error("validation_error"), { code: "PT422" })],
    ["authorization", Object.assign(new Error("permission_denied"), { code: "42501" })],
    ["conflict", Object.assign(new Error("stale_revision"), { code: "PT409" })],
    ["persistence", new Error("network_failure")],
  ])("preserves criterion and local input after %s failure", (_label, error) => {
    const initial = createTechnicalConfigurationEvaluationDraftState({
      criterionId,
      comparisonSetId: comparisonSet.id,
      assessment,
      expectedDossierRevision: 6,
    })
    const edited = updateTechnicalConfigurationEvaluationDraft(initial, {
      technicalAxis: "exceeds",
      evidenceAxis: "missing",
      notes: "Không được mất nội dung này.",
    })
    const failed = applyTechnicalConfigurationEvaluationSaveFailure(
      beginTechnicalConfigurationEvaluationSave(edited),
      error
    )

    expect(failed).toMatchObject({
      criterionId,
      technicalAxis: "exceeds",
      evidenceAxis: "missing",
      notes: "Không được mất nội dung này.",
      expectedAssessmentRevision: assessment.revision,
      expectedDossierRevision: 6,
      saveStatus: "error",
      error,
      isDirty: true,
    })
  })

  it.each([
    [
      "criterion",
      {
        criterionId,
        comparisonSetId: comparisonSet.id,
        assessment: { ...assessment, criterion_id: otherCriterionId },
        expectedDossierRevision: 6,
      },
      "technical_configuration_evaluation_assessment_criterion_mismatch",
    ],
    [
      "comparison set",
      {
        criterionId,
        comparisonSetId: otherComparisonSetId,
        assessment,
        expectedDossierRevision: 6,
      },
      "technical_configuration_evaluation_assessment_comparison_set_mismatch",
    ],
  ])("rejects a persisted assessment with mismatched %s identity", (_label, input, error) => {
    expect(() => createTechnicalConfigurationEvaluationDraftState(input)).toThrow(error)
  })

  it.each([
    [
      "draft comparison set",
      {
        comparisonSet: { ...comparisonSet, id: otherComparisonSetId },
        assessment: { ...savedAssessment, comparison_set_id: otherComparisonSetId },
      },
      "technical_configuration_evaluation_save_comparison_set_mismatch",
    ],
    [
      "result comparison set",
      {
        comparisonSet,
        assessment: { ...savedAssessment, comparison_set_id: otherComparisonSetId },
      },
      "technical_configuration_evaluation_save_result_comparison_set_mismatch",
    ],
    [
      "criterion",
      {
        comparisonSet,
        assessment: { ...savedAssessment, criterion_id: otherCriterionId },
      },
      "technical_configuration_evaluation_save_criterion_mismatch",
    ],
  ])("rejects a save result with mismatched %s identity", (_label, result, error) => {
    const initial = createTechnicalConfigurationEvaluationDraftState({
      criterionId,
      comparisonSetId: comparisonSet.id,
      assessment,
      expectedDossierRevision: 6,
    })

    expect(() => adoptTechnicalConfigurationEvaluationSave(initial, result)).toThrow(error)
  })
})
