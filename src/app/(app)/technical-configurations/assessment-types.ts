import type {
  TechnicalConfigurationEvidenceAxis,
  TechnicalConfigurationTechnicalAxis,
} from "@/lib/technical-configuration-evaluation"

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
