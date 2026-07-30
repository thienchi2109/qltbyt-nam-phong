"use client"

import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useTechnicalConfigurationOptionResponsesQuery } from "./useTechnicalConfigurationOptionResponsesQuery"
import type {
  TechnicalConfigurationAssessmentListWireResponse,
  TechnicalConfigurationAssessmentSaveResult,
  TechnicalConfigurationAssessmentUpsertInput,
  TechnicalConfigurationAssessmentWire,
} from "../assessment-types"
import {
  listTechnicalConfigurationAssessments,
  upsertTechnicalConfigurationAssessment,
} from "../technical-configuration-assessment-rpc"
import { getOrCreateTechnicalConfigurationComparisonSet } from "../technical-configuration-option-response-operations"
import {
  technicalConfigurationAssessmentsQueryKey,
  technicalConfigurationAssessmentsQueryKeyPrefix,
} from "../technical-configuration-query-keys"
import { collectStableTechnicalConfigurationPages } from "../technical-configuration-pagination"
import type { TechnicalConfigurationComparisonSetWire } from "../supplier-option-types"

const ASSESSMENT_COLLECTION_PAGE_SIZE = 100
const ASSESSMENT_PAGINATION_SNAPSHOT_ERROR = "Assessment pagination snapshot changed during load."

interface TechnicalConfigurationAssessmentContext {
  optionId: string
  baselineVersionId: string | null
}

type UseTechnicalConfigurationAssessmentsInput = TechnicalConfigurationAssessmentContext &
  (
    | {
        collectionMode?: "bounded"
        page: number
        pageSize: number
      }
    | {
        collectionMode: "complete"
      }
  )

const comparisonSetAcquisitions = new WeakMap<
  QueryClient,
  Map<string, Promise<TechnicalConfigurationComparisonSetWire>>
>()

function isValidAssessmentPage(page: number, pageSize: number): boolean {
  return (
    Number.isInteger(page) &&
    page >= 1 &&
    Number.isInteger(pageSize) &&
    pageSize >= 1 &&
    pageSize <= 100
  )
}

async function collectTechnicalConfigurationAssessments(
  comparisonSetId: string,
  signal?: AbortSignal
): Promise<Readonly<Record<string, TechnicalConfigurationAssessmentWire>>> {
  const { items } = await collectStableTechnicalConfigurationPages<
    TechnicalConfigurationAssessmentWire,
    TechnicalConfigurationAssessmentListWireResponse
  >({
    loadPage: async (page) => {
      const response = await listTechnicalConfigurationAssessments(
        {
          p_comparison_set_id: comparisonSetId,
          p_page: page,
          p_page_size: ASSESSMENT_COLLECTION_PAGE_SIZE,
        },
        signal
      )
      if (response.page !== page || response.page_size !== ASSESSMENT_COLLECTION_PAGE_SIZE) {
        throw new Error(ASSESSMENT_PAGINATION_SNAPSHOT_ERROR)
      }
      return response
    },
    snapshotError: ASSESSMENT_PAGINATION_SNAPSHOT_ERROR,
    getItemKey: (item) => item.criterion_id,
  })

  return Object.fromEntries(items.map((item) => [item.criterion_id, item]))
}

function acquireAssessmentComparisonSet({
  queryClient,
  comparisonSetQueryKey,
  optionId,
  baselineVersionId,
  expectedDossierRevision,
}: {
  queryClient: QueryClient
  comparisonSetQueryKey: readonly unknown[]
  optionId: string
  baselineVersionId: string
  expectedDossierRevision: number
}): Promise<TechnicalConfigurationComparisonSetWire> {
  const cachedComparisonSet =
    queryClient.getQueryData<TechnicalConfigurationComparisonSetWire | null>(comparisonSetQueryKey)
  if (cachedComparisonSet) {
    return Promise.resolve(cachedComparisonSet)
  }

  let acquisitions = comparisonSetAcquisitions.get(queryClient)
  if (!acquisitions) {
    acquisitions = new Map()
    comparisonSetAcquisitions.set(queryClient, acquisitions)
  }

  const acquisitionKey = `${optionId}:${baselineVersionId}`
  const inFlightAcquisition = acquisitions.get(acquisitionKey)
  if (inFlightAcquisition) {
    return inFlightAcquisition
  }

  const acquisition = Promise.resolve()
    .then(() =>
      getOrCreateTechnicalConfigurationComparisonSet({
        p_option_id: optionId,
        p_baseline_version_id: baselineVersionId,
        p_expected_revision: expectedDossierRevision,
      })
    )
    .then((comparisonSet) => {
      queryClient.setQueryData(comparisonSetQueryKey, comparisonSet)
      return comparisonSet
    })
    .finally(() => {
      acquisitions.delete(acquisitionKey)
      if (acquisitions.size === 0) {
        comparisonSetAcquisitions.delete(queryClient)
      }
    })

  acquisitions.set(acquisitionKey, acquisition)
  return acquisition
}

/** Exposes the dormant P11C assessment data contract without mounting assessment UI. */
export function useTechnicalConfigurationAssessments(
  input: UseTechnicalConfigurationAssessmentsInput
) {
  const { optionId, baselineVersionId } = input
  const isCompleteCollection = input.collectionMode === "complete"
  const page = isCompleteCollection ? 1 : input.page
  const pageSize = isCompleteCollection ? ASSESSMENT_COLLECTION_PAGE_SIZE : input.pageSize
  const queryClient = useQueryClient()
  const { queryKey: comparisonSetQueryKey, responseQuery: comparisonSetQuery } =
    useTechnicalConfigurationOptionResponsesQuery({
      optionId,
      baselineVersionId,
    })
  const comparisonSetId = comparisonSetQuery.data?.id ?? ""
  const queryKey = technicalConfigurationAssessmentsQueryKey({
    comparisonSetId,
    page,
    pageSize,
  })
  const completeQueryKey = [
    ...technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSetId),
    "complete",
  ] as const
  const hasComparisonSet = comparisonSetId !== ""
  const boundedQueryEnabled =
    hasComparisonSet && !isCompleteCollection && isValidAssessmentPage(page, pageSize)
  const completeQueryEnabled = hasComparisonSet && isCompleteCollection
  const assessmentsQuery = useQuery<TechnicalConfigurationAssessmentListWireResponse>({
    queryKey,
    queryFn: ({ signal }) => {
      if (!boundedQueryEnabled) {
        return Promise.reject(new Error("Technical configuration assessment query is disabled"))
      }

      return listTechnicalConfigurationAssessments(
        {
          p_comparison_set_id: comparisonSetId,
          p_page: page,
          p_page_size: pageSize,
        },
        signal
      )
    },
    enabled: boundedQueryEnabled,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const completeAssessmentsQuery = useQuery<
    Readonly<Record<string, TechnicalConfigurationAssessmentWire>>
  >({
    queryKey: completeQueryKey,
    queryFn: ({ signal }) => {
      if (!completeQueryEnabled) {
        return Promise.reject(
          new Error("Technical configuration assessment collection query is disabled")
        )
      }

      return collectTechnicalConfigurationAssessments(comparisonSetId, signal)
    },
    enabled: completeQueryEnabled,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const upsertAssessment = useMutation<
    TechnicalConfigurationAssessmentSaveResult,
    unknown,
    TechnicalConfigurationAssessmentUpsertInput
  >({
    mutationFn: async (input) => {
      if (!baselineVersionId) {
        throw new Error("technical_configuration_assessment_context_unavailable")
      }

      const comparisonSet = await acquireAssessmentComparisonSet({
        queryClient,
        comparisonSetQueryKey,
        optionId,
        baselineVersionId,
        expectedDossierRevision: input.expectedDossierRevision,
      })

      const response = await upsertTechnicalConfigurationAssessment({
        p_comparison_set_id: comparisonSet.id,
        p_criterion_id: input.criterionId,
        p_technical_axis: input.technicalAxis,
        p_evidence_axis: input.evidenceAxis,
        p_notes: input.notes,
        p_expected_revision: input.expectedRevision,
      })

      return { comparisonSet, assessment: response.data }
    },
    onSuccess: async ({ comparisonSet }) => {
      await queryClient.invalidateQueries({
        queryKey: technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSet.id),
      })
    },
  })

  return {
    comparisonSetQuery,
    queryKey,
    assessmentsQuery,
    completeQueryKey,
    completeAssessmentsQuery,
    upsertAssessment,
  }
}
