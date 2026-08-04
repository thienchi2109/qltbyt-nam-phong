import {
  deriveTechnicalConfigurationEvaluationStatus,
  type TechnicalConfigurationDerivedStatus,
} from "@/lib/technical-configuration-evaluation"

import type {
  TechnicalConfigurationAssessmentWire,
  TechnicalConfigurationEvaluationStatusFilter,
} from "../../assessment-types"
import type { TechnicalConfigurationBaselineGroupWire } from "../../baseline-types"
import { buildTechnicalConfigurationEvaluationProgress } from "./technical-configuration-evaluation-progress"

type EvaluationProjectionItem = Readonly<{
  criterion: Readonly<{ id: string }>
}>

type BuildTechnicalConfigurationEvaluationMatrixPresentationInput = Readonly<{
  groups: readonly TechnicalConfigurationBaselineGroupWire[]
  assessmentsByCriterionId: Readonly<Record<string, TechnicalConfigurationAssessmentWire>>
  projection: readonly EvaluationProjectionItem[]
  statusFilter: TechnicalConfigurationEvaluationStatusFilter
}>

type TechnicalConfigurationEvaluationMatrixPresentation = Readonly<{
  progress: ReturnType<typeof buildTechnicalConfigurationEvaluationProgress>
  assessmentStatusByCriterionId: ReadonlyMap<string, TechnicalConfigurationDerivedStatus>
  matchingEvaluationCriterionIds: ReadonlySet<string> | undefined
}>

/** Derives all matrix-facing assessment presentation from one assessment snapshot. */
export function buildTechnicalConfigurationEvaluationMatrixPresentation({
  groups,
  assessmentsByCriterionId,
  projection,
  statusFilter,
}: BuildTechnicalConfigurationEvaluationMatrixPresentationInput): TechnicalConfigurationEvaluationMatrixPresentation {
  const assessments = Object.values(assessmentsByCriterionId)
  const assessmentStatusByCriterionId = new Map<string, TechnicalConfigurationDerivedStatus>()

  for (const assessment of assessments) {
    assessmentStatusByCriterionId.set(
      assessment.criterion_id,
      deriveTechnicalConfigurationEvaluationStatus(
        assessment.technical_axis,
        assessment.evidence_axis
      )
    )
  }

  return {
    progress: buildTechnicalConfigurationEvaluationProgress({ groups, assessments }),
    assessmentStatusByCriterionId,
    matchingEvaluationCriterionIds:
      statusFilter === "all" ? undefined : new Set(projection.map((item) => item.criterion.id)),
  }
}
