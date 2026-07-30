import { describe, expect, it } from "vitest"

import type {
  TechnicalConfigurationDerivedStatus,
  TechnicalConfigurationEvidenceAxis,
  TechnicalConfigurationTechnicalAxis,
} from "@/lib/technical-configuration-evaluation"
import {
  buildTechnicalConfigurationEvaluationProgress,
  type TechnicalConfigurationEvaluationProgress,
} from "@/app/(app)/technical-configurations/_components/evaluation/technical-configuration-evaluation-progress"
import type { TechnicalConfigurationAssessmentWire } from "@/app/(app)/technical-configurations/assessment-types"
import type {
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineGroupWire,
} from "@/app/(app)/technical-configurations/baseline-types"

const STATUS_AXES: Record<
  TechnicalConfigurationDerivedStatus,
  readonly [TechnicalConfigurationTechnicalAxis | null, TechnicalConfigurationEvidenceAxis | null]
> = {
  not_evaluated: [null, null],
  not_applicable: ["not_applicable", null],
  fails: ["fails", null],
  unclear: ["unclear", null],
  insufficient_evidence: ["meets", "partial"],
  exceeds: ["exceeds", "complete"],
  meets: ["meets", "complete"],
}

function createCriterion(
  groupId: string,
  index: number
): TechnicalConfigurationBaselineCriterionWire {
  const id = `${groupId}-criterion-${index}`
  return {
    id,
    baseline_version_id: "baseline-1",
    group_id: groupId,
    criterion_code: `TC-${index.toString().padStart(3, "0")}`,
    title: `Tiêu chí ${index}`,
    requirement_text: `Yêu cầu ${index}`,
    sort_order: index,
    source_criterion_id: null,
    created_at: "2026-07-30T00:00:00.000Z",
    created_by: 1,
    updated_at: "2026-07-30T00:00:00.000Z",
    updated_by: 1,
  }
}

function createGroup(
  id: string,
  name: string,
  criterionCount: number
): TechnicalConfigurationBaselineGroupWire {
  return {
    id,
    baseline_version_id: "baseline-1",
    name,
    sort_order: Number(id.replace(/\D/g, "")) || 1,
    created_at: "2026-07-30T00:00:00.000Z",
    created_by: 1,
    updated_at: "2026-07-30T00:00:00.000Z",
    updated_by: 1,
    criteria: Array.from({ length: criterionCount }, (_, index) => createCriterion(id, index + 1)),
  }
}

function createAssessment(
  criterionId: string,
  status: TechnicalConfigurationDerivedStatus,
  optionId = "option-1"
): TechnicalConfigurationAssessmentWire {
  const [technicalAxis, evidenceAxis] = STATUS_AXES[status]
  return {
    id: `${optionId}-${criterionId}`,
    comparison_set_id: `comparison-set-${optionId}`,
    baseline_version_id: "baseline-1",
    criterion_id: criterionId,
    technical_axis: technicalAxis,
    evidence_axis: evidenceAxis,
    notes: "",
    revision: 1,
    created_by: 1,
    created_at: "2026-07-30T00:00:00.000Z",
    updated_by: 1,
    updated_at: "2026-07-30T00:00:00.000Z",
  }
}

function expectReconciledTotals(progress: TechnicalConfigurationEvaluationProgress): void {
  expect(progress.groups.reduce((sum, group) => sum + group.total, 0)).toBe(progress.total)
  expect(progress.groups.reduce((sum, group) => sum + group.evaluated, 0)).toBe(progress.evaluated)
  expect(Object.values(progress.statusCounts).reduce((sum, count) => sum + count, 0)).toBe(
    progress.total
  )
}

describe("P12B1 selected-option evaluation progress", () => {
  it("returns a stable zero model for an empty criterion universe", () => {
    const progress = buildTechnicalConfigurationEvaluationProgress({
      groups: [],
      assessments: [],
    })

    expect(progress).toEqual({
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

    expect(progress).toEqual({
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
})
