import type {
  TechnicalConfigurationEvidenceAxis,
  TechnicalConfigurationTechnicalAxis,
} from "@/lib/technical-configuration-evaluation"

import type { TechnicalConfigurationComparisonSetWire } from "./supplier-option-types"

export interface TechnicalConfigurationAssessmentWire {
  id: string
  comparison_set_id: string
  baseline_version_id: string
  criterion_id: string
  technical_axis: TechnicalConfigurationTechnicalAxis | null
  evidence_axis: TechnicalConfigurationEvidenceAxis | null
  notes: string
  revision: number
  created_by: number
  created_at: string
  updated_by: number
  updated_at: string
}

export interface TechnicalConfigurationAssessmentListWireResponse {
  data: TechnicalConfigurationAssessmentWire[]
  total: number
  page: number
  page_size: number
}

export interface TechnicalConfigurationAssessmentWireResponse {
  data: TechnicalConfigurationAssessmentWire
}

export interface TechnicalConfigurationAssessmentListRpcArgs {
  p_comparison_set_id: string
  p_page: number
  p_page_size: number
}

/** Stable server-supported filters for the evaluation criterion navigator. */
export const TECHNICAL_CONFIGURATION_EVALUATION_STATUS_FILTERS = [
  "all",
  "not_evaluated",
  "fails",
  "insufficient_evidence",
] as const

export type TechnicalConfigurationEvaluationStatusFilter =
  (typeof TECHNICAL_CONFIGURATION_EVALUATION_STATUS_FILTERS)[number]

export interface TechnicalConfigurationEvaluationCriterionWire {
  criterion_id: string
  canonical_index: number
  canonical_page: number
}

export interface TechnicalConfigurationEvaluationCriterionListWireResponse {
  data: TechnicalConfigurationEvaluationCriterionWire[]
  total: number
  page: number
  page_size: number
}

export interface TechnicalConfigurationEvaluationCriterionListRpcArgs {
  p_option_id: string
  p_baseline_version_id: string
  p_status_filter: TechnicalConfigurationEvaluationStatusFilter
  p_page: number
  p_page_size: number
}

export interface TechnicalConfigurationAssessmentUpsertRpcArgs {
  p_comparison_set_id: string
  p_criterion_id: string
  p_technical_axis: TechnicalConfigurationTechnicalAxis | null
  p_evidence_axis: TechnicalConfigurationEvidenceAxis | null
  p_notes: string | null
  p_expected_revision: number
}

export interface TechnicalConfigurationAssessmentUpsertInput {
  criterionId: string
  technicalAxis: TechnicalConfigurationTechnicalAxis | null
  evidenceAxis: TechnicalConfigurationEvidenceAxis | null
  notes: string | null
  expectedRevision: number
  expectedDossierRevision: number
}

export interface TechnicalConfigurationAssessmentSaveResult {
  comparisonSet: TechnicalConfigurationComparisonSetWire
  assessment: TechnicalConfigurationAssessmentWire
}
