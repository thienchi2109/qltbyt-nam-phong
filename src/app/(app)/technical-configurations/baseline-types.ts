export type TechnicalConfigurationBaselineStatus = "draft" | "locked"

export interface TechnicalConfigurationBaselineCriterionWire {
  id: string
  baseline_version_id: string
  group_id: string
  criterion_code: string
  title: string | null
  requirement_text: string
  sort_order: number
  source_criterion_id: string | null
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
}

export interface TechnicalConfigurationBaselineGroupWire {
  id: string
  baseline_version_id: string
  name: string
  sort_order: number
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
  criteria: TechnicalConfigurationBaselineCriterionWire[]
}

export interface TechnicalConfigurationBaselineDraftWire {
  id: string
  dossier_id: string
  version_number: number
  status: TechnicalConfigurationBaselineStatus
  next_criterion_number: number
  revision: number
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
  groups: TechnicalConfigurationBaselineGroupWire[]
}

export interface TechnicalConfigurationBaselineDraftWireResponse {
  data: TechnicalConfigurationBaselineDraftWire
}

export interface TechnicalConfigurationBaselineDraftCreateWireResponse {
  data: TechnicalConfigurationBaselineDraftWire & {
    dossier_revision: number
  }
}

export interface TechnicalConfigurationBaselineGroupMutationWire extends Omit<
  TechnicalConfigurationBaselineGroupWire,
  "criteria"
> {
  revision: number
}

export interface TechnicalConfigurationBaselineGroupWireResponse {
  data: TechnicalConfigurationBaselineGroupMutationWire
}

export interface TechnicalConfigurationBaselineCriterionMutationWire extends TechnicalConfigurationBaselineCriterionWire {
  revision: number
}

export interface TechnicalConfigurationBaselineCriterionWireResponse {
  data: TechnicalConfigurationBaselineCriterionMutationWire
}

export interface TechnicalConfigurationBaselineDeleteWireResponse {
  data: {
    id: string
    revision: number
  }
}

export interface TechnicalConfigurationBaselineBulkItem {
  title: string | null
  requirement_text: string
}

export interface TechnicalConfigurationBaselineBulkPreviewItem extends TechnicalConfigurationBaselineBulkItem {
  criterion_code: string
  sort_order: number
}

export interface TechnicalConfigurationBaselineBulkPreviewError {
  row: number
  code: "validation_error"
  message: string
}

export interface TechnicalConfigurationBaselineBulkPreviewWireResponse {
  data: TechnicalConfigurationBaselineBulkPreviewItem[]
  errors: TechnicalConfigurationBaselineBulkPreviewError[]
}

export interface TechnicalConfigurationBaselineDraftCreateRpcArgs {
  p_dossier_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineDraftGetRpcArgs {
  p_dossier_id: string
}

export interface TechnicalConfigurationBaselineGroupCreateRpcArgs {
  p_baseline_version_id: string
  p_name: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineGroupUpdateRpcArgs {
  p_group_id: string
  p_name: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineGroupDeleteRpcArgs {
  p_group_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineGroupsReorderRpcArgs {
  p_baseline_version_id: string
  p_group_ids: string[]
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineCriterionCreateRpcArgs {
  p_group_id: string
  p_title: string | null
  p_requirement_text: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineCriterionUpdateRpcArgs {
  p_criterion_id: string
  p_title: string | null
  p_requirement_text: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineCriterionDeleteRpcArgs {
  p_criterion_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineCriteriaReorderRpcArgs {
  p_group_id: string
  p_criterion_ids: string[]
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineBulkPreviewRpcArgs {
  p_group_id: string
  p_items: TechnicalConfigurationBaselineBulkItem[]
  p_expected_revision: number
}
