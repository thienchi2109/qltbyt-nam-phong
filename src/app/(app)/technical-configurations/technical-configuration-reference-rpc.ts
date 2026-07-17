import { REFERENCE_PRODUCT_RPC_FUNCTIONS } from "@/lib/technical-configuration-reference-rpcs"
import { callTechnicalConfigurationRpc } from "./technical-configuration-rpc"
import type {
  TechnicalConfigurationReferenceProductCreateRpcArgs,
  TechnicalConfigurationReferenceProductDeleteRpcArgs,
  TechnicalConfigurationReferenceProductDeleteWireResponse,
  TechnicalConfigurationReferenceProductMutationWireResponse,
  TechnicalConfigurationReferenceProductsListRpcArgs,
  TechnicalConfigurationReferenceProductsListWireResponse,
  TechnicalConfigurationReferenceProductUpdateRpcArgs,
  TechnicalConfigurationReferenceResponseMutationWireResponse,
  TechnicalConfigurationReferenceResponseUpsertRpcArgs,
} from "./reference-product-types"

/** Lists reference products and their criterion responses for one baseline version. */
export function listTechnicalConfigurationReferenceProducts(
  args: TechnicalConfigurationReferenceProductsListRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationReferenceProductsListWireResponse> {
  return callTechnicalConfigurationRpc(REFERENCE_PRODUCT_RPC_FUNCTIONS.listProducts, args, {
    signal,
  })
}

/** Creates one reference product under an editable baseline version. */
export function createTechnicalConfigurationReferenceProduct(
  args: TechnicalConfigurationReferenceProductCreateRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationReferenceProductMutationWireResponse> {
  return callTechnicalConfigurationRpc(REFERENCE_PRODUCT_RPC_FUNCTIONS.createProduct, args, {
    signal,
  })
}

/** Updates one reference product with optimistic baseline revision protection. */
export function updateTechnicalConfigurationReferenceProduct(
  args: TechnicalConfigurationReferenceProductUpdateRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationReferenceProductMutationWireResponse> {
  return callTechnicalConfigurationRpc(REFERENCE_PRODUCT_RPC_FUNCTIONS.updateProduct, args, {
    signal,
  })
}

/** Deletes one reference product and its dependent responses. */
export function deleteTechnicalConfigurationReferenceProduct(
  args: TechnicalConfigurationReferenceProductDeleteRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationReferenceProductDeleteWireResponse> {
  return callTechnicalConfigurationRpc(REFERENCE_PRODUCT_RPC_FUNCTIONS.deleteProduct, args, {
    signal,
  })
}

/** Creates or replaces one criterion response for a reference product. */
export function upsertTechnicalConfigurationReferenceResponse(
  args: TechnicalConfigurationReferenceResponseUpsertRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationReferenceResponseMutationWireResponse> {
  return callTechnicalConfigurationRpc(REFERENCE_PRODUCT_RPC_FUNCTIONS.upsertResponse, args, {
    signal,
  })
}
