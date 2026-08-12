import type { TechnicalConfigurationBaselineGroupWire } from "./baseline-types"
import type { TechnicalConfigurationComparisonResult } from "./comparison-types"

type ComparisonCriterionRow = TechnicalConfigurationComparisonResult["data"]["criteria"][number]

export type TechnicalConfigurationComparisonHierarchyRow =
  | {
      kind: "section"
      id: string
      name: string
    }
  | {
      kind: "subgroup"
      id: string
      sectionId: string
      name: string
    }
  | {
      kind: "criterion"
      row: ComparisonCriterionRow
    }

function buildLegacyRows(
  criteria: readonly ComparisonCriterionRow[]
): TechnicalConfigurationComparisonHierarchyRow[] {
  const rows: TechnicalConfigurationComparisonHierarchyRow[] = []
  let currentSectionId: string | null = null

  for (const row of criteria) {
    const group = row.group
    if (group.id !== currentSectionId) {
      currentSectionId = group.id
      rows.push({
        kind: "section",
        id: group.id,
        name: group.name,
      })
    }
    rows.push({ kind: "criterion", row })
  }

  return rows
}

/** Projects one criterion page into canonical section/subgroup presentation rows. */
export function buildTechnicalConfigurationComparisonHierarchyRows(
  baselineGroups: readonly TechnicalConfigurationBaselineGroupWire[] | undefined,
  criteria: readonly ComparisonCriterionRow[]
): TechnicalConfigurationComparisonHierarchyRow[] {
  if (!baselineGroups?.length) return buildLegacyRows(criteria)

  const criterionById = new Map(criteria.map((row) => [row.criterion.id, row]))
  const criteriaByGroupId = new Map<string, ComparisonCriterionRow[]>()
  for (const row of criteria) {
    const groupRows = criteriaByGroupId.get(row.group.id)
    if (groupRows) {
      groupRows.push(row)
    } else {
      criteriaByGroupId.set(row.group.id, [row])
    }
  }
  const emittedCriterionIds = new Set<string>()
  const rows: TechnicalConfigurationComparisonHierarchyRow[] = []

  for (const group of baselineGroups) {
    const directRows: ComparisonCriterionRow[] = []
    const subgroupRows: TechnicalConfigurationComparisonHierarchyRow[] = []

    for (const criterion of group.criteria) {
      const comparisonRow = criterionById.get(criterion.id)
      const hasValidOwner =
        criterion.group_id === group.id &&
        criterion.subgroup_id == null &&
        comparisonRow?.group.id === group.id
      if (!hasValidOwner || emittedCriterionIds.has(criterion.id)) continue

      emittedCriterionIds.add(criterion.id)
      directRows.push(comparisonRow)
    }

    for (const subgroup of group.subgroups ?? []) {
      if (subgroup.group_id !== group.id) continue
      const subgroupCriterionRows: TechnicalConfigurationComparisonHierarchyRow[] = []

      for (const criterion of subgroup.criteria) {
        const comparisonRow = criterionById.get(criterion.id)
        const hasValidOwner =
          criterion.group_id === group.id &&
          criterion.subgroup_id === subgroup.id &&
          comparisonRow?.group.id === group.id
        if (!hasValidOwner || emittedCriterionIds.has(criterion.id)) continue

        emittedCriterionIds.add(criterion.id)
        subgroupCriterionRows.push({ kind: "criterion", row: comparisonRow })
      }

      if (subgroupCriterionRows.length === 0) continue
      subgroupRows.push({
        kind: "subgroup",
        id: subgroup.id,
        sectionId: group.id,
        name: subgroup.name,
      })
      subgroupRows.push(...subgroupCriterionRows)
    }

    const fallbackDirectRows = (criteriaByGroupId.get(group.id) ?? []).filter(
      (row) => !emittedCriterionIds.has(row.criterion.id)
    )
    for (const row of fallbackDirectRows) {
      emittedCriterionIds.add(row.criterion.id)
    }
    directRows.push(...fallbackDirectRows)
    directRows.sort((left, right) => left.criterion.sortOrder - right.criterion.sortOrder)

    const sectionRows: TechnicalConfigurationComparisonHierarchyRow[] = [
      ...directRows.map((row): TechnicalConfigurationComparisonHierarchyRow => ({
        kind: "criterion",
        row,
      })),
      ...subgroupRows,
    ]
    if (sectionRows.length === 0) continue
    rows.push({ kind: "section", id: group.id, name: group.name }, ...sectionRows)
  }

  const unmatchedRows = criteria.filter((row) => !emittedCriterionIds.has(row.criterion.id))
  rows.push(...buildLegacyRows(unmatchedRows))

  return rows
}
