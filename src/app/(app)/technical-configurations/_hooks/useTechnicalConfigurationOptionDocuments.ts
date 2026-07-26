"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useTechnicalConfigurationOptionResponseRevision } from "./useTechnicalConfigurationOptionResponseRevision"
import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"
import type {
  TechnicalConfigurationCitationDeleteWireResponse,
  TechnicalConfigurationCitationMutationWireResponse,
  TechnicalConfigurationOptionDocumentDeleteWireResponse,
  TechnicalConfigurationOptionDocumentMutationWireResponse,
  TechnicalConfigurationOptionDocumentWire,
} from "../document-types"
import {
  createTechnicalConfigurationOptionDocument,
  deleteTechnicalConfigurationOptionCitation,
  deleteTechnicalConfigurationOptionDocument,
  listTechnicalConfigurationOptionDocuments,
  updateTechnicalConfigurationOptionDocument,
  upsertTechnicalConfigurationOptionCitation,
} from "../technical-configuration-document-rpc"
import { getOrCreateTechnicalConfigurationComparisonSet } from "../technical-configuration-option-response-operations"
import {
  technicalConfigurationBaselineVersionsQueryKey,
  technicalConfigurationOptionDocumentsQueryKey,
  technicalConfigurationOptionDocumentsQueryKeyPrefix,
  technicalConfigurationOptionResponsesQueryKey,
} from "../technical-configuration-query-keys"
import { isTechnicalConfigurationBaselineConflict } from "../technical-configuration-baseline-version-state"
import { fetchTechnicalConfigurationDossierRevision } from "../technical-configuration-dossier-revision-cache"
import { collectStableTechnicalConfigurationPages } from "../technical-configuration-pagination"
import type {
  TechnicalConfigurationComparisonSetWire,
  TechnicalConfigurationOptionWire,
} from "../supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "../types"

const DOCUMENT_PAGE_SIZE = 100
const EMPTY_DOCUMENTS: TechnicalConfigurationOptionDocumentWire[] = []

type UseTechnicalConfigurationOptionDocumentsOptions = {
  dossier: TechnicalConfigurationDossierWire
  option: TechnicalConfigurationOptionWire
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  comparisonSet?: TechnicalConfigurationComparisonSetWire | null
  readOnly?: boolean
  isMutationBlocked?: boolean
  onRevisionChange?: (revision: number) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
}

type CreateTechnicalConfigurationOptionDocumentInput = {
  name: string
  url: string
}

type UpdateTechnicalConfigurationOptionDocumentInput = {
  document: TechnicalConfigurationOptionDocumentWire
  name: string
  url: string
}

type UpsertTechnicalConfigurationOptionCitationInput = {
  document: TechnicalConfigurationOptionDocumentWire
  criterionId: string
  pageSection: string | null
  excerpt: string | null
}

type DeleteTechnicalConfigurationOptionCitationInput = {
  document: TechnicalConfigurationOptionDocumentWire
  citationId: string
}

type RevisionedMutationResponse =
  | TechnicalConfigurationOptionDocumentMutationWireResponse
  | TechnicalConfigurationOptionDocumentDeleteWireResponse
  | TechnicalConfigurationCitationMutationWireResponse
  | TechnicalConfigurationCitationDeleteWireResponse

async function listAllTechnicalConfigurationOptionDocuments(
  optionId: string,
  baselineVersionId: string,
  signal?: AbortSignal
): Promise<TechnicalConfigurationOptionDocumentWire[]> {
  const { items } = await collectStableTechnicalConfigurationPages<
    TechnicalConfigurationOptionDocumentWire,
    Awaited<ReturnType<typeof listTechnicalConfigurationOptionDocuments>>
  >({
    loadPage: (page) =>
      listTechnicalConfigurationOptionDocuments(
        {
          p_option_id: optionId,
          p_baseline_version_id: baselineVersionId,
          p_page: page,
          p_page_size: DOCUMENT_PAGE_SIZE,
        },
        signal
      ),
    snapshotError: "Option-evidence pagination snapshot changed during load.",
    getItemKey: (document) => document.id,
  })
  return items
}

/** Owns shared option documents and exact-baseline citation mutations. */
export function useTechnicalConfigurationOptionDocuments({
  dossier,
  option,
  baselineVersion,
  comparisonSet = null,
  readOnly = false,
  isMutationBlocked = false,
  onRevisionChange,
  onNavigationBlockedChange,
}: UseTechnicalConfigurationOptionDocumentsOptions) {
  const queryClient = useQueryClient()
  const documentsQueryKey = technicalConfigurationOptionDocumentsQueryKey(
    option.id,
    baselineVersion.id
  )
  const comparisonSetQueryKey = technicalConfigurationOptionResponsesQueryKey(
    option.id,
    baselineVersion.id
  )
  const cachedComparisonSet =
    queryClient.getQueryData<TechnicalConfigurationComparisonSetWire | null>(
      comparisonSetQueryKey
    ) ?? null
  const comparisonSetRef = React.useRef(comparisonSet ?? cachedComparisonSet)
  React.useEffect(() => {
    if (
      comparisonSet &&
      comparisonSet.revision >= (comparisonSetRef.current?.revision ?? Number.NEGATIVE_INFINITY)
    ) {
      comparisonSetRef.current = comparisonSet
    }
  }, [comparisonSet])
  const { commitRevision, revisionRef } = useTechnicalConfigurationOptionResponseRevision({
    dossier,
    initialRevision: Math.max(
      baselineVersion.revision,
      comparisonSet?.revision ?? dossier.revision,
      cachedComparisonSet?.revision ?? dossier.revision
    ),
    onRevisionChange,
  })
  const mutationInFlightRef = React.useRef(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isConflict, setIsConflict] = React.useState(false)
  const [mutationError, setMutationError] = React.useState<unknown>(null)
  const isReadOnly = readOnly || dossier.archived_at !== null

  const documentsQuery = useQuery({
    queryKey: documentsQueryKey,
    queryFn: ({ signal }) =>
      listAllTechnicalConfigurationOptionDocuments(option.id, baselineVersion.id, signal),
    staleTime: 30_000,
  })
  const documents = documentsQuery.data ?? EMPTY_DOCUMENTS

  const refreshAfterMutation = React.useCallback(
    async (revision: number) => {
      commitRevision(revision)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: technicalConfigurationOptionDocumentsQueryKeyPrefix(option.id),
        }),
        queryClient.invalidateQueries({
          queryKey: technicalConfigurationBaselineVersionsQueryKey(dossier.id),
          exact: true,
        }),
      ])
    },
    [commitRevision, dossier.id, option.id, queryClient]
  )

  const runMutation = React.useCallback(
    async <TResponse extends RevisionedMutationResponse>(
      request: (expectedRevision: number) => Promise<TResponse>
    ): Promise<TResponse> => {
      if (mutationInFlightRef.current) throw new Error("mutation_in_progress")
      if (isMutationBlocked) throw new Error("mutation_blocked")
      if (isReadOnly) throw new Error("read_only")

      mutationInFlightRef.current = true
      setIsSaving(true)
      setIsConflict(false)
      setMutationError(null)
      onNavigationBlockedChange?.(true)
      try {
        const response = await request(revisionRef.current ?? dossier.revision)
        await refreshAfterMutation(response.data.revision)
        return response
      } catch (error) {
        const isConflict = isTechnicalConfigurationBaselineConflict(error)
        setMutationError(error)
        setIsConflict(isConflict)
        if (isConflict) {
          try {
            const refreshedRevision = await fetchTechnicalConfigurationDossierRevision(
              queryClient,
              dossier.id
            )
            commitRevision(refreshedRevision)
          } catch {
            // Keep the original conflict visible and preserve the local draft for another retry.
          }
        }
        throw error
      } finally {
        mutationInFlightRef.current = false
        setIsSaving(false)
        onNavigationBlockedChange?.(false)
      }
    },
    [
      dossier.revision,
      isMutationBlocked,
      isReadOnly,
      onNavigationBlockedChange,
      commitRevision,
      dossier.id,
      queryClient,
      refreshAfterMutation,
      revisionRef,
    ]
  )

  const createDocument = React.useCallback(
    ({ name, url }: CreateTechnicalConfigurationOptionDocumentInput) =>
      runMutation((expectedRevision) =>
        createTechnicalConfigurationOptionDocument({
          p_option_id: option.id,
          p_name: name,
          p_url: url,
          p_expected_revision: expectedRevision,
        })
      ),
    [option.id, runMutation]
  )

  const updateDocument = React.useCallback(
    ({ document, name, url }: UpdateTechnicalConfigurationOptionDocumentInput) =>
      runMutation((expectedRevision) =>
        updateTechnicalConfigurationOptionDocument({
          p_option_document_id: document.id,
          p_name: name,
          p_url: url,
          p_expected_revision: expectedRevision,
        })
      ),
    [runMutation]
  )

  const deleteDocument = React.useCallback(
    async (document: TechnicalConfigurationOptionDocumentWire) => {
      const response = await runMutation((expectedRevision) =>
        deleteTechnicalConfigurationOptionDocument({
          p_option_document_id: document.id,
          p_expected_revision: expectedRevision,
        })
      )
      return response.data.affected_citation_count
    },
    [runMutation]
  )

  const upsertCitation = React.useCallback(
    ({
      document,
      criterionId,
      pageSection,
      excerpt,
    }: UpsertTechnicalConfigurationOptionCitationInput) =>
      runMutation(async (expectedRevision) => {
        let citationExpectedRevision = expectedRevision
        let activeComparisonSet =
          comparisonSetRef.current ??
          queryClient.getQueryData<TechnicalConfigurationComparisonSetWire | null>(
            comparisonSetQueryKey
          ) ??
          null
        if (!activeComparisonSet) {
          activeComparisonSet = await getOrCreateTechnicalConfigurationComparisonSet({
            p_option_id: option.id,
            p_baseline_version_id: baselineVersion.id,
            p_expected_revision: expectedRevision,
          })
          comparisonSetRef.current = activeComparisonSet
          queryClient.setQueryData(comparisonSetQueryKey, activeComparisonSet)
          commitRevision(activeComparisonSet.revision)
          citationExpectedRevision = activeComparisonSet.revision
        }
        return upsertTechnicalConfigurationOptionCitation({
          p_option_document_id: document.id,
          p_comparison_set_id: activeComparisonSet.id,
          p_criterion_id: criterionId,
          p_page_section: pageSection,
          p_excerpt: excerpt,
          p_expected_revision: citationExpectedRevision,
        })
      }),
    [baselineVersion.id, commitRevision, comparisonSetQueryKey, option.id, queryClient, runMutation]
  )

  const deleteCitation = React.useCallback(
    ({ citationId }: DeleteTechnicalConfigurationOptionCitationInput) =>
      runMutation((expectedRevision) =>
        deleteTechnicalConfigurationOptionCitation({
          p_option_citation_id: citationId,
          p_expected_revision: expectedRevision,
        })
      ),
    [runMutation]
  )

  return {
    documentsQuery,
    documents,
    isReadOnly,
    isMutationBlocked,
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
