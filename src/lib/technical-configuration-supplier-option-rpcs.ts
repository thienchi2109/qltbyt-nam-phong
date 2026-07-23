/** Named P8A1 supplier RPCs shared by client and server code. */
export const SUPPLIER_RPC_FUNCTIONS = {
  listSuppliers: "technical_configuration_suppliers_list",
  createSupplier: "technical_configuration_supplier_create",
  updateSupplier: "technical_configuration_supplier_update",
  deleteSupplier: "technical_configuration_supplier_delete",
} as const

/** Ordered P8A1 RPC names for allowlists and contract iteration. */
export const SUPPLIER_RPC_FUNCTION_NAMES = Object.values(SUPPLIER_RPC_FUNCTIONS)

/** Named P8A2 option RPCs shared by client and server code. */
export const OPTION_RPC_FUNCTIONS = {
  listOptions: "technical_configuration_options_list",
  createOption: "technical_configuration_option_create",
  updateOption: "technical_configuration_option_update",
  deleteOption: "technical_configuration_option_delete",
} as const

/** Ordered P8A2 RPC names for allowlists and contract iteration. */
export const OPTION_RPC_FUNCTION_NAMES = Object.values(OPTION_RPC_FUNCTIONS)

/** Named P8A3 exact-baseline option response RPCs shared by client and server code. */
export const OPTION_RESPONSE_RPC_FUNCTIONS = {
  getOrCreateComparisonSet: "technical_configuration_comparison_set_get_or_create",
  upsertOptionResponse: "technical_configuration_option_response_upsert",
} as const

/** Ordered P8A3 response RPC names for allowlists and contract iteration. */
export const OPTION_RESPONSE_RPC_FUNCTION_NAMES = Object.values(OPTION_RESPONSE_RPC_FUNCTIONS)

/** Named P8A4 side-effect-free response read RPC shared by client and server code. */
export const OPTION_RESPONSE_READ_RPC_FUNCTIONS = {
  getComparisonSet: "technical_configuration_comparison_set_get",
} as const

/** Ordered P8A4 nullable read RPC names for allowlists and contract iteration. */
export const OPTION_RESPONSE_READ_RPC_FUNCTION_NAMES = Object.values(
  OPTION_RESPONSE_READ_RPC_FUNCTIONS
)
