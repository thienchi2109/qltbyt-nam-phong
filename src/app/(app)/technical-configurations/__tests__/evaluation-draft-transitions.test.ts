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

describe("P12A1 evaluation draft transitions", () => {
  it("creates first-save revision zero and adopts both saved row and comparison-set revisions", () => {
    const initial = createTechnicalConfigurationEvaluationDraftState({
      criterionId,
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
})
