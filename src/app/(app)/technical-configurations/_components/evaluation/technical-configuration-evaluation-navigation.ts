import type { TechnicalConfigurationEvaluationCriterionWire } from "../../assessment-types"
import type { TechnicalConfigurationBaselineGroupWire } from "../../baseline-types"
import {
  flattenTechnicalConfigurationEvaluationLeaves,
  type TechnicalConfigurationEvaluationHierarchyLeaf,
} from "./technical-configuration-evaluation-hierarchy"

export type TechnicalConfigurationEvaluationCriterionListItem =
  TechnicalConfigurationEvaluationHierarchyLeaf & {
    canonicalIndex: number
    canonicalPage: number
  }

function toProjectionItem({
  leaf,
  canonicalIndex,
  canonicalPage,
}: {
  leaf: Omit<TechnicalConfigurationEvaluationHierarchyLeaf, "canonicalIndex">
  canonicalIndex: number
  canonicalPage: number
}): TechnicalConfigurationEvaluationCriterionListItem {
  return {
    ...leaf,
    canonicalIndex,
    canonicalPage,
  }
}

function buildProjectionLeafIndex(groups: readonly TechnicalConfigurationBaselineGroupWire[]) {
  return new Map(
    flattenTechnicalConfigurationEvaluationLeaves(groups).map((leaf) => {
      const { canonicalIndex: _canonicalIndex, ...projectionLeaf } = leaf
      return [leaf.criterion.id, projectionLeaf] as const
    })
  )
}

/** Maps exact server-filtered IDs to baseline display rows without re-filtering locally. */
export function buildTechnicalConfigurationEvaluationProjection({
  groups,
  entries,
}: {
  groups: readonly TechnicalConfigurationBaselineGroupWire[]
  entries: readonly TechnicalConfigurationEvaluationCriterionWire[]
}): TechnicalConfigurationEvaluationCriterionListItem[] {
  const leavesById = buildProjectionLeafIndex(groups)

  return entries.flatMap((entry) => {
    const leaf = leavesById.get(entry.criterion_id)
    return leaf
      ? [
          toProjectionItem({
            leaf,
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

  const leaf = flattenTechnicalConfigurationEvaluationLeaves(groups).find(
    (item) => item.criterion.id === criterionId
  )
  if (!leaf) return null

  const { canonicalIndex, ...projectionLeaf } = leaf
  return toProjectionItem({
    leaf: projectionLeaf,
    canonicalIndex,
    canonicalPage: Math.ceil(canonicalIndex / pageSize),
  })
}
