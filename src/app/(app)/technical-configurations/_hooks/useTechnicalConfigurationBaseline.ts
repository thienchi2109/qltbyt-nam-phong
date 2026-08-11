import { BASELINE_RPC_FUNCTIONS } from "@/lib/technical-configuration-baseline-rpcs"

import {
  callTechnicalConfigurationRpc,
  getTechnicalConfigurationDossier,
} from "../technical-configuration-rpc"
import {
  decodeTechnicalConfigurationBaselineDraftCreateWireResponse,
  decodeTechnicalConfigurationBaselineDraftWireResponse,
  decodeTechnicalConfigurationBaselineVersionsListWireResponse,
} from "../technical-configuration-baseline-decoders"
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
  TechnicalConfigurationBaselineDraftGetRpcArgs,
  TechnicalConfigurationBaselineGroupCreateRpcArgs,
  TechnicalConfigurationBaselineGroupDeleteRpcArgs,
  TechnicalConfigurationBaselineGroupsReorderRpcArgs,
  TechnicalConfigurationBaselineGroupUpdateRpcArgs,
  TechnicalConfigurationBaselineGroupWireResponse,
  TechnicalConfigurationBaselineImportPreviewWireResponse,
  TechnicalConfigurationBaselineImportRpcArgs,
  TechnicalConfigurationBaselineLockRpcArgs,
  TechnicalConfigurationBaselineVersionsListRpcArgs,
} from "../baseline-types"
import type {
  TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse,
  TechnicalConfigurationBaselineHierarchyImportRpcArgs,
} from "../technical-configuration-baseline-hierarchy-import-types"
import type {
  TechnicalConfigurationBaselineHierarchyCriteriaReorderRpcArgs,
  TechnicalConfigurationBaselineHierarchyCriterionCreateRpcArgs,
  TechnicalConfigurationBaselineHierarchyCriterionMoveRpcArgs,
  TechnicalConfigurationBaselineHierarchyCriterionWireResponse,
  TechnicalConfigurationBaselineSubgroupCreateRpcArgs,
  TechnicalConfigurationBaselineSubgroupDeleteRpcArgs,
  TechnicalConfigurationBaselineSubgroupsReorderRpcArgs,
  TechnicalConfigurationBaselineSubgroupUpdateRpcArgs,
  TechnicalConfigurationBaselineSubgroupWireResponse,
} from "../technical-configuration-baseline-hierarchy-mutation-types"
import { TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS } from "../technical-configuration-baseline-hierarchy-rpcs"

/** Typed client wrappers for baseline draft and lifecycle RPCs. */
export const technicalConfigurationBaselineRpc = {
  getDossier(dossierId: string) {
    return getTechnicalConfigurationDossier(dossierId)
  },
  createDraft(args: TechnicalConfigurationBaselineDraftCreateRpcArgs) {
    return callTechnicalConfigurationRpc<unknown>(BASELINE_RPC_FUNCTIONS.createDraft, {
      ...args,
    }).then(decodeTechnicalConfigurationBaselineDraftCreateWireResponse)
  },
  getDraft(args: TechnicalConfigurationBaselineDraftGetRpcArgs) {
    return callTechnicalConfigurationRpc<unknown>(BASELINE_RPC_FUNCTIONS.getDraft, {
      ...args,
    }).then(decodeTechnicalConfigurationBaselineDraftWireResponse)
  },
  listVersions(args: TechnicalConfigurationBaselineVersionsListRpcArgs) {
    return callTechnicalConfigurationRpc<unknown>(BASELINE_RPC_FUNCTIONS.listVersions, {
      ...args,
    }).then(decodeTechnicalConfigurationBaselineVersionsListWireResponse)
  },
  lockVersion(args: TechnicalConfigurationBaselineLockRpcArgs) {
    return callTechnicalConfigurationRpc<unknown>(BASELINE_RPC_FUNCTIONS.lockVersion, {
      ...args,
    }).then(decodeTechnicalConfigurationBaselineDraftWireResponse)
  },
  copyVersion(args: TechnicalConfigurationBaselineCopyRpcArgs) {
    return callTechnicalConfigurationRpc<unknown>(BASELINE_RPC_FUNCTIONS.copyVersion, {
      ...args,
    }).then(decodeTechnicalConfigurationBaselineDraftCreateWireResponse)
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
    return callTechnicalConfigurationRpc<unknown>(BASELINE_RPC_FUNCTIONS.reorderGroups, {
      ...args,
    }).then(decodeTechnicalConfigurationBaselineDraftWireResponse)
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
    return callTechnicalConfigurationRpc<unknown>(BASELINE_RPC_FUNCTIONS.reorderCriteria, {
      ...args,
    }).then(decodeTechnicalConfigurationBaselineDraftWireResponse)
  },
  createSubgroup(args: TechnicalConfigurationBaselineSubgroupCreateRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineSubgroupWireResponse>(
      TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS.createSubgroup,
      { ...args }
    )
  },
  updateSubgroup(args: TechnicalConfigurationBaselineSubgroupUpdateRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineSubgroupWireResponse>(
      TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS.updateSubgroup,
      { ...args }
    )
  },
  deleteSubgroup(args: TechnicalConfigurationBaselineSubgroupDeleteRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineDeleteWireResponse>(
      TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS.deleteSubgroup,
      { ...args }
    )
  },
  reorderSubgroups(args: TechnicalConfigurationBaselineSubgroupsReorderRpcArgs) {
    return callTechnicalConfigurationRpc<unknown>(
      TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS.reorderSubgroups,
      { ...args }
    ).then(decodeTechnicalConfigurationBaselineDraftWireResponse)
  },
  createHierarchyCriterion(args: TechnicalConfigurationBaselineHierarchyCriterionCreateRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineHierarchyCriterionWireResponse>(
      TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS.createCriterion,
      { ...args }
    )
  },
  moveHierarchyCriterion(args: TechnicalConfigurationBaselineHierarchyCriterionMoveRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineHierarchyCriterionWireResponse>(
      TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS.moveCriterion,
      { ...args }
    )
  },
  reorderHierarchyCriteria(args: TechnicalConfigurationBaselineHierarchyCriteriaReorderRpcArgs) {
    return callTechnicalConfigurationRpc<unknown>(
      TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS.reorderCriteria,
      { ...args }
    ).then(decodeTechnicalConfigurationBaselineDraftWireResponse)
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
  previewHierarchyImport(args: TechnicalConfigurationBaselineHierarchyImportRpcArgs) {
    return callTechnicalConfigurationRpc<TechnicalConfigurationBaselineHierarchyImportPreviewWireResponse>(
      BASELINE_RPC_FUNCTIONS.previewHierarchyImport,
      { ...args }
    )
  },
  applyImport(args: TechnicalConfigurationBaselineImportRpcArgs) {
    return callTechnicalConfigurationRpc<unknown>(BASELINE_RPC_FUNCTIONS.applyImport, {
      ...args,
    }).then(decodeTechnicalConfigurationBaselineDraftWireResponse)
  },
  applyHierarchyImport(args: TechnicalConfigurationBaselineHierarchyImportRpcArgs) {
    return callTechnicalConfigurationRpc<unknown>(BASELINE_RPC_FUNCTIONS.applyHierarchyImport, {
      ...args,
    }).then(decodeTechnicalConfigurationBaselineDraftWireResponse)
  },
}

/** Returns the typed baseline RPC client. */
export function useTechnicalConfigurationBaseline() {
  return technicalConfigurationBaselineRpc
}
