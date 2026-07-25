import { OPTION_IMPORT_RPC_FUNCTIONS } from "@/lib/technical-configuration-supplier-option-rpcs"
import { callTechnicalConfigurationRpc } from "./technical-configuration-rpc"
import type {
  TechnicalConfigurationOptionImportApplyWireResponse,
  TechnicalConfigurationOptionImportPreviewWireResponse,
  TechnicalConfigurationOptionImportRpcArgs,
} from "./supplier-option-types"

/** Validates one complete supplier-option response snapshot without persistence. */
export function previewTechnicalConfigurationOptionImport(
  args: TechnicalConfigurationOptionImportRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationOptionImportPreviewWireResponse> {
  return callTechnicalConfigurationRpc(OPTION_IMPORT_RPC_FUNCTIONS.previewOptionImport, args, {
    signal,
  })
}

/** Atomically applies one authoritative supplier-option response snapshot. */
export function applyTechnicalConfigurationOptionImport(
  args: TechnicalConfigurationOptionImportRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationOptionImportApplyWireResponse> {
  return callTechnicalConfigurationRpc(OPTION_IMPORT_RPC_FUNCTIONS.applyOptionImport, args, {
    signal,
  })
}
