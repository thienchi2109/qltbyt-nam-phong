import {
  deriveTechnicalConfigurationEvaluationStatus,
  type TechnicalConfigurationDerivedStatus,
} from "@/lib/technical-configuration-evaluation"

import type { TechnicalConfigurationAssessmentWire } from "../../assessment-types"
import type { TechnicalConfigurationBaselineGroupWire } from "../../baseline-types"

/** Compact progress for one canonical baseline group. */
export type TechnicalConfigurationEvaluationGroupProgress = Readonly<{
  id: string
  name: string
  total: number
  evaluated: number
}>

/** Full-universe progress for the currently selected option. */
export type TechnicalConfigurationEvaluationProgress = Readonly<{
  total: number
  evaluated: number
  statusCounts: Readonly<Record<TechnicalConfigurationDerivedStatus, number>>
  groups: readonly TechnicalConfigurationEvaluationGroupProgress[]
}>

type BuildTechnicalConfigurationEvaluationProgressInput = Readonly<{
  groups: readonly TechnicalConfigurationBaselineGroupWire[]
  assessments: readonly TechnicalConfigurationAssessmentWire[]
}>

function createEmptyStatusCounts(): Record<TechnicalConfigurationDerivedStatus, number> {
  return {
    not_evaluated: 0,
    not_applicable: 0,
    fails: 0,
    unclear: 0,
    insufficient_evidence: 0,
    exceeds: 0,
    meets: 0,
  }
}

/** Reconciles complete assessments by criterion ID against one locked baseline universe. */
export function buildTechnicalConfigurationEvaluationProgress({
  groups,
  assessments,
}: BuildTechnicalConfigurationEvaluationProgressInput): TechnicalConfigurationEvaluationProgress {
  const assessmentsByCriterionId = new Map(
    assessments.map((assessment) => [assessment.criterion_id, assessment])
  )
  const statusCounts = createEmptyStatusCounts()
  let evaluated = 0

  const groupProgress = groups.map((group) => {
    let groupEvaluated = 0

    for (const criterion of group.criteria) {
      const assessment = assessmentsByCriterionId.get(criterion.id)
      const status = deriveTechnicalConfigurationEvaluationStatus(
        assessment?.technical_axis,
        assessment?.evidence_axis
      )
      statusCounts[status] += 1
      if (status !== "not_evaluated") {
        evaluated += 1
        groupEvaluated += 1
      }
    }

    return {
      id: group.id,
      name: group.name,
      total: group.criteria.length,
      evaluated: groupEvaluated,
    }
  })

  return {
    total: groupProgress.reduce((sum, group) => sum + group.total, 0),
    evaluated,
    statusCounts,
    groups: groupProgress,
  }
}
