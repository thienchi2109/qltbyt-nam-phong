"use client"

import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useTechnicalConfigurationOptionResponsesQuery } from "./useTechnicalConfigurationOptionResponsesQuery"
import type {
  TechnicalConfigurationAssessmentListWireResponse,
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
import type { TechnicalConfigurationComparisonSetWire } from "../supplier-option-types"

interface UseTechnicalConfigurationAssessmentsInput {
  optionId: string
  baselineVersionId: string | null
  page: number
  pageSize: number
}

interface TechnicalConfigurationAssessmentSaveResult {
  comparisonSet: TechnicalConfigurationComparisonSetWire
  assessment: TechnicalConfigurationAssessmentWire
}

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
export function useTechnicalConfigurationAssessments({
  optionId,
  baselineVersionId,
  page,
  pageSize,
}: UseTechnicalConfigurationAssessmentsInput) {
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
  const enabled = comparisonSetId !== "" && isValidAssessmentPage(page, pageSize)
  const assessmentsQuery = useQuery<TechnicalConfigurationAssessmentListWireResponse>({
    queryKey,
    queryFn: ({ signal }) => {
      if (!enabled) {
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
    enabled,
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
    upsertAssessment,
  }
}
