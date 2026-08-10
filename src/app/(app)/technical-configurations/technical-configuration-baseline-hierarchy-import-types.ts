import type { TechnicalConfigurationBaselineWorkbookV2ParseResult } from "@/lib/technical-configuration-baseline-excel-v2-parse"

export interface TechnicalConfigurationBaselineHierarchyImportRawRow {
  row: number
  stt: string | null
  content: string
  group_id: string | null
  subgroup_id: string | null
  criterion_id: string | null
  criterion_code: string | null
}

export interface TechnicalConfigurationBaselineHierarchyImportRpcArgs {
  p_baseline_version_id: string
  p_template_metadata: TechnicalConfigurationBaselineWorkbookV2ParseResult["metadata"]
  p_rows: TechnicalConfigurationBaselineHierarchyImportRawRow[]
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineHierarchyImportEffectCounts {
  create: number
  update: number
  move: number
  delete: number
}

export interface TechnicalConfigurationBaselineHierarchyImportCounts {
  groups: number
  subgroups: number
  criteria: number
}

export interface TechnicalConfigurationBaselineHierarchyImportEffects {
  groups: TechnicalConfigurationBaselineHierarchyImportEffectCounts
  subgroups: TechnicalConfigurationBaselineHierarchyImportEffectCounts
  criteria: TechnicalConfigurationBaselineHierarchyImportEffectCounts
}

export interface TechnicalConfigurationBaselineHierarchyImportPreviewGroup {
  row: number
  row_type: "GROUP"
  group_id: string | null
  group_name: string
  original_group_order: number | null
  target_group_order: number
  identity_fallback: boolean
}

export interface TechnicalConfigurationBaselineHierarchyImportPreviewSubgroup {
  row: number
  row_type: "SUBGROUP"
  subgroup_id: string | null
  subgroup_name: string
  original_group_id: string | null
  original_subgroup_order: number | null
  target_group_id: string | null
  target_group_order: number
  target_subgroup_order: number
  identity_fallback: boolean
}

export interface TechnicalConfigurationBaselineHierarchyImportPreviewCriterion {
  row: number
  row_type: "CRITERION"
  criterion_id: string | null
  criterion_code: string
  existing_title: string | null
  requirement_text: string
  original_group_id: string | null
  original_subgroup_id: string | null
  original_criterion_order: number | null
  target_group_id: string | null
  target_subgroup_id: string | null
  target_group_order: number
  target_subgroup_order: number | null
  target_criterion_order: number
  identity_fallback: boolean
}

export type TechnicalConfigurationBaselineHierarchyImportPreviewRow =
  | TechnicalConfigurationBaselineHierarchyImportPreviewGroup
  | TechnicalConfigurationBaselineHierarchyImportPreviewSubgroup
  | TechnicalConfigurationBaselineHierarchyImportPreviewCriterion

export interface TechnicalConfigurationBaselineHierarchyImportPreviewError {
  row: number
  code: string
  column?: string
  message: string
}

export interface TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse {
  data: {
    metadata: TechnicalConfigurationBaselineWorkbookV2ParseResult["metadata"]
    rows: TechnicalConfigurationBaselineHierarchyImportPreviewRow[]
    counts: TechnicalConfigurationBaselineHierarchyImportCounts
    effects: TechnicalConfigurationBaselineHierarchyImportEffects | null
  }
  errors: TechnicalConfigurationBaselineHierarchyImportPreviewError[]
}
