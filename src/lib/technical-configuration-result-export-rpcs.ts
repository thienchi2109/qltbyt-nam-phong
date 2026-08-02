/** Named P14A1 result-export RPC shared by the proxy and future typed clients. */
export const RESULT_EXPORT_RPC_FUNCTIONS = {
  getManifest: "technical_configuration_result_export_manifest_get",
} as const

/** Ordered P14A1 result-export RPC names for allowlists and contract iteration. */
export const RESULT_EXPORT_RPC_FUNCTION_NAMES = Object.values(RESULT_EXPORT_RPC_FUNCTIONS)
