import { callRpc } from "@/lib/rpc-client"
import { BASELINE_RPC_FUNCTIONS } from "@/lib/technical-configuration-baseline-rpcs"

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

/** Typed client wrappers for the P2 baseline draft RPCs. */
export const technicalConfigurationBaselineRpc = {
  createDraft(args: TechnicalConfigurationBaselineDraftCreateRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineDraftCreateWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS.createDraft,
      args: { ...args },
    })
  },
  getDraft(args: TechnicalConfigurationBaselineDraftGetRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineDraftWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS.getDraft,
      args: { ...args },
    })
  },
  createGroup(args: TechnicalConfigurationBaselineGroupCreateRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineGroupWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS.createGroup,
      args: { ...args },
    })
  },
  updateGroup(args: TechnicalConfigurationBaselineGroupUpdateRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineGroupWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS.updateGroup,
      args: { ...args },
    })
  },
  deleteGroup(args: TechnicalConfigurationBaselineGroupDeleteRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineDeleteWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS.deleteGroup,
      args: { ...args },
    })
  },
  reorderGroups(args: TechnicalConfigurationBaselineGroupsReorderRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineDraftWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS.reorderGroups,
      args: { ...args },
    })
  },
  createCriterion(args: TechnicalConfigurationBaselineCriterionCreateRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineCriterionWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS.createCriterion,
      args: { ...args },
    })
  },
  updateCriterion(args: TechnicalConfigurationBaselineCriterionUpdateRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineCriterionWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS.updateCriterion,
      args: { ...args },
    })
  },
  deleteCriterion(args: TechnicalConfigurationBaselineCriterionDeleteRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineDeleteWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS.deleteCriterion,
      args: { ...args },
    })
  },
  reorderCriteria(args: TechnicalConfigurationBaselineCriteriaReorderRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineDraftWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS.reorderCriteria,
      args: { ...args },
    })
  },
  previewBulk(args: TechnicalConfigurationBaselineBulkPreviewRpcArgs) {
    return callRpc<TechnicalConfigurationBaselineBulkPreviewWireResponse>({
      fn: BASELINE_RPC_FUNCTIONS.previewBulk,
      args: { ...args },
    })
  },
}

/** Returns the typed P2 baseline draft RPC client. */
export function useTechnicalConfigurationBaseline() {
  return technicalConfigurationBaselineRpc
}
