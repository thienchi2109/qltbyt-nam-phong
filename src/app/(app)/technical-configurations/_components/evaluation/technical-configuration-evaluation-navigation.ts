import type {
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineGroupWire,
} from "../../baseline-types"
import type { TechnicalConfigurationEvaluationCriterionWire } from "../../assessment-types"

export type TechnicalConfigurationEvaluationCriterionListItem = {
  group: {
    id: string
    name: string
    sortOrder: number
  }
  criterion: {
    id: string
    criterionCode: string
    title: string | null
    sortOrder: number
  }
  canonicalIndex: number
  canonicalPage: number
}

function toProjectionItem({
  group,
  criterion,
  canonicalIndex,
  canonicalPage,
}: {
  group: TechnicalConfigurationBaselineGroupWire
  criterion: TechnicalConfigurationBaselineCriterionWire
  canonicalIndex: number
  canonicalPage: number
}): TechnicalConfigurationEvaluationCriterionListItem {
  return {
    group: {
      id: group.id,
      name: group.name,
      sortOrder: group.sort_order,
    },
    criterion: {
      id: criterion.id,
      criterionCode: criterion.criterion_code,
      title: criterion.title,
      sortOrder: criterion.sort_order,
    },
    canonicalIndex,
    canonicalPage,
  }
}

function buildBaselineCriterionIndex(groups: readonly TechnicalConfigurationBaselineGroupWire[]) {
  const criteria = new Map<
    string,
    {
      group: TechnicalConfigurationBaselineGroupWire
      criterion: TechnicalConfigurationBaselineCriterionWire
    }
  >()

  for (const group of groups) {
    for (const criterion of group.criteria) {
      criteria.set(criterion.id, { group, criterion })
    }
  }

  return criteria
}

/** Maps exact server-filtered IDs to baseline display rows without re-filtering locally. */
export function buildTechnicalConfigurationEvaluationProjection({
  groups,
  entries,
}: {
  groups: readonly TechnicalConfigurationBaselineGroupWire[]
  entries: readonly TechnicalConfigurationEvaluationCriterionWire[]
}): TechnicalConfigurationEvaluationCriterionListItem[] {
  const criteriaById = buildBaselineCriterionIndex(groups)

  return entries.flatMap((entry) => {
    const baselineCriterion = criteriaById.get(entry.criterion_id)
    return baselineCriterion
      ? [
          toProjectionItem({
            ...baselineCriterion,
            canonicalIndex: entry.canonical_index,
            canonicalPage: entry.canonical_page,
          }),
        ]
      : []
  })
}

/** Returns one client-visible page from a server-filtered canonical projection. */
export function getTechnicalConfigurationEvaluationPage({
  projection,
  page,
  pageSize,
}: {
  projection: readonly TechnicalConfigurationEvaluationCriterionListItem[]
  page: number
  pageSize: number
}): TechnicalConfigurationEvaluationCriterionListItem[] {
  const start = Math.max(0, page - 1) * pageSize
  return projection.slice(start, start + pageSize)
}

/** Finds the first matching criterion after the saved canonical position without wrapping. */
export function findNextTechnicalConfigurationEvaluationCriterion({
  projection,
  currentCanonicalIndex,
}: {
  projection: readonly TechnicalConfigurationEvaluationCriterionListItem[]
  currentCanonicalIndex: number
}): TechnicalConfigurationEvaluationCriterionListItem | null {
  return projection.find((item) => item.canonicalIndex > currentCanonicalIndex) ?? null
}

/** Resolves one criterion's canonical comparison page from the full baseline universe. */
export function findTechnicalConfigurationEvaluationCriterion({
  groups,
  criterionId,
  pageSize,
}: {
  groups: readonly TechnicalConfigurationBaselineGroupWire[]
  criterionId: string | null
  pageSize: number
}): TechnicalConfigurationEvaluationCriterionListItem | null {
  if (!criterionId) return null

  let canonicalIndex = 0
  for (const group of groups) {
    for (const criterion of group.criteria) {
      canonicalIndex += 1
      if (criterion.id === criterionId) {
        return toProjectionItem({
          group,
          criterion,
          canonicalIndex,
          canonicalPage: Math.ceil(canonicalIndex / pageSize),
        })
      }
    }
  }

  return null
}
