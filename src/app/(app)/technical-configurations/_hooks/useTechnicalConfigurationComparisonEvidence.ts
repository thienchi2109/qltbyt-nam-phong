"use client"

import * as React from "react"
import { useInfiniteQuery } from "@tanstack/react-query"

import type {
  TechnicalConfigurationCitationWire,
  TechnicalConfigurationDocumentWire,
  TechnicalConfigurationOptionDocumentWire,
} from "../document-types"
import {
  listTechnicalConfigurationBaselineDocuments,
  listTechnicalConfigurationOptionDocuments,
} from "../technical-configuration-document-rpc"
import {
  technicalConfigurationDocumentsQueryKey,
  technicalConfigurationOptionDocumentsQueryKey,
} from "../technical-configuration-query-keys"

const COMPARISON_EVIDENCE_PAGE_SIZE = 20

export type TechnicalConfigurationComparisonEvidenceTarget =
  | {
      kind: "baseline"
      baselineVersionId: string
      criterionId: string
    }
  | {
      kind: "option"
      baselineVersionId: string
      optionId: string
      criterionId: string
    }

export type TechnicalConfigurationComparisonEvidenceDocument = {
  id: string
  name: string
  url: string
  citations: TechnicalConfigurationCitationWire[]
}

type TechnicalConfigurationComparisonEvidencePage = {
  data: TechnicalConfigurationComparisonEvidenceDocument[]
  total: number
  page: number
  pageSize: number
}

function normalizeComparisonEvidenceDocument(
  document: TechnicalConfigurationDocumentWire | TechnicalConfigurationOptionDocumentWire
): TechnicalConfigurationComparisonEvidenceDocument {
  return {
    id: document.id,
    name: document.name,
    url: document.url,
    citations: document.citations,
  }
}

function getComparisonEvidenceQueryKey(target: TechnicalConfigurationComparisonEvidenceTarget) {
  const ownerQueryKey =
    target.kind === "baseline"
      ? technicalConfigurationDocumentsQueryKey(target.baselineVersionId)
      : technicalConfigurationOptionDocumentsQueryKey(target.optionId, target.baselineVersionId)

  return [...ownerQueryKey, "comparison-evidence", COMPARISON_EVIDENCE_PAGE_SIZE] as const
}

async function listComparisonEvidencePage(
  target: TechnicalConfigurationComparisonEvidenceTarget,
  page: number,
  signal: AbortSignal
): Promise<TechnicalConfigurationComparisonEvidencePage> {
  if (target.kind === "baseline") {
    const response = await listTechnicalConfigurationBaselineDocuments(
      {
        p_baseline_version_id: target.baselineVersionId,
        p_page: page,
        p_page_size: COMPARISON_EVIDENCE_PAGE_SIZE,
      },
      signal
    )

    const data: TechnicalConfigurationComparisonEvidenceDocument[] = []
    for (const document of response.data) {
      if (document.owner_type === "baseline" && document.owner_id === target.baselineVersionId) {
        data.push(normalizeComparisonEvidenceDocument(document))
      }
    }

    return {
      data,
      total: response.total,
      page: response.page,
      pageSize: response.page_size,
    }
  }

  const response = await listTechnicalConfigurationOptionDocuments(
    {
      p_option_id: target.optionId,
      p_baseline_version_id: target.baselineVersionId,
      p_page: page,
      p_page_size: COMPARISON_EVIDENCE_PAGE_SIZE,
    },
    signal
  )

  return {
    data: response.data.map(normalizeComparisonEvidenceDocument),
    total: response.total,
    page: response.page,
    pageSize: response.page_size,
  }
}

/** Lazily loads bounded read-only evidence for one active comparison cell. */
export function useTechnicalConfigurationComparisonEvidence(
  target: TechnicalConfigurationComparisonEvidenceTarget
) {
  const evidenceQuery = useInfiniteQuery({
    queryKey: getComparisonEvidenceQueryKey(target),
    queryFn: ({ pageParam, signal }) => listComparisonEvidencePage(target, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const documents = React.useMemo(
    () => evidenceQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [evidenceQuery.data?.pages]
  )

  return {
    documents,
    evidenceQuery,
  }
}
