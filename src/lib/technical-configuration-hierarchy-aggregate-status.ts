import {
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES,
  type TechnicalConfigurationDerivedStatus,
} from "@/lib/technical-configuration-evaluation"

/** Stable aggregate states derived for section and subgroup structural rows. */
export const TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_VALUES = [
  "no_criteria",
  "failed",
  "in_progress",
  "needs_clarification",
  "not_applicable",
  "passed",
] as const

export type TechnicalConfigurationAggregateStatus =
  (typeof TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_VALUES)[number]

/** Vietnamese display labels for hierarchy aggregate states. */
export const TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_LABELS = {
  no_criteria: "Chưa có tiêu chí",
  failed: "Không đạt",
  in_progress: "Đang đánh giá",
  needs_clarification: "Cần làm rõ",
  not_applicable: "Không áp dụng",
  passed: "Đạt",
} as const satisfies Record<TechnicalConfigurationAggregateStatus, string>

export type TechnicalConfigurationDerivedStatusCounts = Readonly<
  Record<TechnicalConfigurationDerivedStatus, number>
>

export type TechnicalConfigurationAggregateSubgroupInput = Readonly<{
  id: string
  criterionIds: readonly string[]
}>

export type TechnicalConfigurationAggregateSectionInput = Readonly<{
  id: string
  criterionIds: readonly string[]
  subgroups: readonly TechnicalConfigurationAggregateSubgroupInput[]
}>

export type TechnicalConfigurationStructuralAggregate = Readonly<{
  id: string
  status: TechnicalConfigurationAggregateStatus
  descendantCriterionIds: readonly string[]
  descendantCount: number
  statusCounts: TechnicalConfigurationDerivedStatusCounts
}>

export type TechnicalConfigurationSectionAggregate = TechnicalConfigurationStructuralAggregate &
  Readonly<{
    subgroups: readonly TechnicalConfigurationStructuralAggregate[]
  }>

export type TechnicalConfigurationAggregateLeafCriterion = Readonly<{
  criterionId: string
  status: TechnicalConfigurationDerivedStatus
}>

export type TechnicalConfigurationHierarchyAggregateStatusModel = Readonly<{
  criterionIds: readonly string[]
  leafCriteria: readonly TechnicalConfigurationAggregateLeafCriterion[]
  statusCounts: TechnicalConfigurationDerivedStatusCounts
  sections: readonly TechnicalConfigurationSectionAggregate[]
}>

type BuildTechnicalConfigurationHierarchyAggregateStatusInput = Readonly<{
  sections: readonly TechnicalConfigurationAggregateSectionInput[]
  statusByCriterionId: ReadonlyMap<string, TechnicalConfigurationDerivedStatus>
}>

function uniqueCriterionIds(criterionIds: readonly string[]): string[] {
  return [...new Set(criterionIds)]
}

function createEmptyStatusCounts(): Record<TechnicalConfigurationDerivedStatus, number> {
  return Object.fromEntries(
    TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES.map((status) => [status, 0])
  ) as Record<TechnicalConfigurationDerivedStatus, number>
}

function isTechnicalConfigurationDerivedStatus(
  value: unknown
): value is TechnicalConfigurationDerivedStatus {
  return (
    typeof value === "string" &&
    (TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES as readonly string[]).includes(value)
  )
}

function resolveTechnicalConfigurationDerivedStatus(
  criterionId: string,
  statusByCriterionId: ReadonlyMap<string, TechnicalConfigurationDerivedStatus>
): TechnicalConfigurationDerivedStatus {
  const status = statusByCriterionId.has(criterionId)
    ? statusByCriterionId.get(criterionId)
    : "not_evaluated"
  if (!isTechnicalConfigurationDerivedStatus(status)) {
    throw new Error(`Unsupported technical configuration derived status: ${String(status)}`)
  }
  return status
}

function buildLeafCriteria(
  criterionIds: readonly string[],
  statusByCriterionId: ReadonlyMap<string, TechnicalConfigurationDerivedStatus>
): TechnicalConfigurationAggregateLeafCriterion[] {
  return criterionIds.map((criterionId) => ({
    criterionId,
    status: resolveTechnicalConfigurationDerivedStatus(criterionId, statusByCriterionId),
  }))
}

function countLeafStatuses(
  leafCriteria: readonly TechnicalConfigurationAggregateLeafCriterion[]
): Record<TechnicalConfigurationDerivedStatus, number> {
  const statusCounts = createEmptyStatusCounts()
  for (const criterion of leafCriteria) {
    statusCounts[criterion.status] += 1
  }
  return statusCounts
}

function deriveAggregateStatus(
  descendantCount: number,
  statusCounts: TechnicalConfigurationDerivedStatusCounts
): TechnicalConfigurationAggregateStatus {
  if (descendantCount === 0) return "no_criteria"
  if (statusCounts.fails > 0) return "failed"
  if (statusCounts.not_evaluated > 0) return "in_progress"
  if (statusCounts.unclear > 0 || statusCounts.insufficient_evidence > 0) {
    return "needs_clarification"
  }
  if (statusCounts.not_applicable === descendantCount) return "not_applicable"

  const passingCount = statusCounts.meets + statusCounts.exceeds
  if (passingCount > 0 && passingCount + statusCounts.not_applicable === descendantCount) {
    return "passed"
  }

  throw new Error("Unsupported technical configuration aggregate status combination")
}

function buildStructuralAggregate(
  id: string,
  criterionIds: readonly string[],
  statusByCriterionId: ReadonlyMap<string, TechnicalConfigurationDerivedStatus>
): TechnicalConfigurationStructuralAggregate {
  const descendantCriterionIds = uniqueCriterionIds(criterionIds)
  const leafCriteria = buildLeafCriteria(descendantCriterionIds, statusByCriterionId)
  const statusCounts = countLeafStatuses(leafCriteria)

  return {
    id,
    status: deriveAggregateStatus(descendantCriterionIds.length, statusCounts),
    descendantCriterionIds,
    descendantCount: descendantCriterionIds.length,
    statusCounts,
  }
}

/** Builds unique leaf projections and structural rollups for one hierarchy snapshot. */
export function buildTechnicalConfigurationHierarchyAggregateStatus({
  sections,
  statusByCriterionId,
}: BuildTechnicalConfigurationHierarchyAggregateStatusInput): TechnicalConfigurationHierarchyAggregateStatusModel {
  const sectionAggregates = sections.map((section) => {
    const subgroups = section.subgroups.map((subgroup) =>
      buildStructuralAggregate(subgroup.id, subgroup.criterionIds, statusByCriterionId)
    )
    const descendantCriterionIds = uniqueCriterionIds([
      ...section.criterionIds,
      ...subgroups.flatMap((subgroup) => subgroup.descendantCriterionIds),
    ])

    return {
      ...buildStructuralAggregate(section.id, descendantCriterionIds, statusByCriterionId),
      subgroups,
    }
  })
  const criterionIds = uniqueCriterionIds(
    sectionAggregates.flatMap((section) => section.descendantCriterionIds)
  )
  const leafCriteria = buildLeafCriteria(criterionIds, statusByCriterionId)

  return {
    criterionIds,
    leafCriteria,
    statusCounts: countLeafStatuses(leafCriteria),
    sections: sectionAggregates,
  }
}
