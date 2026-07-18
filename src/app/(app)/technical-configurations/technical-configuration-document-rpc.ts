import { DOCUMENT_RPC_FUNCTIONS } from "@/lib/technical-configuration-document-rpcs"
import { callTechnicalConfigurationRpc } from "./technical-configuration-rpc"
import type {
  TechnicalConfigurationBaselineCitationDeleteRpcArgs,
  TechnicalConfigurationBaselineCitationUpsertRpcArgs,
  TechnicalConfigurationBaselineDocumentCreateRpcArgs,
  TechnicalConfigurationBaselineDocumentDeleteRpcArgs,
  TechnicalConfigurationBaselineDocumentsListRpcArgs,
  TechnicalConfigurationBaselineDocumentUpdateRpcArgs,
  TechnicalConfigurationCitationDeleteWireResponse,
  TechnicalConfigurationCitationMutationWireResponse,
  TechnicalConfigurationDocumentDeleteWireResponse,
  TechnicalConfigurationDocumentMutationWireResponse,
  TechnicalConfigurationDocumentsListWireResponse,
  TechnicalConfigurationReferenceCitationDeleteRpcArgs,
  TechnicalConfigurationReferenceCitationUpsertRpcArgs,
  TechnicalConfigurationReferenceDocumentCreateRpcArgs,
  TechnicalConfigurationReferenceDocumentDeleteRpcArgs,
  TechnicalConfigurationReferenceDocumentUpdateRpcArgs,
} from "./document-types"

/** Lists baseline and reference evidence documents for one exact baseline version. */
export function listTechnicalConfigurationBaselineDocuments(
  args: TechnicalConfigurationBaselineDocumentsListRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationDocumentsListWireResponse> {
  return callTechnicalConfigurationRpc(DOCUMENT_RPC_FUNCTIONS.listBaselineDocuments, args, {
    signal,
  })
}

/** Creates a baseline evidence document for one exact baseline version. */
export function createTechnicalConfigurationBaselineDocument(
  args: TechnicalConfigurationBaselineDocumentCreateRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationDocumentMutationWireResponse> {
  return callTechnicalConfigurationRpc(DOCUMENT_RPC_FUNCTIONS.createBaselineDocument, args, {
    signal,
  })
}

/** Updates a baseline evidence document with optimistic revision control. */
export function updateTechnicalConfigurationBaselineDocument(
  args: TechnicalConfigurationBaselineDocumentUpdateRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationDocumentMutationWireResponse> {
  return callTechnicalConfigurationRpc(DOCUMENT_RPC_FUNCTIONS.updateBaselineDocument, args, {
    signal,
  })
}

/** Deletes a baseline evidence document with optimistic revision control. */
export function deleteTechnicalConfigurationBaselineDocument(
  args: TechnicalConfigurationBaselineDocumentDeleteRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationDocumentDeleteWireResponse> {
  return callTechnicalConfigurationRpc(DOCUMENT_RPC_FUNCTIONS.deleteBaselineDocument, args, {
    signal,
  })
}

/** Creates or updates a baseline evidence citation for one criterion. */
export function upsertTechnicalConfigurationBaselineCitation(
  args: TechnicalConfigurationBaselineCitationUpsertRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationCitationMutationWireResponse> {
  return callTechnicalConfigurationRpc(DOCUMENT_RPC_FUNCTIONS.upsertBaselineCitation, args, {
    signal,
  })
}

/** Deletes a baseline evidence citation with optimistic revision control. */
export function deleteTechnicalConfigurationBaselineCitation(
  args: TechnicalConfigurationBaselineCitationDeleteRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationCitationDeleteWireResponse> {
  return callTechnicalConfigurationRpc(DOCUMENT_RPC_FUNCTIONS.deleteBaselineCitation, args, {
    signal,
  })
}

/** Creates an evidence document for one reference product. */
export function createTechnicalConfigurationReferenceDocument(
  args: TechnicalConfigurationReferenceDocumentCreateRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationDocumentMutationWireResponse> {
  return callTechnicalConfigurationRpc(DOCUMENT_RPC_FUNCTIONS.createReferenceDocument, args, {
    signal,
  })
}

/** Updates a reference-product evidence document with optimistic revision control. */
export function updateTechnicalConfigurationReferenceDocument(
  args: TechnicalConfigurationReferenceDocumentUpdateRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationDocumentMutationWireResponse> {
  return callTechnicalConfigurationRpc(DOCUMENT_RPC_FUNCTIONS.updateReferenceDocument, args, {
    signal,
  })
}

/** Deletes a reference-product evidence document with optimistic revision control. */
export function deleteTechnicalConfigurationReferenceDocument(
  args: TechnicalConfigurationReferenceDocumentDeleteRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationDocumentDeleteWireResponse> {
  return callTechnicalConfigurationRpc(DOCUMENT_RPC_FUNCTIONS.deleteReferenceDocument, args, {
    signal,
  })
}

/** Creates or updates a reference-product evidence citation for one criterion. */
export function upsertTechnicalConfigurationReferenceCitation(
  args: TechnicalConfigurationReferenceCitationUpsertRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationCitationMutationWireResponse> {
  return callTechnicalConfigurationRpc(DOCUMENT_RPC_FUNCTIONS.upsertReferenceCitation, args, {
    signal,
  })
}

/** Deletes a reference-product evidence citation with optimistic revision control. */
export function deleteTechnicalConfigurationReferenceCitation(
  args: TechnicalConfigurationReferenceCitationDeleteRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationCitationDeleteWireResponse> {
  return callTechnicalConfigurationRpc(DOCUMENT_RPC_FUNCTIONS.deleteReferenceCitation, args, {
    signal,
  })
}
