import { describe, expect, it } from "vitest"

import type {
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineGroupWire,
  TechnicalConfigurationBaselineSubgroupWire,
} from "../baseline-types"
import { buildTechnicalConfigurationResultExportHierarchy } from "../technical-configuration-result-export-hierarchy"
import type {
  TechnicalConfigurationResultExportCriterionAxisItemWire,
  TechnicalConfigurationResultExportMatrixCellWire,
  TechnicalConfigurationResultExportOptionAxisItemWire,
} from "../technical-configuration-result-export-types"
import { createBaselineGroups } from "./technical-configuration-evaluation-workspace.test-support"

const OPTION_AXIS = [
  {
    option_id: "option-1",
    supplier_id: "supplier-1",
    supplier_name: "Nhà cung cấp 1",
    display_label: "Phương án 1",
    model: "Model 1",
    manufacturer: "Hãng 1",
    option_name: "Gói 1",
  },
  {
    option_id: "option-2",
    supplier_id: "supplier-2",
    supplier_name: "Nhà cung cấp 2",
    display_label: "Phương án 2",
    model: "Model 2",
    manufacturer: "Hãng 2",
    option_name: "Gói 2",
  },
] as const satisfies readonly TechnicalConfigurationResultExportOptionAxisItemWire[]

function criterion(
  source: TechnicalConfigurationBaselineCriterionWire,
  {
    id,
    groupId,
    subgroupId = null,
    sortOrder,
  }: Readonly<{
    id: string
    groupId: string
    subgroupId?: string | null
    sortOrder: number
  }>
): TechnicalConfigurationBaselineCriterionWire {
  return {
    ...source,
    id,
    group_id: groupId,
    subgroup_id: subgroupId,
    criterion_code: id.toUpperCase(),
    title: `Tiêu chí ${id}`,
    requirement_text: `Yêu cầu ${id}`,
    sort_order: sortOrder,
  }
}

function subgroup(
  source: TechnicalConfigurationBaselineGroupWire,
  {
    id,
    sortOrder,
    criteria,
  }: Readonly<{
    id: string
    sortOrder: number
    criteria: readonly TechnicalConfigurationBaselineCriterionWire[]
  }>
): TechnicalConfigurationBaselineSubgroupWire {
  return {
    id,
    baseline_version_id: source.baseline_version_id,
    group_id: source.id,
    name: `Nhóm con ${id}`,
    sort_order: sortOrder,
    created_at: source.created_at,
    created_by: source.created_by,
    updated_at: source.updated_at,
    updated_by: source.updated_by,
    criteria: [...criteria],
  }
}

function hierarchyGroups(): TechnicalConfigurationBaselineGroupWire[] {
  const [sourceGroup, secondSourceGroup] = createBaselineGroups()
  if (!sourceGroup || !secondSourceGroup || !sourceGroup.criteria[0]) {
    throw new Error("Expected hierarchy fixture sources.")
  }
  const sourceCriterion = sourceGroup.criteria[0]
  const groupA = {
    ...sourceGroup,
    id: "group-a",
    name: "Mục A",
    sort_order: 1,
  }
  const groupB = {
    ...secondSourceGroup,
    id: "group-b",
    name: "Mục B",
    sort_order: 2,
  }
  const directA2 = criterion(sourceCriterion, {
    id: "criterion-direct-a2",
    groupId: groupA.id,
    sortOrder: 2,
  })
  const directA1 = criterion(sourceCriterion, {
    id: "criterion-direct-a1",
    groupId: groupA.id,
    sortOrder: 1,
  })
  const subgroupA2 = subgroup(groupA, {
    id: "subgroup-a2",
    sortOrder: 2,
    criteria: [
      criterion(sourceCriterion, {
        id: "criterion-subgroup-a2",
        groupId: groupA.id,
        subgroupId: "subgroup-a2",
        sortOrder: 1,
      }),
    ],
  })
  const subgroupA1 = subgroup(groupA, {
    id: "subgroup-a1",
    sortOrder: 1,
    criteria: [
      criterion(sourceCriterion, {
        id: "criterion-subgroup-a1",
        groupId: groupA.id,
        subgroupId: "subgroup-a1",
        sortOrder: 1,
      }),
    ],
  })
  const emptySubgroup = subgroup(groupB, {
    id: "subgroup-empty",
    sortOrder: 1,
    criteria: [],
  })

  return [
    {
      ...groupB,
      criteria: [],
      subgroups: [emptySubgroup],
    },
    {
      ...groupA,
      criteria: [directA2, directA1],
      subgroups: [subgroupA2, subgroupA1],
    },
  ]
}

function criterionAxis(
  groups: readonly TechnicalConfigurationBaselineGroupWire[]
): TechnicalConfigurationResultExportCriterionAxisItemWire[] {
  return groups
    .flatMap((group) => [
      ...group.criteria,
      ...(group.subgroups ?? []).flatMap((item) => item.criteria),
    ])
    .map((item) => {
      const owner = groups.find((group) => group.id === item.group_id)
      if (!owner) throw new Error(`Missing group for ${item.id}.`)
      return {
        group_id: owner.id,
        group_name: owner.name,
        group_order: owner.sort_order,
        criterion_id: item.id,
        criterion_code: item.criterion_code,
        criterion_title: item.title,
        requirement_text: item.requirement_text,
        criterion_order: item.sort_order,
      }
    })
}

function matrixCell(
  criterionItem: TechnicalConfigurationResultExportCriterionAxisItemWire,
  option: TechnicalConfigurationResultExportOptionAxisItemWire,
  conclusion: TechnicalConfigurationResultExportMatrixCellWire["conclusion"]
): TechnicalConfigurationResultExportMatrixCellWire {
  return {
    ...criterionItem,
    ...option,
    response_text: `Phản hồi ${criterionItem.criterion_id}`,
    supplementary_information: null,
    document_links: [],
    technical_axis: conclusion === "not_evaluated" ? null : "meets",
    evidence_axis: conclusion === "not_evaluated" ? null : "complete",
    assessment_notes: null,
    conclusion,
  }
}

function hierarchyInput(criterionIds: readonly string[] | null = null) {
  const baselineGroups = hierarchyGroups()
  const axis = criterionAxis(baselineGroups)
  const selectedAxis =
    criterionIds === null ? axis : axis.filter((item) => criterionIds.includes(item.criterion_id))
  const optionOneStatuses = new Map<
    string,
    TechnicalConfigurationResultExportMatrixCellWire["conclusion"]
  >([
    ["criterion-direct-a1", "meets"],
    ["criterion-direct-a2", "fails"],
    ["criterion-subgroup-a1", "not_evaluated"],
    ["criterion-subgroup-a2", "not_applicable"],
  ])
  const matrix = selectedAxis.flatMap((criterionItem) =>
    OPTION_AXIS.map((option, optionIndex) =>
      matrixCell(
        criterionItem,
        option,
        optionIndex === 0 ? (optionOneStatuses.get(criterionItem.criterion_id) ?? "meets") : "meets"
      )
    )
  )

  return {
    baselineVersionId: "baseline-1",
    baselineGroups,
    optionAxis: OPTION_AXIS,
    criterionAxis: selectedAxis,
    matrix,
    criterionIds,
  } as const
}

describe("technical configuration result export hierarchy projection", () => {
  it("renders all sections, subgroups and criteria in canonical order with aggregates", () => {
    const rows = buildTechnicalConfigurationResultExportHierarchy(hierarchyInput())

    expect(
      rows.map((row) => [row.kind, row.kind === "criterion" ? row.criterion.criterion_id : row.id])
    ).toEqual([
      ["section", "group-a"],
      ["criterion", "criterion-direct-a1"],
      ["criterion", "criterion-direct-a2"],
      ["subgroup", "subgroup-a1"],
      ["criterion", "criterion-subgroup-a1"],
      ["subgroup", "subgroup-a2"],
      ["criterion", "criterion-subgroup-a2"],
      ["section", "group-b"],
      ["subgroup", "subgroup-empty"],
    ])

    const section = rows.find((row) => row.kind === "section" && row.id === "group-a")
    expect(section).toMatchObject({
      optionAggregates: [
        {
          optionId: "option-1",
          status: "failed",
          descendantCount: 4,
          statusCounts: {
            meets: 1,
            exceeds: 0,
            fails: 1,
            unclear: 0,
            insufficient_evidence: 0,
            not_applicable: 1,
            not_evaluated: 1,
          },
        },
        {
          optionId: "option-2",
          status: "passed",
          descendantCount: 4,
        },
      ],
    })
    const empty = rows.find((row) => row.kind === "subgroup" && row.id === "subgroup-empty")
    expect(empty?.optionAggregates).toEqual([
      expect.objectContaining({ optionId: "option-1", status: "no_criteria", descendantCount: 0 }),
      expect.objectContaining({ optionId: "option-2", status: "no_criteria", descendantCount: 0 }),
    ])
    expect(section).not.toHaveProperty("optionValues")
    expect(section).not.toHaveProperty("response_text")
    expect(section).not.toHaveProperty("conclusion")
  })

  it("keeps only canonical ancestors and descendants for a selected criterion scope", () => {
    const rows = buildTechnicalConfigurationResultExportHierarchy(
      hierarchyInput(["criterion-subgroup-a2"])
    )

    expect(
      rows.map((row) => [row.kind, row.kind === "criterion" ? row.criterion.criterion_id : row.id])
    ).toEqual([
      ["section", "group-a"],
      ["subgroup", "subgroup-a2"],
      ["criterion", "criterion-subgroup-a2"],
    ])
    expect(rows[0]).toMatchObject({
      optionAggregates: [
        { optionId: "option-1", status: "not_applicable", descendantCount: 1 },
        { optionId: "option-2", status: "passed", descendantCount: 1 },
      ],
    })
  })

  it("preserves legacy no-subgroup snapshots", () => {
    const baselineGroups = createBaselineGroups().map((group) => ({
      ...group,
      subgroups: undefined,
    }))
    const axis = criterionAxis(baselineGroups)
    const matrix = axis.flatMap((criterionItem) =>
      OPTION_AXIS.slice(0, 1).map((option) => matrixCell(criterionItem, option, "meets"))
    )

    const rows = buildTechnicalConfigurationResultExportHierarchy({
      baselineVersionId: "baseline-1",
      baselineGroups,
      optionAxis: OPTION_AXIS.slice(0, 1),
      criterionAxis: axis,
      matrix,
      criterionIds: null,
    })

    expect(rows.filter((row) => row.kind === "subgroup")).toEqual([])
    expect(rows.filter((row) => row.kind === "criterion")).toHaveLength(3)
  })

  it("fails closed for duplicate or inconsistent baseline ownership", () => {
    const input = hierarchyInput()
    const sourceGroup = input.baselineGroups.find((group) => group.criteria.length > 0)
    const duplicate = sourceGroup?.criteria[0]
    if (!sourceGroup || !duplicate) throw new Error("Expected a direct criterion to duplicate.")
    const malformedGroups = input.baselineGroups.map((group) =>
      group.id === sourceGroup.id
        ? { ...group, criteria: [...group.criteria, { ...duplicate }] }
        : group
    )

    expect(() =>
      buildTechnicalConfigurationResultExportHierarchy({
        ...input,
        baselineGroups: malformedGroups,
      })
    ).toThrow(/criterion criterion-direct-a2/i)
  })

  it("fails closed when the criterion axis requirement differs from the baseline", () => {
    const input = hierarchyInput()

    expect(() =>
      buildTechnicalConfigurationResultExportHierarchy({
        ...input,
        criterionAxis: [
          { ...input.criterionAxis[0], requirement_text: "Yêu cầu không khớp" },
          ...input.criterionAxis.slice(1),
        ],
      })
    ).toThrow(/hierarchy/i)
  })
})
