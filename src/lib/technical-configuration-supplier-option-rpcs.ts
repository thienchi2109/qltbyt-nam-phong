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
