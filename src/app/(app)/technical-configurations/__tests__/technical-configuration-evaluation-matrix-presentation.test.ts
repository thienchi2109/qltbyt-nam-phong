import { describe, expect, it } from "vitest"

import type { TechnicalConfigurationAssessmentWire } from "../assessment-types"
import type { TechnicalConfigurationBaselineGroupWire } from "../baseline-types"
import { buildTechnicalConfigurationEvaluationMatrixPresentation } from "../_components/evaluation/technical-configuration-evaluation-matrix-presentation"

const TIMESTAMP = "2026-08-04T00:00:00.000Z"

function createAssessment(
  criterionId: string,
  technicalAxis: TechnicalConfigurationAssessmentWire["technical_axis"],
  evidenceAxis: TechnicalConfigurationAssessmentWire["evidence_axis"]
): TechnicalConfigurationAssessmentWire {
  return {
    id: `assessment-${criterionId}`,
    comparison_set_id: "comparison-set-1",
    baseline_version_id: "baseline-1",
    criterion_id: criterionId,
    technical_axis: technicalAxis,
    evidence_axis: evidenceAxis,
    notes: "",
    revision: 1,
    created_by: 1,
    created_at: TIMESTAMP,
    updated_by: 1,
    updated_at: TIMESTAMP,
  }
}

const groups: TechnicalConfigurationBaselineGroupWire[] = [
  {
    id: "group-1",
    baseline_version_id: "baseline-1",
    name: "Nhóm 1",
    sort_order: 1,
    created_at: TIMESTAMP,
    created_by: 1,
    updated_at: TIMESTAMP,
    updated_by: 1,
    criteria: [
      {
        id: "criterion-1",
        baseline_version_id: "baseline-1",
        group_id: "group-1",
        criterion_code: "TC-01",
        title: "Tiêu chí 1",
        requirement_text: "Yêu cầu 1",
        sort_order: 1,
        source_criterion_id: null,
        created_at: TIMESTAMP,
        created_by: 1,
        updated_at: TIMESTAMP,
        updated_by: 1,
      },
      {
        id: "criterion-2",
        baseline_version_id: "baseline-1",
        group_id: "group-1",
        criterion_code: "TC-02",
        title: "Tiêu chí 2",
        requirement_text: "Yêu cầu 2",
        sort_order: 2,
        source_criterion_id: null,
        created_at: TIMESTAMP,
        created_by: 1,
        updated_at: TIMESTAMP,
        updated_by: 1,
      },
    ],
  },
]

describe("buildTechnicalConfigurationEvaluationMatrixPresentation", () => {
  it("builds progress and row statuses from the same assessment collection", () => {
    const assessment = createAssessment("criterion-1", "meets", "complete")

    const presentation = buildTechnicalConfigurationEvaluationMatrixPresentation({
      groups,
      assessmentsByCriterionId: { "criterion-1": assessment },
      projection: [],
      statusFilter: "all",
    })

    expect(presentation.progress).toMatchObject({
      total: 2,
      evaluated: 1,
      statusCounts: {
        meets: 1,
        not_evaluated: 1,
      },
    })
    expect(presentation.assessmentStatusByCriterionId.get("criterion-1")).toBe("meets")
    expect(presentation.matchingEvaluationCriterionIds).toBeUndefined()
  })

  it("limits matrix actions to criteria returned by an active evaluation filter", () => {
    const presentation = buildTechnicalConfigurationEvaluationMatrixPresentation({
      groups,
      assessmentsByCriterionId: {},
      projection: [{ criterion: { id: "criterion-2" } }],
      statusFilter: "not_evaluated",
    })

    expect(presentation.matchingEvaluationCriterionIds).toEqual(new Set(["criterion-2"]))
  })
})
