/** Named P15C dossier delete RPC shared by the proxy and typed client. */
export const DOSSIER_DELETE_RPC_FUNCTIONS = {
  deleteDossier: "technical_configuration_dossiers_delete",
} as const

/** Ordered P15C dossier delete RPC names for allowlists and contract iteration. */
export const DOSSIER_DELETE_RPC_FUNCTION_NAMES = Object.values(DOSSIER_DELETE_RPC_FUNCTIONS)
