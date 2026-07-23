import {
  OPTION_RESPONSE_READ_RPC_FUNCTIONS,
  OPTION_RESPONSE_RPC_FUNCTIONS,
  OPTION_RPC_FUNCTIONS,
  SUPPLIER_RPC_FUNCTIONS,
} from "@/lib/technical-configuration-supplier-option-rpcs"
import { callTechnicalConfigurationRpc } from "./technical-configuration-rpc"
import type {
  TechnicalConfigurationComparisonSetGetRpcArgs,
  TechnicalConfigurationComparisonSetGetOrCreateRpcArgs,
  TechnicalConfigurationComparisonSetReadWireResponse,
  TechnicalConfigurationComparisonSetWireResponse,
  TechnicalConfigurationOptionCreateRpcArgs,
  TechnicalConfigurationOptionDeleteRpcArgs,
  TechnicalConfigurationOptionDeleteWireResponse,
  TechnicalConfigurationOptionMutationWireResponse,
  TechnicalConfigurationOptionResponseUpsertRpcArgs,
  TechnicalConfigurationOptionResponseWireResponse,
  TechnicalConfigurationOptionsListRpcArgs,
  TechnicalConfigurationOptionsListWireResponse,
  TechnicalConfigurationOptionUpdateRpcArgs,
  TechnicalConfigurationSupplierCreateRpcArgs,
  TechnicalConfigurationSupplierDeleteRpcArgs,
  TechnicalConfigurationSupplierDeleteWireResponse,
  TechnicalConfigurationSupplierMutationWireResponse,
  TechnicalConfigurationSuppliersListRpcArgs,
  TechnicalConfigurationSuppliersListWireResponse,
  TechnicalConfigurationSupplierUpdateRpcArgs,
} from "./supplier-option-types"

/** Lists dossier-scoped suppliers with the owning dossier revision. */
export function listTechnicalConfigurationSuppliers(
  args: TechnicalConfigurationSuppliersListRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationSuppliersListWireResponse> {
  return callTechnicalConfigurationRpc(SUPPLIER_RPC_FUNCTIONS.listSuppliers, args, {
    signal,
  })
}

/** Creates one supplier with optimistic dossier-revision protection. */
export function createTechnicalConfigurationSupplier(
  args: TechnicalConfigurationSupplierCreateRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationSupplierMutationWireResponse> {
  return callTechnicalConfigurationRpc(SUPPLIER_RPC_FUNCTIONS.createSupplier, args, {
    signal,
  })
}

/** Updates one supplier with optimistic dossier-revision protection. */
export function updateTechnicalConfigurationSupplier(
  args: TechnicalConfigurationSupplierUpdateRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationSupplierMutationWireResponse> {
  return callTechnicalConfigurationRpc(SUPPLIER_RPC_FUNCTIONS.updateSupplier, args, {
    signal,
  })
}

/** Deletes one supplier and returns the next dossier revision. */
export function deleteTechnicalConfigurationSupplier(
  args: TechnicalConfigurationSupplierDeleteRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationSupplierDeleteWireResponse> {
  return callTechnicalConfigurationRpc(SUPPLIER_RPC_FUNCTIONS.deleteSupplier, args, {
    signal,
  })
}

/** Lists dossier-scoped options with optional supplier filtering. */
export function listTechnicalConfigurationOptions(
  args: TechnicalConfigurationOptionsListRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationOptionsListWireResponse> {
  return callTechnicalConfigurationRpc(OPTION_RPC_FUNCTIONS.listOptions, args, {
    signal,
  })
}

/** Creates one option with optimistic dossier-revision protection. */
export function createTechnicalConfigurationOption(
  args: TechnicalConfigurationOptionCreateRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationOptionMutationWireResponse> {
  return callTechnicalConfigurationRpc(OPTION_RPC_FUNCTIONS.createOption, args, {
    signal,
  })
}

/** Updates one option with optimistic dossier-revision protection. */
export function updateTechnicalConfigurationOption(
  args: TechnicalConfigurationOptionUpdateRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationOptionMutationWireResponse> {
  return callTechnicalConfigurationRpc(OPTION_RPC_FUNCTIONS.updateOption, args, {
    signal,
  })
}

/** Deletes one option and returns the next dossier revision. */
export function deleteTechnicalConfigurationOption(
  args: TechnicalConfigurationOptionDeleteRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationOptionDeleteWireResponse> {
  return callTechnicalConfigurationRpc(OPTION_RPC_FUNCTIONS.deleteOption, args, {
    signal,
  })
}

/** Reads the response dataset without creating it when the pair is missing. */
export function getTechnicalConfigurationComparisonSet(
  args: TechnicalConfigurationComparisonSetGetRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationComparisonSetReadWireResponse> {
  return callTechnicalConfigurationRpc(
    OPTION_RESPONSE_READ_RPC_FUNCTIONS.getComparisonSet,
    {
      p_option_id: args.p_option_id,
      p_baseline_version_id: args.p_baseline_version_id,
    },
    { signal }
  )
}

/** Gets or creates the response dataset for one option and exact baseline version. */
export function getOrCreateTechnicalConfigurationComparisonSet(
  args: TechnicalConfigurationComparisonSetGetOrCreateRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationComparisonSetWireResponse> {
  return callTechnicalConfigurationRpc(
    OPTION_RESPONSE_RPC_FUNCTIONS.getOrCreateComparisonSet,
    args,
    { signal }
  )
}

/** Full-replaces one criterion response and its separate supplementary information. */
export function upsertTechnicalConfigurationOptionResponse(
  args: TechnicalConfigurationOptionResponseUpsertRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationOptionResponseWireResponse> {
  return callTechnicalConfigurationRpc(OPTION_RESPONSE_RPC_FUNCTIONS.upsertOptionResponse, args, {
    signal,
  })
}
