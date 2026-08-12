import { expect } from "vitest"

import type {
  TechnicalConfigurationDerivedStatus,
  TechnicalConfigurationEvidenceAxis,
  TechnicalConfigurationTechnicalAxis,
} from "@/lib/technical-configuration-evaluation"
import type { TechnicalConfigurationEvaluationProgress } from "@/app/(app)/technical-configurations/_components/evaluation/technical-configuration-evaluation-progress"
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

export function createCriterion(
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

export function createGroup(
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

export function createAssessment(
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

export function expectReconciledTotals(progress: TechnicalConfigurationEvaluationProgress): void {
  expect(progress.groups.reduce((sum, group) => sum + group.total, 0)).toBe(progress.total)
  expect(progress.groups.reduce((sum, group) => sum + group.evaluated, 0)).toBe(progress.evaluated)
  expect(Object.values(progress.statusCounts).reduce((sum, count) => sum + count, 0)).toBe(
    progress.total
  )
}
