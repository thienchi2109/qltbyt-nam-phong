import { callRpc } from "@/lib/rpc-client"

import type {
  TechnicalConfigurationBaselineBulkPreviewRpcArgs,
  TechnicalConfigurationBaselineBulkPreviewWireResponse,
  TechnicalConfigurationBaselineCriteriaReorderRpcArgs,
  TechnicalConfigurationBaselineCriterionCreateRpcArgs,
  TechnicalConfigurationBaselineCriterionDeleteRpcArgs,
  TechnicalConfigurationBaselineCriterionUpdateRpcArgs,
  TechnicalConfigurationBaselineCriterionWireResponse,
  TechnicalConfigurationBaselineDeleteWireResponse,
  TechnicalConfigurationBaselineDraftCreateRpcArgs,
  TechnicalConfigurationBaselineDraftCreateWireResponse,
  TechnicalConfigurationBaselineDraftGetRpcArgs,
  TechnicalConfigurationBaselineDraftWireResponse,
  TechnicalConfigurationBaselineGroupCreateRpcArgs,
  TechnicalConfigurationBaselineGroupDeleteRpcArgs,
  TechnicalConfigurationBaselineGroupsReorderRpcArgs,
  TechnicalConfigurationBaselineGroupUpdateRpcArgs,
  TechnicalConfigurationBaselineGroupWireResponse,
} from "../baseline-types"

/** RPC function names owned by the P2 baseline draft contract. */
export const BASELINE_RPC_FUNCTIONS = [
  "technical_configuration_baseline_draft_create",
  "technical_configuration_baseline_draft_get",
  "technical_configuration_baseline_group_create",
  "technical_configuration_baseline_group_update",
  "technical_configuration_baseline_group_delete",
  "technical_configuration_baseline_groups_reorder",
  "technical_configuration_baseline_criterion_create",
  "technical_configuration_baseline_criterion_update",
  "technical_configuration_baseline_criterion_delete",
  "technical_configuration_baseline_criteria_reorder",
  "technical_configuration_baseline_bulk_preview",
] as const

/** Typed client wrappers for the P2 baseline draft RPCs. */
export const technicalConfigurationBaselineRpc = {
  createDraft(args: TechnicalConfigurationBaselineDraftCreateRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineDraftCreateWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS[0],
      args: { ...args },
    })
  },
  getDraft(args: TechnicalConfigurationBaselineDraftGetRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineDraftWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS[1],
      args: { ...args },
    })
  },
  createGroup(args: TechnicalConfigurationBaselineGroupCreateRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineGroupWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS[2],
      args: { ...args },
    })
  },
  updateGroup(args: TechnicalConfigurationBaselineGroupUpdateRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineGroupWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS[3],
      args: { ...args },
    })
  },
  deleteGroup(args: TechnicalConfigurationBaselineGroupDeleteRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineDeleteWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS[4],
      args: { ...args },
    })
  },
  reorderGroups(args: TechnicalConfigurationBaselineGroupsReorderRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineDraftWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS[5],
      args: { ...args },
    })
  },
  createCriterion(args: TechnicalConfigurationBaselineCriterionCreateRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineCriterionWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS[6],
      args: { ...args },
    })
  },
  updateCriterion(args: TechnicalConfigurationBaselineCriterionUpdateRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineCriterionWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS[7],
      args: { ...args },
    })
  },
  deleteCriterion(args: TechnicalConfigurationBaselineCriterionDeleteRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineDeleteWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS[8],
      args: { ...args },
    })
  },
  reorderCriteria(args: TechnicalConfigurationBaselineCriteriaReorderRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineDraftWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS[9],
      args: { ...args },
    })
  },
  previewBulk(args: TechnicalConfigurationBaselineBulkPreviewRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineBulkPreviewWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS[10],
      args: { ...args },
    })
  },
}

/** Returns the typed P2 baseline draft RPC client. */
export function useTechnicalConfigurationBaseline() {
  return technicalConfigurationBaselineRpc
}
