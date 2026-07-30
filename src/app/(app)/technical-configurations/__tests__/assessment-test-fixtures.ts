import type {
  TechnicalConfigurationAssessmentListWireResponse,
  TechnicalConfigurationAssessmentUpsertInput,
  TechnicalConfigurationAssessmentWire,
} from "../assessment-types"
import type { TechnicalConfigurationComparisonSetWire } from "../supplier-option-types"

export const optionId = "00000000-0000-0000-0000-000000000001"
export const baselineVersionId = "00000000-0000-0000-0000-000000000002"
export const comparisonSetId = "00000000-0000-0000-0000-000000000003"
export const criterionId = "00000000-0000-0000-0000-000000000004"

export const comparisonSet: TechnicalConfigurationComparisonSetWire = {
  id: comparisonSetId,
  dossier_id: "00000000-0000-0000-0000-000000000005",
  option_id: optionId,
  baseline_version_id: baselineVersionId,
  created_at: "2026-07-30T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-30T00:00:00.000Z",
  updated_by: 1,
  revision: 7,
  responses: [],
}

export const assessment: TechnicalConfigurationAssessmentWire = {
  id: "00000000-0000-0000-0000-000000000006",
  comparison_set_id: comparisonSetId,
  baseline_version_id: baselineVersionId,
  criterion_id: criterionId,
  technical_axis: "meets",
  evidence_axis: "partial",
  notes: "Cần bổ sung chứng cứ.",
  revision: 2,
  created_by: 1,
  created_at: "2026-07-30T00:00:00.000Z",
  updated_by: 2,
  updated_at: "2026-07-30T01:00:00.000Z",
}

export const savedAssessment: TechnicalConfigurationAssessmentWire = {
  ...assessment,
  technical_axis: "exceeds",
  evidence_axis: "complete",
  notes: "Đã xác nhận.",
  revision: 3,
}

export const assessmentListResponse: TechnicalConfigurationAssessmentListWireResponse = {
  data: [assessment],
  total: 1,
  page: 1,
  page_size: 25,
}

export const assessmentUpsertInput: TechnicalConfigurationAssessmentUpsertInput = {
  criterionId,
  technicalAxis: "meets",
  evidenceAxis: "partial",
  notes: "Cần bổ sung chứng cứ.",
  expectedRevision: 1,
  expectedDossierRevision: 6,
}
