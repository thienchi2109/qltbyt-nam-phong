import type {
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineGroupWire,
  TechnicalConfigurationBaselineSubgroupWire,
} from "./baseline-types"

export type TechnicalConfigurationEvaluationHierarchyGroup = Readonly<{
  id: string
  name: string
  sortOrder: number
}>

export type TechnicalConfigurationEvaluationHierarchySubgroup = Readonly<{
  id: string
  name: string
  sortOrder: number
}>

export type TechnicalConfigurationEvaluationHierarchyCriterion = Readonly<{
  id: string
  criterionCode: string
  title: string | null
  sortOrder: number
}>

export type TechnicalConfigurationEvaluationHierarchyLeaf = Readonly<{
  group: TechnicalConfigurationEvaluationHierarchyGroup
  subgroup?: TechnicalConfigurationEvaluationHierarchySubgroup
  criterion: TechnicalConfigurationEvaluationHierarchyCriterion
  canonicalIndex: number
}>

export type TechnicalConfigurationEvaluationHierarchySubgroupSection = Readonly<{
  id: string
  name: string
  sortOrder: number
  criterionIds: readonly string[]
}>

export type TechnicalConfigurationEvaluationHierarchySection = Readonly<{
  id: string
  name: string
  sortOrder: number
  criterionIds: readonly string[]
  subgroups: readonly TechnicalConfigurationEvaluationHierarchySubgroupSection[]
}>

export type TechnicalConfigurationEvaluationHierarchyRow<
  TLeaf extends TechnicalConfigurationEvaluationHierarchyLeaf =
    TechnicalConfigurationEvaluationHierarchyLeaf,
> =
  | Readonly<{
      kind: "section"
      id: string
      name: string
    }>
  | Readonly<{
      kind: "subgroup"
      id: string
      sectionId: string
      name: string
    }>
  | Readonly<{
      kind: "criterion"
      row: TLeaf
    }>

type HierarchyLeafCandidate = Readonly<{
  group: TechnicalConfigurationBaselineGroupWire
  subgroup?: TechnicalConfigurationBaselineSubgroupWire
  criterion: TechnicalConfigurationBaselineCriterionWire
}>

function compareNumber(left: number, right: number): number {
  return left - right
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

function compareCandidates(left: HierarchyLeafCandidate, right: HierarchyLeafCandidate): number {
  return (
    compareNumber(left.group.sort_order, right.group.sort_order) ||
    compareText(left.group.id, right.group.id) ||
    compareNumber(left.subgroup ? 1 : 0, right.subgroup ? 1 : 0) ||
    compareNumber(left.subgroup?.sort_order ?? 0, right.subgroup?.sort_order ?? 0) ||
    compareText(left.subgroup?.id ?? "", right.subgroup?.id ?? "") ||
    compareNumber(left.criterion.sort_order, right.criterion.sort_order) ||
    compareText(left.criterion.id, right.criterion.id)
  )
}

function toGroup(
  group: TechnicalConfigurationBaselineGroupWire
): TechnicalConfigurationEvaluationHierarchyGroup {
  return {
    id: group.id,
    name: group.name,
    sortOrder: group.sort_order,
  }
}

function toSubgroup(
  subgroup: TechnicalConfigurationBaselineSubgroupWire
): TechnicalConfigurationEvaluationHierarchySubgroup {
  return {
    id: subgroup.id,
    name: subgroup.name,
    sortOrder: subgroup.sort_order,
  }
}

function toCriterion(
  criterion: TechnicalConfigurationBaselineCriterionWire
): TechnicalConfigurationEvaluationHierarchyCriterion {
  return {
    id: criterion.id,
    criterionCode: criterion.criterion_code,
    title: criterion.title,
    sortOrder: criterion.sort_order,
  }
}

function collectCandidates(
  groups: readonly TechnicalConfigurationBaselineGroupWire[]
): HierarchyLeafCandidate[] {
  const candidates: HierarchyLeafCandidate[] = []

  for (const group of groups) {
    for (const criterion of group.criteria) {
      if (criterion.group_id !== group.id || criterion.subgroup_id != null) continue
      candidates.push({ group, criterion })
    }

    for (const subgroup of group.subgroups ?? []) {
      if (subgroup.group_id !== group.id) continue
      for (const criterion of subgroup.criteria) {
        if (criterion.group_id !== group.id || criterion.subgroup_id !== subgroup.id) {
          continue
        }
        candidates.push({ group, subgroup, criterion })
      }
    }
  }

  return candidates
}

/** Flattens one baseline into the immutable canonical evaluation leaf sequence. */
export function flattenTechnicalConfigurationEvaluationLeaves(
  groups: readonly TechnicalConfigurationBaselineGroupWire[]
): TechnicalConfigurationEvaluationHierarchyLeaf[] {
  const emittedCriterionIds = new Set<string>()
  const leaves: TechnicalConfigurationEvaluationHierarchyLeaf[] = []

  for (const candidate of collectCandidates(groups).sort(compareCandidates)) {
    if (emittedCriterionIds.has(candidate.criterion.id)) continue
    emittedCriterionIds.add(candidate.criterion.id)
    leaves.push({
      group: toGroup(candidate.group),
      ...(candidate.subgroup ? { subgroup: toSubgroup(candidate.subgroup) } : {}),
      criterion: toCriterion(candidate.criterion),
      canonicalIndex: leaves.length + 1,
    })
  }

  return leaves
}

/** Builds structural inputs for full-universe section and subgroup aggregates. */
export function buildTechnicalConfigurationEvaluationHierarchySections(
  groups: readonly TechnicalConfigurationBaselineGroupWire[],
  leaves: readonly TechnicalConfigurationEvaluationHierarchyLeaf[]
): TechnicalConfigurationEvaluationHierarchySection[] {
  const directCriterionIdsByGroupId = new Map<string, string[]>()
  const criterionIdsBySubgroupId = new Map<string, string[]>()

  for (const leaf of leaves) {
    const groupId = leaf.group.id
    const criterionId = leaf.criterion.id
    const subgroupId = leaf.subgroup?.id
    const criterionIdsByOwner = subgroupId ? criterionIdsBySubgroupId : directCriterionIdsByGroupId
    const ownerId = subgroupId ?? groupId
    const criterionIds = criterionIdsByOwner.get(ownerId)
    if (criterionIds) criterionIds.push(criterionId)
    else criterionIdsByOwner.set(ownerId, [criterionId])
  }

  const sortedGroups = [...groups].sort(
    (left, right) =>
      compareNumber(left.sort_order, right.sort_order) || compareText(left.id, right.id)
  )

  return sortedGroups.map((group) => {
    const validSubgroups = (group.subgroups ?? [])
      .filter((subgroup) => subgroup.group_id === group.id)
      .sort(
        (left, right) =>
          compareNumber(left.sort_order, right.sort_order) || compareText(left.id, right.id)
      )

    return {
      id: group.id,
      name: group.name,
      sortOrder: group.sort_order,
      criterionIds: directCriterionIdsByGroupId.get(group.id) ?? [],
      subgroups: validSubgroups.map((subgroup) => ({
        id: subgroup.id,
        name: subgroup.name,
        sortOrder: subgroup.sort_order,
        criterionIds: criterionIdsBySubgroupId.get(subgroup.id) ?? [],
      })),
    }
  })
}

/** Wraps supplied page leaves with only their page-local ancestor headings. */
export function buildTechnicalConfigurationEvaluationHierarchyRows<
  TLeaf extends TechnicalConfigurationEvaluationHierarchyLeaf,
>(leaves: readonly TLeaf[]): TechnicalConfigurationEvaluationHierarchyRow<TLeaf>[] {
  const rows: TechnicalConfigurationEvaluationHierarchyRow<TLeaf>[] = []
  let currentSectionId: string | null = null
  let currentSubgroupId: string | null = null

  for (const leaf of leaves) {
    const { group, subgroup } = leaf
    if (group.id !== currentSectionId) {
      currentSectionId = group.id
      currentSubgroupId = null
      rows.push({
        kind: "section",
        id: group.id,
        name: group.name,
      })
    }

    if (subgroup && subgroup.id !== currentSubgroupId) {
      currentSubgroupId = subgroup.id
      rows.push({
        kind: "subgroup",
        id: subgroup.id,
        sectionId: group.id,
        name: subgroup.name,
      })
    } else if (!subgroup) {
      currentSubgroupId = null
    }

    rows.push({ kind: "criterion", row: leaf })
  }

  return rows
}
