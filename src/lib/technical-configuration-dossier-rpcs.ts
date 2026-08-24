/** Named dossier RPCs shared by the proxy and typed client. */
export const DOSSIER_RPC_FUNCTIONS = {
  listDossiers: "technical_configuration_dossiers_list",
  getDossier: "technical_configuration_dossiers_get",
  createDossier: "technical_configuration_dossiers_create",
  updateDossier: "technical_configuration_dossiers_update",
  archiveDossier: "technical_configuration_dossiers_archive",
  deleteDossier: "technical_configuration_dossiers_delete",
} as const

/** Ordered dossier RPC names for allowlists and contract iteration. */
export const DOSSIER_RPC_FUNCTION_NAMES = Object.values(DOSSIER_RPC_FUNCTIONS)
