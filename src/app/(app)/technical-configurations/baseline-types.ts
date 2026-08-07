import type {
  TechnicalConfigurationBaselineWorkbookCriterionRow,
  TechnicalConfigurationBaselineWorkbookGroupRow,
  TechnicalConfigurationBaselineWorkbookMetadata,
  TechnicalConfigurationBaselineWorkbookRow,
} from "@/lib/technical-configuration-baseline-excel-contract"

export type TechnicalConfigurationBaselineStatus = "draft" | "locked"

export interface TechnicalConfigurationBaselineCriterionWire {
  id: string
  baseline_version_id: string
  group_id: string
  subgroup_id?: string | null
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

export interface TechnicalConfigurationBaselineSubgroupWire {
  id: string
  baseline_version_id: string
  group_id: string
  name: string
  sort_order: number
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
  criteria: TechnicalConfigurationBaselineCriterionWire[]
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
  subgroups?: TechnicalConfigurationBaselineSubgroupWire[]
}

export interface TechnicalConfigurationBaselineDraftWire {
  id: string
  dossier_id: string
  version_number: number
  status: TechnicalConfigurationBaselineStatus
  source_baseline_version_id: string | null
  source_version_number: number | null
  next_criterion_number: number
  revision: number
  locked_at: string | null
  locked_by: number | null
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
  groups: TechnicalConfigurationBaselineGroupWire[]
}

export interface TechnicalConfigurationBaselineDecodedCriterion extends Omit<
  TechnicalConfigurationBaselineCriterionWire,
  "subgroup_id"
> {
  subgroup_id: string | null
}

export interface TechnicalConfigurationBaselineDecodedSubgroup extends Omit<
  TechnicalConfigurationBaselineSubgroupWire,
  "criteria"
> {
  criteria: TechnicalConfigurationBaselineDecodedCriterion[]
}

export interface TechnicalConfigurationBaselineDecodedGroup extends Omit<
  TechnicalConfigurationBaselineGroupWire,
  "criteria" | "subgroups"
> {
  criteria: TechnicalConfigurationBaselineDecodedCriterion[]
  subgroups: TechnicalConfigurationBaselineDecodedSubgroup[]
}

export interface TechnicalConfigurationBaselineDecodedDraft extends Omit<
  TechnicalConfigurationBaselineDraftWire,
  "groups"
> {
  groups: TechnicalConfigurationBaselineDecodedGroup[]
}

export interface TechnicalConfigurationBaselineDraftWireResponse {
  data: TechnicalConfigurationBaselineDraftWire
}

export interface TechnicalConfigurationBaselineDecodedDraftWireResponse {
  data: TechnicalConfigurationBaselineDecodedDraft
}

export interface TechnicalConfigurationBaselineDraftCreateWireResponse {
  data: TechnicalConfigurationBaselineDraftWire & {
    dossier_revision: number
  }
}

export interface TechnicalConfigurationBaselineDecodedDraftCreateWireResponse {
  data: TechnicalConfigurationBaselineDecodedDraft & {
    dossier_revision: number
  }
}

export interface TechnicalConfigurationBaselineVersionsListWireResponse {
  data: TechnicalConfigurationBaselineDraftWire[]
  total: number
  page: number
  page_size: number
}

export interface TechnicalConfigurationBaselineDecodedVersionsListWireResponse {
  data: TechnicalConfigurationBaselineDecodedDraft[]
  total: number
  page: number
  page_size: number
}

export interface TechnicalConfigurationBaselineGroupMutationWire extends Omit<
  TechnicalConfigurationBaselineGroupWire,
  "criteria" | "subgroups"
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

export type TechnicalConfigurationBaselineImportPreviewRow =
  | TechnicalConfigurationBaselineWorkbookGroupRow
  | (Omit<TechnicalConfigurationBaselineWorkbookCriterionRow, "criterion_code"> & {
      criterion_code: string
    })

export interface TechnicalConfigurationBaselineImportPreviewError {
  row: number
  code: string
  column?: keyof TechnicalConfigurationBaselineWorkbookRow
  message: string
}

export interface TechnicalConfigurationBaselineImportPreviewWireResponse {
  data: {
    metadata: TechnicalConfigurationBaselineWorkbookMetadata
    rows: TechnicalConfigurationBaselineImportPreviewRow[]
  }
  errors: TechnicalConfigurationBaselineImportPreviewError[]
}

export interface TechnicalConfigurationBaselineDraftCreateRpcArgs {
  p_dossier_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineDraftGetRpcArgs {
  p_dossier_id: string
}

export interface TechnicalConfigurationBaselineVersionsListRpcArgs {
  p_dossier_id: string
  p_page?: number
  p_page_size?: number
}

export interface TechnicalConfigurationBaselineLockRpcArgs {
  p_baseline_version_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineCopyRpcArgs {
  p_source_baseline_version_id: string
  p_expected_revision: number
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

export interface TechnicalConfigurationBaselineImportRpcArgs {
  p_baseline_version_id: string
  p_template_metadata: TechnicalConfigurationBaselineWorkbookMetadata
  p_rows: TechnicalConfigurationBaselineWorkbookRow[]
  p_expected_revision: number
}
