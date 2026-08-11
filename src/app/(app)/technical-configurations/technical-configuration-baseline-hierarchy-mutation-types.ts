import type {
  TechnicalConfigurationBaselineCriterionMutationWire,
  TechnicalConfigurationBaselineDeleteWireResponse,
  TechnicalConfigurationBaselineDraftWireResponse,
  TechnicalConfigurationBaselineSubgroupWire,
} from "./baseline-types"

export interface TechnicalConfigurationBaselineSubgroupMutationWire extends Omit<
  TechnicalConfigurationBaselineSubgroupWire,
  "criteria"
> {
  revision: number
}

export interface TechnicalConfigurationBaselineSubgroupWireResponse {
  data: TechnicalConfigurationBaselineSubgroupMutationWire
}

export interface TechnicalConfigurationBaselineSubgroupCreateRpcArgs {
  p_group_id: string
  p_name: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineSubgroupUpdateRpcArgs {
  p_subgroup_id: string
  p_name: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineSubgroupDeleteRpcArgs {
  p_subgroup_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineSubgroupsReorderRpcArgs {
  p_group_id: string
  p_subgroup_ids: string[]
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineHierarchyCriterionCreateRpcArgs {
  p_group_id: string
  p_subgroup_id: string | null
  p_title: string | null
  p_requirement_text: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineHierarchyCriterionMoveRpcArgs {
  p_criterion_id: string
  p_target_group_id: string
  p_target_subgroup_id: string | null
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineHierarchyCriteriaReorderRpcArgs {
  p_group_id: string
  p_subgroup_id: string | null
  p_criterion_ids: string[]
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineHierarchyCriterionWireResponse {
  data: TechnicalConfigurationBaselineCriterionMutationWire
}

export type TechnicalConfigurationBaselineHierarchyDeleteWireResponse =
  TechnicalConfigurationBaselineDeleteWireResponse

export type TechnicalConfigurationBaselineHierarchyReorderWireResponse =
  TechnicalConfigurationBaselineDraftWireResponse
