import { BASELINE_RPC_FUNCTIONS } from "@/lib/technical-configuration-baseline-rpcs"

import { callTechnicalConfigurationRpc } from "../technical-configuration-rpc"
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
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineDraftCreateWireResponse>(
      BASELINE_RPC_FUNCTIONS.createDraft,
      { ...args }
    )
  },
  getDraft(args: TechnicalConfigurationBaselineDraftGetRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineDraftWireResponse>(
      BASELINE_RPC_FUNCTIONS.getDraft,
      { ...args }
    )
  },
  createGroup(args: TechnicalConfigurationBaselineGroupCreateRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineGroupWireResponse>(
      BASELINE_RPC_FUNCTIONS.createGroup,
      { ...args }
    )
  },
  updateGroup(args: TechnicalConfigurationBaselineGroupUpdateRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineGroupWireResponse>(
      BASELINE_RPC_FUNCTIONS.updateGroup,
      { ...args }
    )
  },
  deleteGroup(args: TechnicalConfigurationBaselineGroupDeleteRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineDeleteWireResponse>(
      BASELINE_RPC_FUNCTIONS.deleteGroup,
      { ...args }
    )
  },
  reorderGroups(args: TechnicalConfigurationBaselineGroupsReorderRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineDraftWireResponse>(
      BASELINE_RPC_FUNCTIONS.reorderGroups,
      { ...args }
    )
  },
  createCriterion(args: TechnicalConfigurationBaselineCriterionCreateRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineCriterionWireResponse>(
      BASELINE_RPC_FUNCTIONS.createCriterion,
      { ...args }
    )
  },
  updateCriterion(args: TechnicalConfigurationBaselineCriterionUpdateRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineCriterionWireResponse>(
      BASELINE_RPC_FUNCTIONS.updateCriterion,
      { ...args }
    )
  },
  deleteCriterion(args: TechnicalConfigurationBaselineCriterionDeleteRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineDeleteWireResponse>(
      BASELINE_RPC_FUNCTIONS.deleteCriterion,
      { ...args }
    )
  },
  reorderCriteria(args: TechnicalConfigurationBaselineCriteriaReorderRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineDraftWireResponse>(
      BASELINE_RPC_FUNCTIONS.reorderCriteria,
      { ...args }
    )
  },
  previewBulk(args: TechnicalConfigurationBaselineBulkPreviewRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineBulkPreviewWireResponse>(
      BASELINE_RPC_FUNCTIONS.previewBulk,
      { ...args }
    )
  },
}

/** Returns the typed P2 baseline draft RPC client. */
export function useTechnicalConfigurationBaseline() {
  return technicalConfigurationBaselineRpc
}
