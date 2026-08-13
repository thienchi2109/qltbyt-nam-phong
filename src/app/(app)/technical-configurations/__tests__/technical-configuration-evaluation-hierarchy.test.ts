import { describe, expect, it } from "vitest"

import {
  buildTechnicalConfigurationEvaluationHierarchyRows,
  buildTechnicalConfigurationEvaluationHierarchySections,
  flattenTechnicalConfigurationEvaluationLeaves,
} from "../_components/evaluation/technical-configuration-evaluation-hierarchy"
import type {
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineGroupWire,
  TechnicalConfigurationBaselineSubgroupWire,
} from "../baseline-types"

const TIMESTAMP = "2026-08-12T00:00:00.000Z"

function createCriterion({
  id,
  groupId,
  sortOrder,
  subgroupId,
}: {
  id: string
  groupId: string
  sortOrder: number
  subgroupId?: string | null
}): TechnicalConfigurationBaselineCriterionWire {
  return {
    id,
    baseline_version_id: "baseline-1",
    group_id: groupId,
    subgroup_id: subgroupId,
    criterion_code: id.toUpperCase(),
    title: id,
    requirement_text: `Requirement ${id}`,
    sort_order: sortOrder,
    source_criterion_id: null,
    created_at: TIMESTAMP,
    created_by: 1,
    updated_at: TIMESTAMP,
    updated_by: 1,
  }
}

function createSubgroup({
  id,
  groupId,
  sortOrder,
  criteria = [],
}: {
  id: string
  groupId: string
  sortOrder: number
  criteria?: TechnicalConfigurationBaselineCriterionWire[]
}): TechnicalConfigurationBaselineSubgroupWire {
  return {
    id,
    baseline_version_id: "baseline-1",
    group_id: groupId,
    name: id,
    sort_order: sortOrder,
    created_at: TIMESTAMP,
    created_by: 1,
    updated_at: TIMESTAMP,
    updated_by: 1,
    criteria,
  }
}

function createGroup({
  id,
  sortOrder,
  criteria = [],
  subgroups,
}: {
  id: string
  sortOrder: number
  criteria?: TechnicalConfigurationBaselineCriterionWire[]
  subgroups?: TechnicalConfigurationBaselineSubgroupWire[]
}): TechnicalConfigurationBaselineGroupWire {
  return {
    id,
    baseline_version_id: "baseline-1",
    name: id,
    sort_order: sortOrder,
    created_at: TIMESTAMP,
    created_by: 1,
    updated_at: TIMESTAMP,
    updated_by: 1,
    criteria,
    ...(subgroups ? { subgroups } : {}),
  }
}

describe("P5C evaluation hierarchy model", () => {
  it("sorts the canonical tuple with direct leaves before complete subgroup blocks", () => {
    const groups = [
      createGroup({
        id: "section-b",
        sortOrder: 1,
        criteria: [createCriterion({ id: "direct-b", groupId: "section-b", sortOrder: 1 })],
      }),
      createGroup({
        id: "section-a",
        sortOrder: 1,
        criteria: [
          createCriterion({ id: "direct-z", groupId: "section-a", sortOrder: 1 }),
          createCriterion({ id: "direct-a", groupId: "section-a", sortOrder: 1 }),
        ],
        subgroups: [
          createSubgroup({
            id: "subgroup-b",
            groupId: "section-a",
            sortOrder: 1,
            criteria: [
              createCriterion({
                id: "subgroup-b-leaf",
                groupId: "section-a",
                subgroupId: "subgroup-b",
                sortOrder: 1,
              }),
            ],
          }),
          createSubgroup({
            id: "subgroup-a",
            groupId: "section-a",
            sortOrder: 1,
            criteria: [
              createCriterion({
                id: "subgroup-leaf-z",
                groupId: "section-a",
                subgroupId: "subgroup-a",
                sortOrder: 1,
              }),
              createCriterion({
                id: "subgroup-leaf-a",
                groupId: "section-a",
                subgroupId: "subgroup-a",
                sortOrder: 1,
              }),
            ],
          }),
        ],
      }),
    ]
    const originalGroupIds = groups.map((group) => group.id)

    const leaves = flattenTechnicalConfigurationEvaluationLeaves(groups)

    expect(leaves.map((leaf) => leaf.criterion.id)).toEqual([
      "direct-a",
      "direct-z",
      "subgroup-leaf-a",
      "subgroup-leaf-z",
      "subgroup-b-leaf",
      "direct-b",
    ])
    expect(leaves.map((leaf) => leaf.canonicalIndex)).toEqual([1, 2, 3, 4, 5, 6])
    expect(leaves[2]).toMatchObject({
      group: { id: "section-a" },
      subgroup: { id: "subgroup-a" },
      criterion: { id: "subgroup-leaf-a" },
    })
    expect(groups.map((group) => group.id)).toEqual(originalGroupIds)
  })

  it("validates ownership and keeps the first canonical occurrence of duplicate IDs", () => {
    const groups = [
      createGroup({
        id: "section-a",
        sortOrder: 1,
        criteria: [
          createCriterion({ id: "criterion-shared", groupId: "section-a", sortOrder: 1 }),
          createCriterion({ id: "wrong-group", groupId: "section-b", sortOrder: 2 }),
          createCriterion({
            id: "misplaced-subgroup",
            groupId: "section-a",
            subgroupId: "subgroup-a",
            sortOrder: 3,
          }),
        ],
        subgroups: [
          createSubgroup({
            id: "subgroup-a",
            groupId: "section-a",
            sortOrder: 1,
            criteria: [
              createCriterion({
                id: "criterion-shared",
                groupId: "section-a",
                subgroupId: "subgroup-a",
                sortOrder: 1,
              }),
              createCriterion({
                id: "wrong-subgroup",
                groupId: "section-a",
                subgroupId: "subgroup-b",
                sortOrder: 2,
              }),
              createCriterion({
                id: "valid-subgroup",
                groupId: "section-a",
                subgroupId: "subgroup-a",
                sortOrder: 3,
              }),
            ],
          }),
          createSubgroup({
            id: "foreign-subgroup",
            groupId: "section-b",
            sortOrder: 2,
            criteria: [
              createCriterion({
                id: "foreign-leaf",
                groupId: "section-a",
                subgroupId: "foreign-subgroup",
                sortOrder: 1,
              }),
            ],
          }),
        ],
      }),
    ]

    const leaves = flattenTechnicalConfigurationEvaluationLeaves(groups)

    expect(leaves.map((leaf) => leaf.criterion.id)).toEqual(["criterion-shared", "valid-subgroup"])
    expect(leaves[0]?.subgroup).toBeUndefined()
  })

  it("supports legacy direct-only snapshots without a subgroup array", () => {
    const leaves = flattenTechnicalConfigurationEvaluationLeaves([
      createGroup({
        id: "section-legacy",
        sortOrder: 1,
        criteria: [
          createCriterion({ id: "legacy-b", groupId: "section-legacy", sortOrder: 2 }),
          createCriterion({ id: "legacy-a", groupId: "section-legacy", sortOrder: 1 }),
        ],
      }),
    ])

    expect(leaves.map((leaf) => leaf.criterion.id)).toEqual(["legacy-a", "legacy-b"])
    expect(leaves.every((leaf) => leaf.subgroup === undefined)).toBe(true)
  })

  it("builds page-local rows and omits empty structures", () => {
    const groups = [
      createGroup({
        id: "section-a",
        sortOrder: 1,
        subgroups: [
          createSubgroup({ id: "subgroup-empty", groupId: "section-a", sortOrder: 1 }),
          createSubgroup({
            id: "subgroup-full",
            groupId: "section-a",
            sortOrder: 2,
            criteria: [
              createCriterion({
                id: "subgroup-leaf",
                groupId: "section-a",
                subgroupId: "subgroup-full",
                sortOrder: 1,
              }),
            ],
          }),
        ],
      }),
      createGroup({ id: "section-empty", sortOrder: 2 }),
      createGroup({
        id: "section-b",
        sortOrder: 3,
        criteria: [createCriterion({ id: "direct-leaf", groupId: "section-b", sortOrder: 1 })],
      }),
    ]
    const leaves = flattenTechnicalConfigurationEvaluationLeaves(groups)

    const rows = buildTechnicalConfigurationEvaluationHierarchyRows(leaves)

    expect(
      rows.map((row) =>
        row.kind === "criterion" ? `${row.kind}:${row.row.criterion.id}` : `${row.kind}:${row.id}`
      )
    ).toEqual([
      "section:section-a",
      "subgroup:subgroup-full",
      "criterion:subgroup-leaf",
      "section:section-b",
      "criterion:direct-leaf",
    ])
  })

  it("keeps empty sections and subgroups in full-universe aggregate inputs", () => {
    const groups = [
      createGroup({
        id: "section-a",
        sortOrder: 1,
        subgroups: [createSubgroup({ id: "subgroup-empty", groupId: "section-a", sortOrder: 1 })],
      }),
    ]
    const leaves = flattenTechnicalConfigurationEvaluationLeaves(groups)

    expect(buildTechnicalConfigurationEvaluationHierarchySections(groups, leaves)).toEqual([
      {
        id: "section-a",
        name: "section-a",
        sortOrder: 1,
        criterionIds: [],
        subgroups: [
          {
            id: "subgroup-empty",
            name: "subgroup-empty",
            sortOrder: 1,
            criterionIds: [],
          },
        ],
      },
    ])
  })
})
