"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type {
  TechnicalConfigurationCitationDeleteWireResponse,
  TechnicalConfigurationCitationMutationWireResponse,
  TechnicalConfigurationDocumentDeleteWireResponse,
  TechnicalConfigurationDocumentMutationWireResponse,
  TechnicalConfigurationDocumentWire,
} from "@/app/(app)/technical-configurations/document-types"
import {
  createTechnicalConfigurationBaselineDocument,
  createTechnicalConfigurationReferenceDocument,
  deleteTechnicalConfigurationBaselineCitation,
  deleteTechnicalConfigurationBaselineDocument,
  deleteTechnicalConfigurationReferenceCitation,
  deleteTechnicalConfigurationReferenceDocument,
  listTechnicalConfigurationBaselineDocuments,
  updateTechnicalConfigurationBaselineDocument,
  updateTechnicalConfigurationReferenceDocument,
  upsertTechnicalConfigurationBaselineCitation,
  upsertTechnicalConfigurationReferenceCitation,
} from "@/app/(app)/technical-configurations/technical-configuration-document-rpc"
import {
  technicalConfigurationBaselineVersionsQueryKey,
  technicalConfigurationDocumentsQueryKey,
} from "@/app/(app)/technical-configurations/technical-configuration-query-keys"
import { isTechnicalConfigurationBaselineConflict } from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"
import { collectStableTechnicalConfigurationPages } from "@/app/(app)/technical-configurations/technical-configuration-pagination"

const DOCUMENT_PAGE_SIZE = 100
const EMPTY_DOCUMENTS: TechnicalConfigurationDocumentWire[] = []

type UseTechnicalConfigurationDocumentsOptions = {
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  readOnly?: boolean
  onRevisionChange?: (revision: number) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
}

type CreateTechnicalConfigurationDocumentInput = {
  ownerType: TechnicalConfigurationDocumentWire["owner_type"]
  ownerId: string
  name: string
  url: string
}

type UpdateTechnicalConfigurationDocumentInput = {
  document: TechnicalConfigurationDocumentWire
  name: string
  url: string
}

type UpsertTechnicalConfigurationCitationInput = {
  document: TechnicalConfigurationDocumentWire
  criterionId: string
  pageSection: string | null
  excerpt: string | null
}

type DeleteTechnicalConfigurationCitationInput = {
  document: TechnicalConfigurationDocumentWire
  citationId: string
}

type RevisionedMutationResponse =
  | TechnicalConfigurationDocumentMutationWireResponse
  | TechnicalConfigurationDocumentDeleteWireResponse
  | TechnicalConfigurationCitationMutationWireResponse
  | TechnicalConfigurationCitationDeleteWireResponse

async function listAllTechnicalConfigurationDocuments(
  baselineVersionId: string,
  signal?: AbortSignal
): Promise<TechnicalConfigurationDocumentWire[]> {
  const { items } = await collectStableTechnicalConfigurationPages<
    TechnicalConfigurationDocumentWire,
    Awaited<ReturnType<typeof listTechnicalConfigurationBaselineDocuments>>
  >({
    loadPage: (page) =>
      listTechnicalConfigurationBaselineDocuments(
        {
          p_baseline_version_id: baselineVersionId,
          p_page: page,
          p_page_size: DOCUMENT_PAGE_SIZE,
        },
        signal
      ),
    snapshotError: "Evidence-document pagination snapshot changed during load.",
  })
  return items
}

/** Owns P7B2 evidence-document queries and mutations for one baseline version. */
export function useTechnicalConfigurationDocuments({
  baselineVersion,
  readOnly = false,
  onRevisionChange,
  onNavigationBlockedChange,
}: UseTechnicalConfigurationDocumentsOptions) {
  const queryClient = useQueryClient()
  const revisionRef = React.useRef(baselineVersion.revision)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isConflict, setIsConflict] = React.useState(false)
  const [mutationError, setMutationError] = React.useState<unknown>(null)
  React.useEffect(() => {
    revisionRef.current = baselineVersion.revision
  }, [baselineVersion.id, baselineVersion.revision])

  const queryKey = technicalConfigurationDocumentsQueryKey(baselineVersion.id)
  const documentsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => listAllTechnicalConfigurationDocuments(baselineVersion.id, signal),
    staleTime: 30_000,
  })
  const documents = documentsQuery.data ?? EMPTY_DOCUMENTS
  const getDocumentsForOwner = React.useCallback(
    (ownerType: TechnicalConfigurationDocumentWire["owner_type"], ownerId: string) =>
      documents.filter(
        (document) => document.owner_type === ownerType && document.owner_id === ownerId
      ),
    [documents]
  )
  const refreshAfterMutation = React.useCallback(
    async (revision: number) => {
      revisionRef.current = revision
      onRevisionChange?.(revision)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey, exact: true }),
        queryClient.invalidateQueries({
          queryKey: technicalConfigurationBaselineVersionsQueryKey(baselineVersion.dossier_id),
          exact: true,
        }),
      ])
    },
    [baselineVersion.dossier_id, onRevisionChange, queryClient, queryKey]
  )
  const runMutation = React.useCallback(
    async <TResponse extends RevisionedMutationResponse>(
      request: (expectedRevision: number) => Promise<TResponse>
    ): Promise<TResponse> => {
      if (baselineVersion.locked_at !== null) {
        throw new Error("locked_version")
      }
      if (readOnly) {
        throw new Error("read_only")
      }

      setIsSaving(true)
      setIsConflict(false)
      setMutationError(null)
      onNavigationBlockedChange?.(true)
      try {
        const response = await request(revisionRef.current)
        await refreshAfterMutation(response.data.revision)
        return response
      } catch (error) {
        setMutationError(error)
        setIsConflict(isTechnicalConfigurationBaselineConflict(error))
        throw error
      } finally {
        setIsSaving(false)
        onNavigationBlockedChange?.(false)
      }
    },
    [baselineVersion.locked_at, onNavigationBlockedChange, readOnly, refreshAfterMutation]
  )
  const createDocument = React.useCallback(
    ({ ownerType, ownerId, name, url }: CreateTechnicalConfigurationDocumentInput) =>
      runMutation((expectedRevision) =>
        ownerType === "baseline"
          ? createTechnicalConfigurationBaselineDocument({
              p_baseline_version_id: ownerId,
              p_name: name,
              p_url: url,
              p_expected_revision: expectedRevision,
            })
          : createTechnicalConfigurationReferenceDocument({
              p_reference_product_id: ownerId,
              p_name: name,
              p_url: url,
              p_expected_revision: expectedRevision,
            })
      ),
    [runMutation]
  )
  const updateDocument = React.useCallback(
    ({ document, name, url }: UpdateTechnicalConfigurationDocumentInput) =>
      runMutation((expectedRevision) =>
        document.owner_type === "baseline"
          ? updateTechnicalConfigurationBaselineDocument({
              p_baseline_document_id: document.id,
              p_name: name,
              p_url: url,
              p_expected_revision: expectedRevision,
            })
          : updateTechnicalConfigurationReferenceDocument({
              p_reference_document_id: document.id,
              p_name: name,
              p_url: url,
              p_expected_revision: expectedRevision,
            })
      ),
    [runMutation]
  )
  const deleteDocument = React.useCallback(
    async (document: TechnicalConfigurationDocumentWire) => {
      const response = await runMutation((expectedRevision) =>
        document.owner_type === "baseline"
          ? deleteTechnicalConfigurationBaselineDocument({
              p_baseline_document_id: document.id,
              p_expected_revision: expectedRevision,
            })
          : deleteTechnicalConfigurationReferenceDocument({
              p_reference_document_id: document.id,
              p_expected_revision: expectedRevision,
            })
      )
      return response.data.affected_link_count
    },
    [runMutation]
  )
  const upsertCitation = React.useCallback(
    ({ document, criterionId, pageSection, excerpt }: UpsertTechnicalConfigurationCitationInput) =>
      runMutation((expectedRevision) =>
        document.owner_type === "baseline"
          ? upsertTechnicalConfigurationBaselineCitation({
              p_baseline_document_id: document.id,
              p_criterion_id: criterionId,
              p_page_section: pageSection,
              p_excerpt: excerpt,
              p_expected_revision: expectedRevision,
            })
          : upsertTechnicalConfigurationReferenceCitation({
              p_reference_document_id: document.id,
              p_criterion_id: criterionId,
              p_page_section: pageSection,
              p_excerpt: excerpt,
              p_expected_revision: expectedRevision,
            })
      ),
    [runMutation]
  )
  const deleteCitation = React.useCallback(
    ({ document, citationId }: DeleteTechnicalConfigurationCitationInput) =>
      runMutation((expectedRevision) =>
        document.owner_type === "baseline"
          ? deleteTechnicalConfigurationBaselineCitation({
              p_baseline_citation_id: citationId,
              p_expected_revision: expectedRevision,
            })
          : deleteTechnicalConfigurationReferenceCitation({
              p_reference_citation_id: citationId,
              p_expected_revision: expectedRevision,
            })
      ),
    [runMutation]
  )

  return {
    documentsQuery,
    documents,
    getDocumentsForOwner,
    isReadOnly: readOnly || baselineVersion.locked_at !== null,
    isSaving,
    isConflict,
    mutationError,
    createDocument,
    updateDocument,
    deleteDocument,
    upsertCitation,
    deleteCitation,
  }
}
