import { BASELINE_RPC_FUNCTIONS } from "@/lib/technical-configuration-baseline-rpcs"

import {
  callTechnicalConfigurationRpc,
  getTechnicalConfigurationDossier,
} from "../technical-configuration-rpc"
import type {
  TechnicalConfigurationBaselineBulkPreviewRpcArgs,
  TechnicalConfigurationBaselineBulkPreviewWireResponse,
  TechnicalConfigurationBaselineCriteriaReorderRpcArgs,
  TechnicalConfigurationBaselineCopyRpcArgs,
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
  TechnicalConfigurationBaselineImportPreviewWireResponse,
  TechnicalConfigurationBaselineImportRpcArgs,
  TechnicalConfigurationBaselineLockRpcArgs,
  TechnicalConfigurationBaselineVersionsListRpcArgs,
  TechnicalConfigurationBaselineVersionsListWireResponse,
} from "../baseline-types"

/** Typed client wrappers for baseline draft and lifecycle RPCs. */
export const technicalConfigurationBaselineRpc = {
  getDossier(dossierId: string) {
    return getTechnicalConfigurationDossier(dossierId)
  },
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
  listVersions(args: TechnicalConfigurationBaselineVersionsListRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineVersionsListWireResponse>(
      BASELINE_RPC_FUNCTIONS.listVersions,
      { ...args }
    )
  },
  lockVersion(args: TechnicalConfigurationBaselineLockRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineDraftWireResponse>(
      BASELINE_RPC_FUNCTIONS.lockVersion,
      { ...args }
    )
  },
  copyVersion(args: TechnicalConfigurationBaselineCopyRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineDraftCreateWireResponse>(
      BASELINE_RPC_FUNCTIONS.copyVersion,
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
  previewImport(args: TechnicalConfigurationBaselineImportRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineImportPreviewWireResponse>(
      BASELINE_RPC_FUNCTIONS.previewImport,
      { ...args }
    )
  },
  applyImport(args: TechnicalConfigurationBaselineImportRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineDraftWireResponse>(
      BASELINE_RPC_FUNCTIONS.applyImport,
      { ...args }
    )
  },
}

/** Returns the typed baseline RPC client. */
export function useTechnicalConfigurationBaseline() {
  return technicalConfigurationBaselineRpc
}
