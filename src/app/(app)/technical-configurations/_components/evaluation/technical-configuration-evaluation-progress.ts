import {
  deriveTechnicalConfigurationEvaluationStatus,
  type TechnicalConfigurationDerivedStatus,
} from "@/lib/technical-configuration-evaluation"
import {
  buildTechnicalConfigurationHierarchyAggregateStatus,
  type TechnicalConfigurationAggregateStatus,
  type TechnicalConfigurationDerivedStatusCounts,
} from "@/lib/technical-configuration-hierarchy-aggregate-status"

import type {
  TechnicalConfigurationAssessmentWire,
  TechnicalConfigurationEvaluationStatusFilter,
} from "@/app/(app)/technical-configurations/assessment-types"
import type { TechnicalConfigurationBaselineGroupWire } from "@/app/(app)/technical-configurations/baseline-types"
import {
  buildTechnicalConfigurationEvaluationHierarchySections,
  flattenTechnicalConfigurationEvaluationLeaves,
} from "./technical-configuration-evaluation-hierarchy"

/** Compact progress for one canonical baseline group. */
export type TechnicalConfigurationEvaluationGroupProgress = Readonly<{
  id: string
  name: string
  total: number
  evaluated: number
}>

export type TechnicalConfigurationEvaluationSubgroupAggregateProgress = Readonly<{
  id: string
  name: string
  sortOrder: number
  total: number
  evaluated: number
  status: TechnicalConfigurationAggregateStatus
  statusCounts: TechnicalConfigurationDerivedStatusCounts
}>

export type TechnicalConfigurationEvaluationSectionAggregateProgress = Readonly<{
  id: string
  name: string
  sortOrder: number
  total: number
  evaluated: number
  status: TechnicalConfigurationAggregateStatus
  statusCounts: TechnicalConfigurationDerivedStatusCounts
  subgroups: readonly TechnicalConfigurationEvaluationSubgroupAggregateProgress[]
}>

/** Full-universe progress for the currently selected option. */
export type TechnicalConfigurationEvaluationProgress = Readonly<{
  total: number
  evaluated: number
  statusCounts: Readonly<Record<TechnicalConfigurationDerivedStatus, number>>
  groups: readonly TechnicalConfigurationEvaluationGroupProgress[]
  hierarchy: readonly TechnicalConfigurationEvaluationSectionAggregateProgress[]
}>

export type TechnicalConfigurationEvaluationFilterCounts = Readonly<
  Record<TechnicalConfigurationEvaluationStatusFilter, number>
>

type BuildTechnicalConfigurationEvaluationProgressInput = Readonly<{
  groups: readonly TechnicalConfigurationBaselineGroupWire[]
  assessments: readonly TechnicalConfigurationAssessmentWire[]
}>

function countEvaluated(statusCounts: TechnicalConfigurationDerivedStatusCounts): number {
  return (
    Object.values(statusCounts).reduce((sum, count) => sum + count, 0) - statusCounts.not_evaluated
  )
}

/** Maps full-universe progress to the stable status filter contract. */
export function buildTechnicalConfigurationEvaluationFilterCounts(
  progress: TechnicalConfigurationEvaluationProgress
): TechnicalConfigurationEvaluationFilterCounts {
  return {
    all: progress.total,
    not_evaluated: progress.statusCounts.not_evaluated,
    fails: progress.statusCounts.fails,
    insufficient_evidence: progress.statusCounts.insufficient_evidence,
  }
}

/** Reconciles complete assessments by criterion ID against one locked baseline universe. */
export function buildTechnicalConfigurationEvaluationProgress({
  groups,
  assessments,
}: BuildTechnicalConfigurationEvaluationProgressInput): TechnicalConfigurationEvaluationProgress {
  const leaves = flattenTechnicalConfigurationEvaluationLeaves(groups)
  const hierarchySections = buildTechnicalConfigurationEvaluationHierarchySections(groups, leaves)
  const assessmentsByCriterionId = new Map(
    assessments.map((assessment) => [assessment.criterion_id, assessment] as const)
  )
  const statusByCriterionId = new Map(
    leaves.map((leaf) => {
      const assessment = assessmentsByCriterionId.get(leaf.criterion.id)
      return [
        leaf.criterion.id,
        deriveTechnicalConfigurationEvaluationStatus(
          assessment?.technical_axis,
          assessment?.evidence_axis
        ),
      ] as const
    })
  )
  const aggregate = buildTechnicalConfigurationHierarchyAggregateStatus({
    sections: hierarchySections,
    statusByCriterionId,
  })
  const sectionById = new Map(aggregate.sections.map((section) => [section.id, section]))
  const hierarchy = hierarchySections.map((section) => {
    const sectionAggregate = sectionById.get(section.id)
    if (!sectionAggregate) throw new Error(`Missing aggregate section ${section.id}`)
    const subgroupById = new Map(
      sectionAggregate.subgroups.map((subgroup) => [subgroup.id, subgroup])
    )

    return {
      id: section.id,
      name: section.name,
      sortOrder: section.sortOrder,
      total: sectionAggregate.descendantCount,
      evaluated: countEvaluated(sectionAggregate.statusCounts),
      status: sectionAggregate.status,
      statusCounts: sectionAggregate.statusCounts,
      subgroups: section.subgroups.map((subgroup) => {
        const subgroupAggregate = subgroupById.get(subgroup.id)
        if (!subgroupAggregate) {
          throw new Error(`Missing aggregate subgroup ${subgroup.id}`)
        }
        return {
          id: subgroup.id,
          name: subgroup.name,
          sortOrder: subgroup.sortOrder,
          total: subgroupAggregate.descendantCount,
          evaluated: countEvaluated(subgroupAggregate.statusCounts),
          status: subgroupAggregate.status,
          statusCounts: subgroupAggregate.statusCounts,
        }
      }),
    }
  })

  return {
    total: aggregate.criterionIds.length,
    evaluated: countEvaluated(aggregate.statusCounts),
    statusCounts: aggregate.statusCounts,
    groups: hierarchy.map((section) => ({
      id: section.id,
      name: section.name,
      total: section.total,
      evaluated: section.evaluated,
    })),
    hierarchy,
  }
}
