"use client"

import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  adoptCompleteAssessment,
  ASSESSMENT_COLLECTION_PAGE_SIZE,
  collectTechnicalConfigurationAssessments,
  loadKnownAbsentCompleteAssessments,
  type TechnicalConfigurationCompleteAssessmentMap,
} from "./TechnicalConfigurationAssessmentCompleteCache"
import { useTechnicalConfigurationOptionResponsesQuery } from "./useTechnicalConfigurationOptionResponsesQuery"
import type {
  TechnicalConfigurationAssessmentListWireResponse,
  TechnicalConfigurationAssessmentSaveResult,
  TechnicalConfigurationAssessmentUpsertInput,
} from "../assessment-types"
import {
  listTechnicalConfigurationAssessments,
  upsertTechnicalConfigurationAssessment,
} from "../technical-configuration-assessment-rpc"
import { getOrCreateTechnicalConfigurationComparisonSet } from "../technical-configuration-option-response-operations"
import {
  technicalConfigurationAssessmentsQueryKey,
  technicalConfigurationAssessmentsQueryKeyPrefix,
  technicalConfigurationEvaluationCriteriaQueryKeyPrefix,
  technicalConfigurationReferenceRankingQueryKey,
} from "../technical-configuration-query-keys"
import type { TechnicalConfigurationComparisonSetWire } from "../supplier-option-types"

interface TechnicalConfigurationAssessmentContext {
  optionId: string
  baselineVersionId: string | null
  onComparisonSetReady?: (comparisonSet: TechnicalConfigurationComparisonSetWire) => void
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
  const { optionId, baselineVersionId, onComparisonSetReady } = input
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
  const completeAssessmentsQuery = useQuery<TechnicalConfigurationCompleteAssessmentMap>({
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

      const comparisonSetState =
        queryClient.getQueryState<TechnicalConfigurationComparisonSetWire | null>(
          comparisonSetQueryKey
        )
      const cachedComparisonSet = comparisonSetState?.data
      const comparisonSetWasKnownAbsent =
        comparisonSetState?.status === "success" && cachedComparisonSet === null
      const comparisonSet = await acquireAssessmentComparisonSet({
        queryClient,
        comparisonSetQueryKey,
        optionId,
        baselineVersionId,
        expectedDossierRevision: input.expectedDossierRevision,
      })
      if (!cachedComparisonSet) {
        onComparisonSetReady?.(comparisonSet)
      }
      const knownAbsentSnapshot = comparisonSetWasKnownAbsent
        ? loadKnownAbsentCompleteAssessments(queryClient, comparisonSet.id)
        : null

      const response = await upsertTechnicalConfigurationAssessment({
        p_comparison_set_id: comparisonSet.id,
        p_criterion_id: input.criterionId,
        p_technical_axis: input.technicalAxis,
        p_evidence_axis: input.evidenceAxis,
        p_notes: input.notes,
        p_expected_revision: input.expectedRevision,
      })

      if (knownAbsentSnapshot) {
        void knownAbsentSnapshot
          .then((isAuthoritative) => {
            if (isAuthoritative) {
              adoptCompleteAssessment(queryClient, comparisonSet.id, response.data)
            }
            return queryClient.invalidateQueries({
              queryKey: technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSet.id),
            })
          })
          .catch(() => undefined)
      } else {
        adoptCompleteAssessment(queryClient, comparisonSet.id, response.data)
        void queryClient
          .invalidateQueries({
            queryKey: technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSet.id),
          })
          .catch(() => undefined)
      }
      return { comparisonSet, assessment: response.data }
    },
    onSuccess: async ({ comparisonSet }) => {
      let rankingQueryKey: ReturnType<
        typeof technicalConfigurationReferenceRankingQueryKey
      > | null = null
      if (baselineVersionId) {
        await queryClient.invalidateQueries({
          queryKey: technicalConfigurationEvaluationCriteriaQueryKeyPrefix(
            optionId,
            baselineVersionId
          ),
        })
        rankingQueryKey = technicalConfigurationReferenceRankingQueryKey({
          dossierId: comparisonSet.dossier_id,
          baselineVersionId,
        })
      }
      if (rankingQueryKey) {
        void queryClient
          .resetQueries({
            queryKey: rankingQueryKey,
            exact: true,
          })
          .catch(() => undefined)
      }
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
