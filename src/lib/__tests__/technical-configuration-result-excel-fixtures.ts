import { RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET } from "@/lib/technical-configuration-result-excel-contract"

import type {
  TechnicalConfigurationResultWorkbookBuildInput,
  TechnicalConfigurationResultWorkbookContentMode,
  TechnicalConfigurationResultWorkbookCriterionSource,
  TechnicalConfigurationResultWorkbookMatrixSourceCell,
  TechnicalConfigurationResultWorkbookOptionSource,
  TechnicalConfigurationResultWorkbookRankingSourceRow,
} from "@/lib/technical-configuration-result-excel-contract"

const DOSSIER_ID = "10000000-0000-4000-8000-000000000001"
const BASELINE_VERSION_ID = "20000000-0000-4000-8000-000000000001"
const GENERATED_AT = "2026-08-02T12:34:56.000Z"
const GENERATED_BY = "Nguyen Van A"

interface FixtureOptions {
  readonly mode?: TechnicalConfigurationResultWorkbookContentMode
  readonly optionCount: number
  readonly criterionCount: number
  readonly selectedOptionIds?: readonly string[] | null
  readonly selectedCriterionIds?: readonly string[] | null
  readonly rankingFactory?: (
    row: TechnicalConfigurationResultWorkbookRankingSourceRow,
    index: number
  ) => TechnicalConfigurationResultWorkbookRankingSourceRow
  readonly matrixFactory?: (
    cell: TechnicalConfigurationResultWorkbookMatrixSourceCell,
    criterionIndex: number,
    optionIndex: number
  ) => TechnicalConfigurationResultWorkbookMatrixSourceCell
}

function indexedUuid(namespace: number, index: number) {
  return `${String(namespace).padStart(8, "0")}-0000-4000-8000-${String(index + 1).padStart(
    12,
    "0"
  )}`
}

function createOptionAxisItem(
  optionId: string,
  supplierId: string,
  index: number
): TechnicalConfigurationResultWorkbookOptionSource {
  return {
    option_id: optionId,
    supplier_id: supplierId,
    supplier_name: `Nha cung cap ${index + 1}`,
    display_label: `Phuong an ${index + 1}`,
    model: `Model ${index + 1}`,
    manufacturer: `Hang ${index + 1}`,
    option_name: `May ${index + 1}`,
  }
}

function createCriterionAxisItem(
  criterionId: string,
  criterionIndex: number
): TechnicalConfigurationResultWorkbookCriterionSource {
  return {
    group_id: indexedUuid(60, Math.floor(criterionIndex / 10)),
    group_name: `Nhom tieu chi ${Math.floor(criterionIndex / 10) + 1}`,
    group_order: Math.floor(criterionIndex / 10) + 1,
    criterion_id: criterionId,
    criterion_code: `TC-${String(criterionIndex + 1).padStart(3, "0")}`,
    criterion_title: `Tieu chi ${criterionIndex + 1}`,
    requirement_text: `Yeu cau cau hinh ${criterionIndex + 1}`,
    criterion_order: criterionIndex + 1,
  }
}

function createRankingRow(
  option: TechnicalConfigurationResultWorkbookOptionSource,
  index: number
): TechnicalConfigurationResultWorkbookRankingSourceRow {
  return {
    option_id: option.option_id,
    supplier_id: option.supplier_id,
    supplier_name: option.supplier_name,
    display_label: option.display_label,
    eligibility: "eligible",
    incomplete_criterion_count: 0,
    failed_count: 0,
    insufficient_evidence_count: 0,
    exceeds_count: 1,
    rank: index + 1,
  }
}

function createMatrixCell(
  criterion: TechnicalConfigurationResultWorkbookCriterionSource,
  option: TechnicalConfigurationResultWorkbookOptionSource,
  criterionIndex: number,
  optionIndex: number
): TechnicalConfigurationResultWorkbookMatrixSourceCell {
  return {
    ...criterion,
    ...option,
    response_text: `Phan hoi ${criterionIndex + 1}-${optionIndex + 1}`,
    supplementary_information: `Thong tin ${criterionIndex + 1}-${optionIndex + 1}`,
    document_links: [],
    technical_axis: "meets",
    evidence_axis: "complete",
    assessment_notes: null,
    conclusion: "meets",
  }
}

function createPassedStatusCounts(meets: number) {
  return {
    not_evaluated: 0,
    not_applicable: 0,
    fails: 0,
    unclear: 0,
    insufficient_evidence: 0,
    exceeds: 0,
    meets,
  } as const
}

export function createResultWorkbookFixture({
  mode = "full",
  optionCount,
  criterionCount,
  selectedOptionIds = null,
  selectedCriterionIds = null,
  rankingFactory,
  matrixFactory,
}: FixtureOptions): TechnicalConfigurationResultWorkbookBuildInput {
  const optionIds = Array.from({ length: optionCount }, (_, index) => indexedUuid(30, index))
  const supplierIds = Array.from({ length: optionCount }, (_, index) => indexedUuid(40, index))
  const criterionIds = Array.from({ length: criterionCount }, (_, index) => indexedUuid(50, index))
  const optionAxis = optionIds.map((optionId, index) =>
    createOptionAxisItem(optionId, supplierIds[index], index)
  )
  const criterionAxis = criterionIds.map(createCriterionAxisItem)
  const ranking = optionAxis.map((option, index) => {
    const row = createRankingRow(option, index)
    return rankingFactory?.(row, index) ?? row
  })
  const matrix = criterionAxis.flatMap((criterion, criterionIndex) =>
    optionAxis.map((option, optionIndex) => {
      const cell = createMatrixCell(criterion, option, criterionIndex, optionIndex)
      return matrixFactory?.(cell, criterionIndex, optionIndex) ?? cell
    })
  )
  const hierarchyRows = criterionAxis.flatMap((criterion, criterionIndex) => {
    const previousCriterion = criterionAxis[criterionIndex - 1]
    const groupCriteria = criterionAxis.filter(
      (candidate) => candidate.group_id === criterion.group_id
    )
    const section =
      previousCriterion?.group_id === criterion.group_id
        ? []
        : [
            {
              kind: "section" as const,
              id: criterion.group_id,
              name: criterion.group_name,
              sortOrder: criterion.group_order,
              optionAggregates: optionAxis.map((option) => ({
                optionId: option.option_id,
                status: "passed" as const,
                descendantCount: groupCriteria.length,
                statusCounts: createPassedStatusCounts(groupCriteria.length),
              })),
            },
          ]
    return [...section, { kind: "criterion" as const, criterion }]
  })
  const manifest = {
    dossier: {
      id: DOSSIER_ID,
      device_type_name: "May sieu am",
      name: "Cau hinh may sieu am",
    },
    baseline_version: {
      id: BASELINE_VERSION_ID,
      version_number: 3,
      locked_at: "2026-08-01T02:03:04.000Z",
    },
    option_total: optionCount,
    criterion_total: criterionCount,
    snapshot_token: "snapshot-v1",
    ranking_snapshot_token: "ranking-v1",
  } as const
  const context = {
    manifest,
    optionAxis,
    criterionAxis,
    option_ids: selectedOptionIds,
    criterion_ids: selectedCriterionIds,
    generated_at: GENERATED_AT,
    generated_by: GENERATED_BY,
  } as const

  switch (mode) {
    case "full":
      return { ...context, mode, ranking, matrix, hierarchyRows }
    case "ranking_only":
      return { ...context, mode, ranking, matrix: null, hierarchyRows: null }
    case "detailed_matrix_only":
      return { ...context, mode, ranking: null, matrix, hierarchyRows }
  }
}

export function createHierarchicalResultWorkbookFixture() {
  const fixture = createResultWorkbookFixture({
    mode: "detailed_matrix_only",
    optionCount: 1,
    criterionCount: 2,
  })
  if (fixture.matrix === null) {
    throw new Error("Expected a detailed matrix fixture.")
  }
  const [firstCriterion, secondCriterion] = fixture.criterionAxis
  const option = fixture.optionAxis[0]
  if (!firstCriterion || !secondCriterion || !option) {
    throw new Error("Expected representative hierarchy axes.")
  }

  return {
    ...fixture,
    hierarchyRows: [
      {
        kind: "section",
        id: firstCriterion.group_id,
        name: firstCriterion.group_name,
        sortOrder: firstCriterion.group_order,
        optionAggregates: [
          {
            optionId: option.option_id,
            status: "passed",
            descendantCount: 2,
            statusCounts: createPassedStatusCounts(2),
          },
        ],
      },
      { kind: "criterion", criterion: firstCriterion },
      {
        kind: "subgroup",
        id: indexedUuid(65, 0),
        sectionId: firstCriterion.group_id,
        name: "Phan nhom 1",
        sortOrder: 1,
        optionAggregates: [
          {
            optionId: option.option_id,
            status: "passed",
            descendantCount: 1,
            statusCounts: createPassedStatusCounts(1),
          },
        ],
      },
      { kind: "criterion", criterion: secondCriterion },
    ],
  } as const
}

export function createNarrowedResultWorkbookFixture() {
  const fixture = createResultWorkbookFixture({
    optionCount: 3,
    criterionCount: 3,
  })
  if (fixture.ranking === null || fixture.matrix === null) {
    throw new Error("Expected a full result workbook fixture.")
  }

  const optionAxis = [...fixture.optionAxis].filter((_, index) => index !== 1).reverse()
  const criterionAxis = [...fixture.criterionAxis].filter((_, index) => index !== 1).reverse()
  const optionIds = optionAxis.map((option) => option.option_id)
  const criterionIds = criterionAxis.map((criterion) => criterion.criterion_id)
  const optionIdSet = new Set(optionIds)
  const criterionIdSet = new Set(criterionIds)
  const groupIdSet = new Set(criterionAxis.map((criterion) => criterion.group_id))
  const hierarchyRows = fixture.hierarchyRows.flatMap((row) => {
    if (row.kind === "criterion") {
      return criterionIdSet.has(row.criterion.criterion_id) ? [row] : []
    }
    if (row.kind === "subgroup" || !groupIdSet.has(row.id)) return []
    const descendantCount = criterionAxis.filter(
      (criterion) => criterion.group_id === row.id
    ).length
    return [
      {
        ...row,
        optionAggregates: optionAxis.map((option) => ({
          optionId: option.option_id,
          status: "passed" as const,
          descendantCount,
          statusCounts: createPassedStatusCounts(descendantCount),
        })),
      },
    ]
  })

  return {
    ...fixture,
    manifest: {
      ...fixture.manifest,
      option_total: optionAxis.length,
      criterion_total: criterionAxis.length,
    },
    optionAxis,
    criterionAxis,
    option_ids: optionIds,
    criterion_ids: criterionIds,
    hierarchyRows,
    ranking: fixture.ranking.filter((row) => optionIdSet.has(row.option_id)),
    matrix: fixture.matrix.filter(
      (cell) => optionIdSet.has(cell.option_id) && criterionIdSet.has(cell.criterion_id)
    ),
  } as const
}

export function createEmptyResultWorkbookFixture() {
  return createResultWorkbookFixture({
    optionCount: 0,
    criterionCount: 0,
  })
}

export function createSingleOptionEmptyCriteriaResultWorkbookFixture() {
  return createResultWorkbookFixture({
    mode: "detailed_matrix_only",
    optionCount: 1,
    criterionCount: 0,
  })
}

export function createEmptyOptionsSingleCriterionResultWorkbookFixture() {
  return createResultWorkbookFixture({
    mode: "detailed_matrix_only",
    optionCount: 0,
    criterionCount: 1,
  })
}

export function createSparseResultWorkbookFixture() {
  return createResultWorkbookFixture({
    optionCount: 2,
    criterionCount: 2,
    matrixFactory: (cell, criterionIndex, optionIndex) =>
      criterionIndex === 1 && optionIndex === 1
        ? {
            ...cell,
            response_text: null,
            supplementary_information: null,
            technical_axis: null,
            evidence_axis: null,
            assessment_notes: null,
            conclusion: "not_evaluated",
          }
        : cell,
  })
}

export function createTiedRankingResultWorkbookFixture() {
  return createResultWorkbookFixture({
    optionCount: 2,
    criterionCount: 1,
    rankingFactory: (row) => ({ ...row, rank: 1 }),
  })
}

export function createMissingDataResultWorkbookFixture() {
  const fixture = createResultWorkbookFixture({
    optionCount: 1,
    criterionCount: 1,
    rankingFactory: (row) => ({
      ...row,
      eligibility: "incomplete",
      incomplete_criterion_count: 1,
      exceeds_count: 0,
      rank: null,
    }),
    matrixFactory: (cell) => ({
      ...cell,
      response_text: null,
      supplementary_information: null,
      technical_axis: null,
      evidence_axis: null,
      assessment_notes: null,
      conclusion: "not_evaluated",
    }),
  })

  return {
    ...fixture,
    optionAxis: fixture.optionAxis.map((option) => ({
      ...option,
      model: null,
      manufacturer: null,
      option_name: null,
    })),
  } as const
}

export function createRepresentativeLargeResultWorkbookFixture() {
  return createResultWorkbookFixture({
    optionCount: 101,
    criterionCount: 102,
  })
}

export function createMatrixBoundaryResultWorkbookFixture() {
  return createResultWorkbookFixture({
    mode: "detailed_matrix_only",
    optionCount: RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET,
    criterionCount: 1,
  })
}

export function createContinuationResultWorkbookFixture() {
  return createResultWorkbookFixture({
    mode: "detailed_matrix_only",
    optionCount: RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET + 1,
    criterionCount: 1,
  })
}
