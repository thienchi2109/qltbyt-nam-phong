import { SUPPLIER_RPC_FUNCTIONS } from "@/lib/technical-configuration-supplier-option-rpcs"
import { callTechnicalConfigurationRpc } from "./technical-configuration-rpc"
import type {
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
