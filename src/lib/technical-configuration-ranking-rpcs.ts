/** Named P12C1 reference-ranking RPC shared by client and server code. */
export const REFERENCE_RANKING_RPC_FUNCTIONS = {
  listReferenceRanking: "technical_configuration_reference_ranking_list",
} as const

/** Ordered P12C1 ranking RPC names for allowlists and contract iteration. */
export const REFERENCE_RANKING_RPC_FUNCTION_NAMES = Object.values(REFERENCE_RANKING_RPC_FUNCTIONS)
