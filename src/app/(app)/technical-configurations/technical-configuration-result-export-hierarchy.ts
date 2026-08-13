import {
  buildTechnicalConfigurationEvaluationHierarchyRows,
  buildTechnicalConfigurationEvaluationHierarchySections,
  flattenTechnicalConfigurationEvaluationLeaves,
  type TechnicalConfigurationEvaluationHierarchyLeaf,
  type TechnicalConfigurationEvaluationHierarchySection,
} from "./technical-configuration-evaluation-hierarchy"
import type {
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineGroupWire,
  TechnicalConfigurationBaselineSubgroupWire,
} from "./baseline-types"
import type {
  TechnicalConfigurationResultExportCriterionAxisItemWire,
  TechnicalConfigurationResultExportHierarchyRow,
  TechnicalConfigurationResultExportMatrixCellWire,
  TechnicalConfigurationResultExportOptionAxisItemWire,
  TechnicalConfigurationResultExportStructuralAggregate,
} from "./technical-configuration-result-export-types"
import {
  buildTechnicalConfigurationHierarchyAggregateStatus,
  type TechnicalConfigurationSectionAggregate,
  type TechnicalConfigurationStructuralAggregate,
} from "@/lib/technical-configuration-hierarchy-aggregate-status"

type BuildTechnicalConfigurationResultExportHierarchyInput = Readonly<{
  baselineVersionId: string
  baselineGroups: readonly TechnicalConfigurationBaselineGroupWire[]
  optionAxis: readonly TechnicalConfigurationResultExportOptionAxisItemWire[]
  criterionAxis: readonly TechnicalConfigurationResultExportCriterionAxisItemWire[]
  matrix: readonly TechnicalConfigurationResultExportMatrixCellWire[]
  criterionIds: readonly string[] | null
}>

type ValidatedHierarchy = Readonly<{
  allLeaves: readonly TechnicalConfigurationEvaluationHierarchyLeaf[]
  criterionById: ReadonlyMap<string, TechnicalConfigurationResultExportCriterionAxisItemWire>
}>

type ValidatedBaseline = Readonly<{
  criterionById: ReadonlyMap<string, TechnicalConfigurationBaselineCriterionWire>
}>

function invalidHierarchy(message: string): never {
  throw new Error(`Invalid technical configuration result export hierarchy: ${message}`)
}

function validateCriterionOwnership(
  criterion: TechnicalConfigurationBaselineCriterionWire,
  group: TechnicalConfigurationBaselineGroupWire,
  subgroup: TechnicalConfigurationBaselineSubgroupWire | null,
  baselineVersionId: string,
  criterionIds: Set<string>
) {
  if (
    criterionIds.has(criterion.id) ||
    criterion.baseline_version_id !== baselineVersionId ||
    criterion.group_id !== group.id ||
    (criterion.subgroup_id ?? null) !== (subgroup?.id ?? null)
  ) {
    invalidHierarchy(`criterion ${criterion.id} has inconsistent ownership`)
  }
  criterionIds.add(criterion.id)
}

function validateBaselineHierarchy(
  baselineVersionId: string,
  groups: readonly TechnicalConfigurationBaselineGroupWire[]
): ValidatedBaseline {
  const groupIds = new Set<string>()
  const subgroupIds = new Set<string>()
  const criterionIds = new Set<string>()
  const criterionById = new Map<string, TechnicalConfigurationBaselineCriterionWire>()

  for (const group of groups) {
    if (groupIds.has(group.id) || group.baseline_version_id !== baselineVersionId) {
      invalidHierarchy(`group ${group.id} has inconsistent ownership`)
    }
    groupIds.add(group.id)

    for (const criterion of group.criteria) {
      validateCriterionOwnership(criterion, group, null, baselineVersionId, criterionIds)
      criterionById.set(criterion.id, criterion)
    }
    for (const subgroup of group.subgroups ?? []) {
      if (
        subgroupIds.has(subgroup.id) ||
        subgroup.baseline_version_id !== baselineVersionId ||
        subgroup.group_id !== group.id
      ) {
        invalidHierarchy(`subgroup ${subgroup.id} has inconsistent ownership`)
      }
      subgroupIds.add(subgroup.id)
      for (const criterion of subgroup.criteria) {
        validateCriterionOwnership(criterion, group, subgroup, baselineVersionId, criterionIds)
        criterionById.set(criterion.id, criterion)
      }
    }
  }
  return { criterionById }
}

function validateAxis(
  leaves: readonly TechnicalConfigurationEvaluationHierarchyLeaf[],
  baselineCriterionById: ReadonlyMap<string, TechnicalConfigurationBaselineCriterionWire>,
  criterionAxis: readonly TechnicalConfigurationResultExportCriterionAxisItemWire[]
): ValidatedHierarchy {
  const leafById = new Map(leaves.map((leaf) => [leaf.criterion.id, leaf] as const))
  const criterionById = new Map<string, TechnicalConfigurationResultExportCriterionAxisItemWire>()

  for (const criterion of criterionAxis) {
    const leaf = leafById.get(criterion.criterion_id)
    const baselineCriterion = baselineCriterionById.get(criterion.criterion_id)
    if (
      !leaf ||
      !baselineCriterion ||
      criterionById.has(criterion.criterion_id) ||
      criterion.group_id !== leaf.group.id ||
      criterion.group_name !== leaf.group.name ||
      criterion.group_order !== leaf.group.sortOrder ||
      criterion.criterion_code !== leaf.criterion.criterionCode ||
      criterion.criterion_title !== leaf.criterion.title ||
      criterion.requirement_text !== baselineCriterion.requirement_text ||
      criterion.criterion_order !== leaf.criterion.sortOrder
    ) {
      invalidHierarchy(`criterion axis item ${criterion.criterion_id} is inconsistent`)
    }
    criterionById.set(criterion.criterion_id, criterion)
  }

  return { allLeaves: leaves, criterionById }
}

function aggregateByOption(
  sections: readonly TechnicalConfigurationEvaluationHierarchySection[],
  optionAxis: readonly TechnicalConfigurationResultExportOptionAxisItemWire[],
  matrix: readonly TechnicalConfigurationResultExportMatrixCellWire[]
) {
  const matrixByOptionId = new Map<
    string,
    Map<string, TechnicalConfigurationResultExportMatrixCellWire>
  >()
  for (const cell of matrix) {
    const optionCells = matrixByOptionId.get(cell.option_id)
    if (optionCells) optionCells.set(cell.criterion_id, cell)
    else matrixByOptionId.set(cell.option_id, new Map([[cell.criterion_id, cell]]))
  }

  return new Map(
    optionAxis.map((option) => {
      const statusByCriterionId = new Map(
        [...(matrixByOptionId.get(option.option_id)?.values() ?? [])].map(
          (cell) => [cell.criterion_id, cell.conclusion] as const
        )
      )
      const aggregate = buildTechnicalConfigurationHierarchyAggregateStatus({
        sections,
        statusByCriterionId,
      })
      return [option.option_id, aggregate] as const
    })
  )
}

function toOptionAggregates(
  aggregate: TechnicalConfigurationStructuralAggregate,
  optionId: string
): TechnicalConfigurationResultExportStructuralAggregate {
  return {
    optionId,
    status: aggregate.status,
    descendantCount: aggregate.descendantCount,
    statusCounts: aggregate.statusCounts,
  }
}

function structuralAggregates(
  structuralId: string,
  optionAxis: readonly TechnicalConfigurationResultExportOptionAxisItemWire[],
  aggregateByOptionId: ReturnType<typeof aggregateByOption>
) {
  return optionAxis.map((option) => {
    const hierarchy = aggregateByOptionId.get(option.option_id)
    const aggregate = hierarchy?.sections
      .flatMap(
        (
          section
        ): Array<
          TechnicalConfigurationSectionAggregate | TechnicalConfigurationStructuralAggregate
        > => [section, ...section.subgroups]
      )
      .find((item) => item.id === structuralId)
    if (!aggregate) invalidHierarchy(`aggregate ${structuralId} is missing`)
    return toOptionAggregates(aggregate, option.option_id)
  })
}

function toScopedRows(
  leaves: readonly TechnicalConfigurationEvaluationHierarchyLeaf[],
  criterionById: ReadonlyMap<string, TechnicalConfigurationResultExportCriterionAxisItemWire>,
  optionAxis: readonly TechnicalConfigurationResultExportOptionAxisItemWire[],
  aggregates: ReturnType<typeof aggregateByOption>
): TechnicalConfigurationResultExportHierarchyRow[] {
  return buildTechnicalConfigurationEvaluationHierarchyRows(leaves).map((row) => {
    if (row.kind === "criterion") {
      const criterion = criterionById.get(row.row.criterion.id)
      if (!criterion) invalidHierarchy(`criterion ${row.row.criterion.id} is missing`)
      return { kind: "criterion", criterion }
    }
    const structuralLeaf =
      row.kind === "section"
        ? leaves.find((leaf) => leaf.group.id === row.id)
        : leaves.find((leaf) => leaf.subgroup?.id === row.id)
    if (!structuralLeaf) invalidHierarchy(`structural row ${row.id} is missing`)
    return {
      ...row,
      sortOrder:
        row.kind === "section"
          ? structuralLeaf.group.sortOrder
          : structuralLeaf.subgroup?.sortOrder,
      optionAggregates: structuralAggregates(row.id, optionAxis, aggregates),
    } as TechnicalConfigurationResultExportHierarchyRow
  })
}

function toCompleteRows(
  sections: readonly TechnicalConfigurationEvaluationHierarchySection[],
  leaves: readonly TechnicalConfigurationEvaluationHierarchyLeaf[],
  criterionById: ReadonlyMap<string, TechnicalConfigurationResultExportCriterionAxisItemWire>,
  optionAxis: readonly TechnicalConfigurationResultExportOptionAxisItemWire[],
  aggregates: ReturnType<typeof aggregateByOption>
): TechnicalConfigurationResultExportHierarchyRow[] {
  const leafByCriterionId = new Map(leaves.map((leaf) => [leaf.criterion.id, leaf] as const))
  const rows: TechnicalConfigurationResultExportHierarchyRow[] = []
  for (const section of sections) {
    rows.push({
      kind: "section",
      id: section.id,
      name: section.name,
      sortOrder: section.sortOrder,
      optionAggregates: structuralAggregates(section.id, optionAxis, aggregates),
    })
    for (const criterionId of section.criterionIds) {
      const criterion = criterionById.get(criterionId)
      if (!criterion || !leafByCriterionId.has(criterionId)) {
        invalidHierarchy(`criterion ${criterionId} is missing`)
      }
      rows.push({ kind: "criterion", criterion })
    }
    for (const subgroup of section.subgroups) {
      rows.push({
        kind: "subgroup",
        id: subgroup.id,
        sectionId: section.id,
        name: subgroup.name,
        sortOrder: subgroup.sortOrder,
        optionAggregates: structuralAggregates(subgroup.id, optionAxis, aggregates),
      })
      for (const criterionId of subgroup.criterionIds) {
        const criterion = criterionById.get(criterionId)
        if (!criterion || !leafByCriterionId.has(criterionId)) {
          invalidHierarchy(`criterion ${criterionId} is missing`)
        }
        rows.push({ kind: "criterion", criterion })
      }
    }
  }
  return rows
}

/** Builds one immutable hierarchy row union for a stable result-export matrix. */
export function buildTechnicalConfigurationResultExportHierarchy({
  baselineVersionId,
  baselineGroups,
  optionAxis,
  criterionAxis,
  matrix,
  criterionIds,
}: BuildTechnicalConfigurationResultExportHierarchyInput): TechnicalConfigurationResultExportHierarchyRow[] {
  const validatedBaseline = validateBaselineHierarchy(baselineVersionId, baselineGroups)
  const allLeaves = flattenTechnicalConfigurationEvaluationLeaves(baselineGroups)
  const validated = validateAxis(allLeaves, validatedBaseline.criterionById, criterionAxis)
  const selectedLeaves = validated.allLeaves.filter((leaf) =>
    validated.criterionById.has(leaf.criterion.id)
  )
  if (selectedLeaves.length !== criterionAxis.length) {
    invalidHierarchy("criterion axis does not match the baseline")
  }
  const sections = buildTechnicalConfigurationEvaluationHierarchySections(
    baselineGroups,
    criterionIds === null ? validated.allLeaves : selectedLeaves
  )
  const aggregates = aggregateByOption(sections, optionAxis, matrix)

  return criterionIds === null
    ? toCompleteRows(sections, validated.allLeaves, validated.criterionById, optionAxis, aggregates)
    : toScopedRows(selectedLeaves, validated.criterionById, optionAxis, aggregates)
}

/** Deep-freezes one hierarchy projection before it enters the export dataset. */
export function freezeTechnicalConfigurationResultExportHierarchy(
  rows: readonly TechnicalConfigurationResultExportHierarchyRow[]
) {
  for (const row of rows) {
    if (row.kind === "criterion") {
      Object.freeze(row.criterion)
    } else {
      for (const aggregate of row.optionAggregates) {
        Object.freeze(aggregate.statusCounts)
        Object.freeze(aggregate)
      }
      Object.freeze(row.optionAggregates)
    }
    Object.freeze(row)
  }
  return Object.freeze(rows)
}
