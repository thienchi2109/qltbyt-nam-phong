import { describe, expect, it } from "vitest"

import {
  buildTechnicalConfigurationEvaluationFilterCounts,
  buildTechnicalConfigurationEvaluationProgress,
} from "@/app/(app)/technical-configurations/_components/evaluation/technical-configuration-evaluation-progress"
import {
  createAssessment,
  createCriterion,
  createGroup,
  expectReconciledTotals,
} from "./technical-configuration-evaluation-progress.test-support"

describe("P12B1 selected-option evaluation progress", () => {
  it("returns a stable zero model for an empty criterion universe", () => {
    const progress = buildTechnicalConfigurationEvaluationProgress({
      groups: [],
      assessments: [],
    })

    expect(progress).toMatchObject({
      total: 0,
      evaluated: 0,
      statusCounts: {
        not_evaluated: 0,
        not_applicable: 0,
        fails: 0,
        unclear: 0,
        insufficient_evidence: 0,
        exceeds: 0,
        meets: 0,
      },
      groups: [],
    })
  })

  it("reconciles sparse mixed and repeated statuses by criterion_id", () => {
    const groups = [
      createGroup("group-1", "Thông số chính", 4),
      createGroup("group-2", "An toàn", 5),
    ]
    const assessments = [
      createAssessment("group-2-criterion-4", "meets"),
      createAssessment("group-1-criterion-3", "unclear"),
      createAssessment("group-2-criterion-1", "insufficient_evidence"),
      createAssessment("criterion-outside-selected-version", "exceeds"),
      createAssessment("group-1-criterion-1", "not_applicable"),
      createAssessment("group-1-criterion-4", "not_evaluated"),
      createAssessment("group-2-criterion-3", "meets"),
      createAssessment("group-1-criterion-2", "fails"),
      createAssessment("group-2-criterion-2", "exceeds"),
    ]

    const progress = buildTechnicalConfigurationEvaluationProgress({ groups, assessments })

    expect(progress).toMatchObject({
      total: 9,
      evaluated: 7,
      statusCounts: {
        not_evaluated: 2,
        not_applicable: 1,
        fails: 1,
        unclear: 1,
        insufficient_evidence: 1,
        exceeds: 1,
        meets: 2,
      },
      groups: [
        {
          id: "group-1",
          name: "Thông số chính",
          total: 4,
          evaluated: 3,
        },
        {
          id: "group-2",
          name: "An toàn",
          total: 5,
          evaluated: 4,
        },
      ],
    })
    expectReconciledTotals(progress)
  })

  it("uses the complete baseline universe when it contains more than 100 criteria", () => {
    const groups = [createGroup("group-1", "Nhóm một", 60), createGroup("group-2", "Nhóm hai", 55)]
    const assessments = groups
      .flatMap((group) => group.criteria)
      .slice(0, 100)
      .map((criterion) => createAssessment(criterion.id, "meets"))

    const progress = buildTechnicalConfigurationEvaluationProgress({ groups, assessments })

    expect(progress.total).toBe(115)
    expect(progress.evaluated).toBe(100)
    expect(progress.statusCounts.not_evaluated).toBe(15)
    expect(progress.statusCounts.meets).toBe(100)
    expect(progress.groups).toEqual([
      { id: "group-1", name: "Nhóm một", total: 60, evaluated: 60 },
      { id: "group-2", name: "Nhóm hai", total: 55, evaluated: 40 },
    ])
    expectReconciledTotals(progress)
  })

  it("counts subgroup-exclusive criteria in full-universe progress", () => {
    const group = createGroup("group-1", "Thông số chính", 1)
    const subgroupCriterion = {
      ...createCriterion(group.id, 2),
      subgroup_id: "subgroup-1",
    }
    group.subgroups = [
      {
        id: "subgroup-1",
        baseline_version_id: group.baseline_version_id,
        group_id: group.id,
        name: "Nhóm con",
        sort_order: 1,
        created_at: group.created_at,
        created_by: group.created_by,
        updated_at: group.updated_at,
        updated_by: group.updated_by,
        criteria: [subgroupCriterion],
      },
    ]

    const progress = buildTechnicalConfigurationEvaluationProgress({
      groups: [group],
      assessments: [createAssessment(subgroupCriterion.id, "fails")],
    })

    expect(progress).toMatchObject({
      total: 2,
      evaluated: 1,
      statusCounts: {
        not_evaluated: 1,
        fails: 1,
      },
      groups: [{ id: group.id, total: 2, evaluated: 1 }],
    })
  })

  it("exposes mixed and empty section and subgroup aggregates", () => {
    const group = createGroup("group-1", "Thông số chính", 1)
    const subgroupCriterion = {
      ...createCriterion(group.id, 2),
      subgroup_id: "subgroup-mixed",
    }
    group.subgroups = [
      {
        id: "subgroup-empty",
        baseline_version_id: group.baseline_version_id,
        group_id: group.id,
        name: "Nhóm trống",
        sort_order: 1,
        created_at: group.created_at,
        created_by: group.created_by,
        updated_at: group.updated_at,
        updated_by: group.updated_by,
        criteria: [],
      },
      {
        id: "subgroup-mixed",
        baseline_version_id: group.baseline_version_id,
        group_id: group.id,
        name: "Nhóm hỗn hợp",
        sort_order: 2,
        created_at: group.created_at,
        created_by: group.created_by,
        updated_at: group.updated_at,
        updated_by: group.updated_by,
        criteria: [subgroupCriterion],
      },
    ]

    const progress = buildTechnicalConfigurationEvaluationProgress({
      groups: [group, createGroup("group-2", "Nhóm trống", 0)],
      assessments: [
        createAssessment(group.criteria[0].id, "meets"),
        createAssessment(subgroupCriterion.id, "fails"),
      ],
    })

    expect(progress.hierarchy).toEqual([
      expect.objectContaining({
        id: "group-1",
        total: 2,
        evaluated: 2,
        status: "failed",
        subgroups: [
          expect.objectContaining({
            id: "subgroup-empty",
            total: 0,
            evaluated: 0,
            status: "no_criteria",
          }),
          expect.objectContaining({
            id: "subgroup-mixed",
            total: 1,
            evaluated: 1,
            status: "failed",
          }),
        ],
      }),
      expect.objectContaining({
        id: "group-2",
        total: 0,
        evaluated: 0,
        status: "no_criteria",
        subgroups: [],
      }),
    ])
  })

  it("counts more than 100 mixed direct and subgroup leaves exactly once", () => {
    const group = createGroup("group-1", "Thông số chính", 51)
    const subgroupCriteria = Array.from({ length: 55 }, (_, index) => ({
      ...createCriterion(group.id, index + 52),
      subgroup_id: "subgroup-1",
    }))
    group.subgroups = [
      {
        id: "subgroup-1",
        baseline_version_id: group.baseline_version_id,
        group_id: group.id,
        name: "Nhóm con",
        sort_order: 1,
        created_at: group.created_at,
        created_by: group.created_by,
        updated_at: group.updated_at,
        updated_by: group.updated_by,
        criteria: subgroupCriteria,
      },
    ]
    const assessedCriteria = [...group.criteria, ...subgroupCriteria].slice(0, 101)

    const progress = buildTechnicalConfigurationEvaluationProgress({
      groups: [group],
      assessments: assessedCriteria.map((criterion) => createAssessment(criterion.id, "meets")),
    })

    expect(progress).toMatchObject({
      total: 106,
      evaluated: 101,
      statusCounts: { meets: 101, not_evaluated: 5 },
      groups: [{ id: "group-1", total: 106, evaluated: 101 }],
      hierarchy: [
        expect.objectContaining({
          id: "group-1",
          total: 106,
          evaluated: 101,
          subgroups: [
            expect.objectContaining({
              id: "subgroup-1",
              total: 55,
              evaluated: 50,
            }),
          ],
        }),
      ],
    })
    expectReconciledTotals(progress)
  })

  it("derives progress only from the currently selected option assessments", () => {
    const groups = [createGroup("group-1", "Thông số chính", 3)]
    const optionAProgress = buildTechnicalConfigurationEvaluationProgress({
      groups,
      assessments: [
        createAssessment("group-1-criterion-1", "meets", "option-a"),
        createAssessment("group-1-criterion-2", "fails", "option-a"),
      ],
    })
    const optionBProgress = buildTechnicalConfigurationEvaluationProgress({
      groups,
      assessments: [createAssessment("group-1-criterion-3", "exceeds", "option-b")],
    })

    expect(optionAProgress.evaluated).toBe(2)
    expect(optionAProgress.statusCounts.fails).toBe(1)
    expect(optionBProgress.evaluated).toBe(1)
    expect(optionBProgress.statusCounts.fails).toBe(0)
    expect(optionBProgress.statusCounts.exceeds).toBe(1)
    expectReconciledTotals(optionAProgress)
    expectReconciledTotals(optionBProgress)
  })

  it("maps full-universe progress to the four stable filter counts", () => {
    const progress = buildTechnicalConfigurationEvaluationProgress({
      groups: [createGroup("group-1", "Thông số chính", 5)],
      assessments: [
        createAssessment("group-1-criterion-1", "meets"),
        createAssessment("group-1-criterion-2", "fails"),
        createAssessment("group-1-criterion-3", "insufficient_evidence"),
      ],
    })

    expect(buildTechnicalConfigurationEvaluationFilterCounts(progress)).toEqual({
      all: 5,
      not_evaluated: 2,
      fails: 1,
      insufficient_evidence: 1,
    })
  })
})
