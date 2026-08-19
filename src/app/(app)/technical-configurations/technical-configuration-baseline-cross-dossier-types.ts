export interface TechnicalConfigurationBaselineCrossDossierSourceWire {
  baseline_version_id: string
  dossier_id: string
  device_type_name: string
  dossier_name: string
  dossier_archived_at: string | null
  version_number: number
  locked_at: string
  main_section_count: number
  subgroup_count: number
  criterion_count: number
}

export interface TechnicalConfigurationBaselineCrossDossierSourcesListRpcArgs {
  p_target_dossier_id: string
  p_search: string | null
  p_page: number
  p_page_size: number
}

export interface TechnicalConfigurationBaselineCrossDossierSourcesListWireResponse {
  data: TechnicalConfigurationBaselineCrossDossierSourceWire[]
  total: number
  page: number
  page_size: number
}

export interface TechnicalConfigurationBaselineCrossDossierCopyPreviewRpcArgs {
  p_source_baseline_version_id: string
  p_target_dossier_id: string
  p_expected_dossier_revision: number
  p_expected_target_baseline_version_id: string | null
  p_expected_target_baseline_revision: number | null
}

export interface TechnicalConfigurationBaselineCrossDossierCopyCounts {
  main_sections: number
  subgroups: number
  criteria: number
  reference_products: number
  reference_responses: number
  baseline_documents: number
  baseline_citations: number
  reference_documents: number
  reference_citations: number
}

export interface TechnicalConfigurationBaselineCrossDossierDeleteCounts extends TechnicalConfigurationBaselineCrossDossierCopyCounts {
  option_responses: number
  option_citations: number
  manual_assessments: number
}

export interface TechnicalConfigurationBaselineCrossDossierPreservedCounts {
  suppliers: number
  options: number
  option_documents: number
  comparison_sets: number
}

export interface TechnicalConfigurationBaselineCrossDossierCopyPreviewWire {
  mode: "create" | "replace"
  requires_replacement_confirmation: boolean
  preview_fingerprint: string
  source: Omit<
    TechnicalConfigurationBaselineCrossDossierSourceWire,
    "main_section_count" | "subgroup_count" | "criterion_count"
  >
  target: {
    dossier_id: string
    dossier_revision: number
    baseline_version_id: string | null
    baseline_revision: number | null
    version_number: number | null
  }
  copy_counts: TechnicalConfigurationBaselineCrossDossierCopyCounts
  delete_counts: TechnicalConfigurationBaselineCrossDossierDeleteCounts
  preserved_counts: TechnicalConfigurationBaselineCrossDossierPreservedCounts
}

export interface TechnicalConfigurationBaselineCrossDossierCopyPreviewWireResponse {
  data: TechnicalConfigurationBaselineCrossDossierCopyPreviewWire
}

export interface TechnicalConfigurationBaselineCrossDossierCopyApplyRpcArgs extends TechnicalConfigurationBaselineCrossDossierCopyPreviewRpcArgs {
  p_preview_fingerprint: string
  p_confirm_replace: boolean
}

export interface TechnicalConfigurationBaselineCrossDossierCopyApplyWire {
  mode: "create" | "replace"
  target_dossier_id: string
  target_dossier_revision: number
  target_baseline_version_id: string
  target_baseline_revision: number
  source_baseline_version_id: string
  copied_counts: TechnicalConfigurationBaselineCrossDossierCopyCounts
  deleted_counts: TechnicalConfigurationBaselineCrossDossierDeleteCounts
  preserved_counts: TechnicalConfigurationBaselineCrossDossierPreservedCounts
}

export interface TechnicalConfigurationBaselineCrossDossierCopyApplyWireResponse {
  data: TechnicalConfigurationBaselineCrossDossierCopyApplyWire
}
