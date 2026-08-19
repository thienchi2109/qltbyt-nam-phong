import { BASELINE_RPC_FUNCTIONS } from "@/lib/technical-configuration-baseline-rpcs"

import type {
  TechnicalConfigurationBaselineCrossDossierCopyApplyRpcArgs,
  TechnicalConfigurationBaselineCrossDossierCopyApplyWireResponse,
  TechnicalConfigurationBaselineCrossDossierCopyPreviewRpcArgs,
  TechnicalConfigurationBaselineCrossDossierCopyPreviewWireResponse,
  TechnicalConfigurationBaselineCrossDossierSourcesListRpcArgs,
  TechnicalConfigurationBaselineCrossDossierSourcesListWireResponse,
} from "./technical-configuration-baseline-cross-dossier-types"
import { callTechnicalConfigurationRpc } from "./technical-configuration-rpc"

/** Lists locked baseline versions eligible as cross-dossier copy sources. */
export function listTechnicalConfigurationBaselineCrossDossierSources(
  args: TechnicalConfigurationBaselineCrossDossierSourcesListRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationBaselineCrossDossierSourcesListWireResponse> {
  return callTechnicalConfigurationRpc(BASELINE_RPC_FUNCTIONS.listCrossDossierSources, args, {
    signal,
  })
}

/** Requests the authoritative copy and deletion preview without mutating the target. */
export function previewTechnicalConfigurationBaselineCrossDossierCopy(
  args: TechnicalConfigurationBaselineCrossDossierCopyPreviewRpcArgs
): Promise<TechnicalConfigurationBaselineCrossDossierCopyPreviewWireResponse> {
  return callTechnicalConfigurationRpc(BASELINE_RPC_FUNCTIONS.previewCrossDossierCopy, args)
}

/** Applies a previously fingerprinted cross-dossier copy to the target dossier. */
export function applyTechnicalConfigurationBaselineCrossDossierCopy(
  args: TechnicalConfigurationBaselineCrossDossierCopyApplyRpcArgs
): Promise<TechnicalConfigurationBaselineCrossDossierCopyApplyWireResponse> {
  return callTechnicalConfigurationRpc(BASELINE_RPC_FUNCTIONS.applyCrossDossierCopy, args)
}
