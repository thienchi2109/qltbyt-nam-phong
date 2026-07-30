import type {
  TechnicalConfigurationEvidenceAxis,
  TechnicalConfigurationTechnicalAxis,
} from "@/lib/technical-configuration-evaluation"

import type {
  TechnicalConfigurationAssessmentSaveResult,
  TechnicalConfigurationAssessmentUpsertInput,
  TechnicalConfigurationAssessmentWire,
} from "./assessment-types"

type TechnicalConfigurationEvaluationValues = {
  technicalAxis: TechnicalConfigurationTechnicalAxis | null
  evidenceAxis: TechnicalConfigurationEvidenceAxis | null
  notes: string
}

export type TechnicalConfigurationEvaluationDraftState = TechnicalConfigurationEvaluationValues & {
  criterionId: string
  expectedAssessmentRevision: number
  expectedDossierRevision: number
  saveStatus: "idle" | "saving" | "error"
  error: unknown | null
  isDirty: boolean
  persistedValues: TechnicalConfigurationEvaluationValues
}

type CreateTechnicalConfigurationEvaluationDraftStateInput = {
  criterionId: string
  assessment: TechnicalConfigurationAssessmentWire | null
  expectedDossierRevision: number
}

function toEvaluationValues(
  assessment: TechnicalConfigurationAssessmentWire | null
): TechnicalConfigurationEvaluationValues {
  return {
    technicalAxis: assessment?.technical_axis ?? null,
    evidenceAxis: assessment?.evidence_axis ?? null,
    notes: assessment?.notes ?? "",
  }
}

function hasEvaluationValuesChanged(
  values: TechnicalConfigurationEvaluationValues,
  persistedValues: TechnicalConfigurationEvaluationValues
): boolean {
  return (
    values.technicalAxis !== persistedValues.technicalAxis ||
    values.evidenceAxis !== persistedValues.evidenceAxis ||
    values.notes !== persistedValues.notes
  )
}

/** Creates one criterion-local manual assessment draft from the persisted row. */
export function createTechnicalConfigurationEvaluationDraftState({
  criterionId,
  assessment,
  expectedDossierRevision,
}: CreateTechnicalConfigurationEvaluationDraftStateInput): TechnicalConfigurationEvaluationDraftState {
  const persistedValues = toEvaluationValues(assessment)

  return {
    criterionId,
    ...persistedValues,
    expectedAssessmentRevision: assessment?.revision ?? 0,
    expectedDossierRevision,
    saveStatus: "idle",
    error: null,
    isDirty: false,
    persistedValues,
  }
}

/** Applies controlled field changes while preserving the persisted revision snapshot. */
export function updateTechnicalConfigurationEvaluationDraft(
  state: TechnicalConfigurationEvaluationDraftState,
  patch: Partial<TechnicalConfigurationEvaluationValues>
): TechnicalConfigurationEvaluationDraftState {
  if (state.saveStatus === "saving") return state

  const values = {
    technicalAxis: "technicalAxis" in patch ? (patch.technicalAxis ?? null) : state.technicalAxis,
    evidenceAxis: "evidenceAxis" in patch ? (patch.evidenceAxis ?? null) : state.evidenceAxis,
    notes: patch.notes ?? state.notes,
  }

  return {
    ...state,
    ...values,
    saveStatus: "idle",
    error: null,
    isDirty: hasEvaluationValuesChanged(values, state.persistedValues),
  }
}

/** Marks the current immutable save snapshot as pending. */
export function beginTechnicalConfigurationEvaluationSave(
  state: TechnicalConfigurationEvaluationDraftState
): TechnicalConfigurationEvaluationDraftState {
  return {
    ...state,
    saveStatus: "saving",
    error: null,
  }
}

/** Adopts canonical server values and both optimistic revision tokens after save. */
export function adoptTechnicalConfigurationEvaluationSave(
  state: TechnicalConfigurationEvaluationDraftState,
  result: TechnicalConfigurationAssessmentSaveResult
): TechnicalConfigurationEvaluationDraftState {
  if (result.assessment.criterion_id !== state.criterionId) {
    throw new Error("technical_configuration_evaluation_save_criterion_mismatch")
  }

  return createTechnicalConfigurationEvaluationDraftState({
    criterionId: state.criterionId,
    assessment: result.assessment,
    expectedDossierRevision: result.comparisonSet.revision,
  })
}

/** Records the exact failure while preserving criterion, input, and revision tokens. */
export function applyTechnicalConfigurationEvaluationSaveFailure(
  state: TechnicalConfigurationEvaluationDraftState,
  error: unknown
): TechnicalConfigurationEvaluationDraftState {
  return {
    ...state,
    saveStatus: "error",
    error,
  }
}

/** Builds the existing P11C upsert input without deriving or remapping assessment values. */
export function toTechnicalConfigurationAssessmentUpsertInput(
  state: TechnicalConfigurationEvaluationDraftState
): TechnicalConfigurationAssessmentUpsertInput {
  return {
    criterionId: state.criterionId,
    technicalAxis: state.technicalAxis,
    evidenceAxis: state.evidenceAxis,
    notes: state.notes,
    expectedRevision: state.expectedAssessmentRevision,
    expectedDossierRevision: state.expectedDossierRevision,
  }
}
