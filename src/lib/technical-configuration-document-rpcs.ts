/** Named P7B1 evidence RPCs shared by client and server code. */
export const DOCUMENT_RPC_FUNCTIONS = {
  listBaselineDocuments: "technical_configuration_baseline_documents_list",
  createBaselineDocument: "technical_configuration_baseline_document_create",
  updateBaselineDocument: "technical_configuration_baseline_document_update",
  deleteBaselineDocument: "technical_configuration_baseline_document_delete",
  upsertBaselineCitation: "technical_configuration_baseline_citation_upsert",
  deleteBaselineCitation: "technical_configuration_baseline_citation_delete",
  createReferenceDocument: "technical_configuration_reference_document_create",
  updateReferenceDocument: "technical_configuration_reference_document_update",
  deleteReferenceDocument: "technical_configuration_reference_document_delete",
  upsertReferenceCitation: "technical_configuration_reference_citation_upsert",
  deleteReferenceCitation: "technical_configuration_reference_citation_delete",
} as const

/** Ordered P7B1 RPC names for allowlists and contract iteration. */
export const DOCUMENT_RPC_FUNCTION_NAMES = Object.values(DOCUMENT_RPC_FUNCTIONS)
