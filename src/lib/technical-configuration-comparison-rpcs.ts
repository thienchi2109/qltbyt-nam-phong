/** Named P10A2 side-effect-free comparison read RPC shared by client and server code. */
export const COMPARISON_READ_RPC_FUNCTIONS = {
  getComparison: "technical_configuration_comparison_get",
} as const

/** Ordered P10A2 comparison read RPC names for allowlists and contract iteration. */
export const COMPARISON_READ_RPC_FUNCTION_NAMES = Object.values(COMPARISON_READ_RPC_FUNCTIONS)
