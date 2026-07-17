/** Named P7A1 reference-product RPCs shared by client and server code. */
export const REFERENCE_PRODUCT_RPC_FUNCTIONS = {
  listProducts: "technical_configuration_reference_products_list",
  createProduct: "technical_configuration_reference_product_create",
  updateProduct: "technical_configuration_reference_product_update",
  deleteProduct: "technical_configuration_reference_product_delete",
  upsertResponse: "technical_configuration_reference_response_upsert",
} as const

/** Ordered P7A1 RPC names for allowlists and contract iteration. */
export const REFERENCE_PRODUCT_RPC_FUNCTION_NAMES = Object.values(REFERENCE_PRODUCT_RPC_FUNCTIONS)
