import type { TechnicalConfigurationBaselineStatus } from "./baseline-types"

export interface TechnicalConfigurationComparisonRequest {
  baselineVersionId: string
  optionIds: readonly string[]
  page: number
  pageSize: number
}

export interface TechnicalConfigurationComparisonRpcArgs {
  p_baseline_version_id: string
  p_option_ids: readonly string[]
  p_page: number
  p_page_size: number
}

export interface TechnicalConfigurationComparisonEvidenceWire {
  document_count: number
  citation_count: number
  has_evidence: boolean
}

export interface TechnicalConfigurationComparisonResponseWire {
  id: string
  response_text: string
  supplementary_information: string
}

export interface TechnicalConfigurationComparisonOptionValueWire {
  option_id: string
  comparison_set_id: string | null
  response: TechnicalConfigurationComparisonResponseWire | null
  evidence: TechnicalConfigurationComparisonEvidenceWire
}

export interface TechnicalConfigurationComparisonGroupWire {
  id: string
  name: string
  sort_order: number
}

export interface TechnicalConfigurationComparisonCriterionWire {
  id: string
  criterion_code: string
  title: string | null
  requirement_text: string
  sort_order: number
}

export interface TechnicalConfigurationComparisonCriterionRowWire {
  group: TechnicalConfigurationComparisonGroupWire
  criterion: TechnicalConfigurationComparisonCriterionWire
  baseline_evidence: TechnicalConfigurationComparisonEvidenceWire
  option_values: TechnicalConfigurationComparisonOptionValueWire[]
}

export interface TechnicalConfigurationComparisonDossierWire {
  id: string
  device_type_name: string
  name: string
  revision: number
  archived_at: string | null
}

export interface TechnicalConfigurationComparisonBaselineVersionWire {
  id: string
  dossier_id: string
  version_number: number
  status: TechnicalConfigurationBaselineStatus
  revision: number
}

export interface TechnicalConfigurationComparisonOptionWire {
  id: string
  supplier_id: string
  supplier_name: string
  model: string | null
  manufacturer: string | null
  option_name: string | null
  display_label: string
}

export interface TechnicalConfigurationComparisonDataWire {
  dossier: TechnicalConfigurationComparisonDossierWire
  baseline_version: TechnicalConfigurationComparisonBaselineVersionWire
  options: TechnicalConfigurationComparisonOptionWire[]
  criteria: TechnicalConfigurationComparisonCriterionRowWire[]
}

export interface TechnicalConfigurationComparisonWireResponse {
  data: TechnicalConfigurationComparisonDataWire
  total: number
  page: number
  page_size: number
}

export interface TechnicalConfigurationComparisonEvidence {
  documentCount: number
  citationCount: number
  hasEvidence: boolean
}

export interface TechnicalConfigurationComparisonResponse {
  id: string
  responseText: string
  supplementaryInformation: string
}

export interface TechnicalConfigurationComparisonOptionValue {
  optionId: string
  comparisonSetId: string | null
  response: TechnicalConfigurationComparisonResponse | null
  evidence: TechnicalConfigurationComparisonEvidence
}

export interface TechnicalConfigurationComparisonGroup {
  id: string
  name: string
  sortOrder: number
}

export interface TechnicalConfigurationComparisonCriterion {
  id: string
  criterionCode: string
  title: string | null
  requirementText: string
  sortOrder: number
}

export interface TechnicalConfigurationComparisonCriterionRow {
  group: TechnicalConfigurationComparisonGroup
  criterion: TechnicalConfigurationComparisonCriterion
  baselineEvidence: TechnicalConfigurationComparisonEvidence
  optionValues: TechnicalConfigurationComparisonOptionValue[]
}

export interface TechnicalConfigurationComparisonDossier {
  id: string
  deviceTypeName: string
  name: string
  revision: number
  archivedAt: string | null
}

export interface TechnicalConfigurationComparisonBaselineVersion {
  id: string
  dossierId: string
  versionNumber: number
  status: TechnicalConfigurationBaselineStatus
  revision: number
}

export interface TechnicalConfigurationComparisonOption {
  id: string
  supplierId: string
  supplierName: string
  model: string | null
  manufacturer: string | null
  optionName: string | null
  displayLabel: string
}

export interface TechnicalConfigurationComparisonData {
  dossier: TechnicalConfigurationComparisonDossier
  baselineVersion: TechnicalConfigurationComparisonBaselineVersion
  options: TechnicalConfigurationComparisonOption[]
  criteria: TechnicalConfigurationComparisonCriterionRow[]
}

export interface TechnicalConfigurationComparisonResult {
  data: TechnicalConfigurationComparisonData
  total: number
  page: number
  pageSize: number
}
