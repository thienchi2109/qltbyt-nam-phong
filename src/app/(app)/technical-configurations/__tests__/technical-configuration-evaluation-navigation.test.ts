import { describe, expect, it } from "vitest"

import {
  buildTechnicalConfigurationEvaluationHierarchyRows,
  flattenTechnicalConfigurationEvaluationLeaves,
} from "../_components/evaluation/technical-configuration-evaluation-hierarchy"
import {
  buildTechnicalConfigurationEvaluationProjection,
  findTechnicalConfigurationEvaluationCriterion,
  findNextTechnicalConfigurationEvaluationCriterion,
  getTechnicalConfigurationEvaluationPage,
} from "../_components/evaluation/technical-configuration-evaluation-navigation"
import { buildTechnicalConfigurationEvaluationProgress } from "../_components/evaluation/technical-configuration-evaluation-progress"
import { createAssessment } from "./technical-configuration-evaluation-progress.test-support"
import { createBaselineGroups } from "./technical-configuration-evaluation-workspace.test-support"

const serverEntries = [
  { criterion_id: "criterion-1", canonical_index: 1, canonical_page: 1 },
  { criterion_id: "criterion-3", canonical_index: 3, canonical_page: 2 },
] as const

describe("P12B2 evaluation navigation projection", () => {
  it("uses the exact server-filtered IDs in canonical response order", () => {
    const projection = buildTechnicalConfigurationEvaluationProjection({
      groups: createBaselineGroups(),
      entries: serverEntries,
    })

    expect(projection.map((item) => item.criterion.id)).toEqual(["criterion-1", "criterion-3"])
    expect(projection.map((item) => item.canonicalPage)).toEqual([1, 2])
  })

  it("paginates the server-filtered projection without changing canonical page mapping", () => {
    const projection = buildTechnicalConfigurationEvaluationProjection({
      groups: createBaselineGroups(),
      entries: [
        { criterion_id: "criterion-1", canonical_index: 1, canonical_page: 1 },
        { criterion_id: "criterion-2", canonical_index: 2, canonical_page: 1 },
        { criterion_id: "criterion-3", canonical_index: 3, canonical_page: 2 },
      ],
    })

    expect(
      getTechnicalConfigurationEvaluationPage({
        projection,
        page: 2,
        pageSize: 2,
      }).map((item) => ({
        criterionId: item.criterion.id,
        canonicalPage: item.canonicalPage,
      }))
    ).toEqual([{ criterionId: "criterion-3", canonicalPage: 2 }])
  })

  it("finds the next matching criterion by canonical position and never wraps", () => {
    const projection = buildTechnicalConfigurationEvaluationProjection({
      groups: createBaselineGroups(),
      entries: serverEntries,
    })

    expect(
      findNextTechnicalConfigurationEvaluationCriterion({
        projection,
        currentCanonicalIndex: 1,
      })?.criterion.id
    ).toBe("criterion-3")
    expect(
      findNextTechnicalConfigurationEvaluationCriterion({
        projection,
        currentCanonicalIndex: 3,
      })
    ).toBeNull()
  })

  it("projects and resolves criteria nested under a subgroup", () => {
    const groups = createBaselineGroups()
    const subgroupCriterion = {
      ...groups[0].criteria[0],
      id: "criterion-subgroup",
      subgroup_id: "subgroup-1",
    }
    groups[0].subgroups = [
      {
        id: "subgroup-1",
        baseline_version_id: groups[0].baseline_version_id,
        group_id: groups[0].id,
        name: "Nhóm con",
        sort_order: 1,
        created_at: groups[0].created_at,
        created_by: groups[0].created_by,
        updated_at: groups[0].updated_at,
        updated_by: groups[0].updated_by,
        criteria: [subgroupCriterion],
      },
    ]

    const projection = buildTechnicalConfigurationEvaluationProjection({
      groups,
      entries: [
        {
          criterion_id: subgroupCriterion.id,
          canonical_index: 4,
          canonical_page: 2,
        },
      ],
    })

    expect(projection).toHaveLength(1)
    expect(projection[0]).toMatchObject({
      subgroup: { id: "subgroup-1", name: "Nhóm con", sortOrder: 1 },
      criterion: { id: subgroupCriterion.id },
      canonicalIndex: 4,
      canonicalPage: 2,
    })
    expect(
      findTechnicalConfigurationEvaluationCriterion({
        groups,
        criterionId: subgroupCriterion.id,
        pageSize: 2,
      })
    ).toMatchObject({
      subgroup: { id: "subgroup-1" },
      criterion: { id: subgroupCriterion.id },
      canonicalIndex: 3,
      canonicalPage: 2,
    })
  })

  it("keeps invalid subgroup ownership out of every evaluation leaf surface", () => {
    const groups = createBaselineGroups()
    const invalidCriterionId = "criterion-invalid-subgroup"
    groups[0].criteria.push({
      ...groups[0].criteria[0],
      id: invalidCriterionId,
      subgroup_id: "missing-subgroup",
    })
    const leaves = flattenTechnicalConfigurationEvaluationLeaves(groups)
    const canonicalCriterionIds = leaves.map((leaf) => leaf.criterion.id)

    const projection = buildTechnicalConfigurationEvaluationProjection({
      groups,
      entries: [
        ...leaves.map((leaf) => ({
          criterion_id: leaf.criterion.id,
          canonical_index: leaf.canonicalIndex,
          canonical_page: Math.ceil(leaf.canonicalIndex / 2),
        })),
        { criterion_id: invalidCriterionId, canonical_index: 4, canonical_page: 2 },
      ],
    })
    const hierarchyCriterionIds = buildTechnicalConfigurationEvaluationHierarchyRows(leaves)
      .filter((row) => row.kind === "criterion")
      .map((row) => row.row.criterion.id)
    const progress = buildTechnicalConfigurationEvaluationProgress({
      groups,
      assessments: [
        ...canonicalCriterionIds.map((criterionId) => createAssessment(criterionId, "meets")),
        createAssessment(invalidCriterionId, "fails"),
      ],
    })

    expect(projection.map((item) => item.criterion.id)).toEqual(canonicalCriterionIds)
    expect(hierarchyCriterionIds).toEqual(canonicalCriterionIds)
    expect(
      canonicalCriterionIds.map(
        (criterionId) =>
          findTechnicalConfigurationEvaluationCriterion({
            groups,
            criterionId,
            pageSize: 2,
          })?.criterion.id
      )
    ).toEqual(canonicalCriterionIds)
    expect(
      findTechnicalConfigurationEvaluationCriterion({
        groups,
        criterionId: invalidCriterionId,
        pageSize: 2,
      })
    ).toBeNull()
    expect(progress).toMatchObject({
      total: canonicalCriterionIds.length,
      evaluated: canonicalCriterionIds.length,
      statusCounts: {
        meets: canonicalCriterionIds.length,
        fails: 0,
      },
    })
  })
})
