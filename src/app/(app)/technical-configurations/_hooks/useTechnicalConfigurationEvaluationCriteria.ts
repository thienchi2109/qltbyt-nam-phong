"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import type {
  TechnicalConfigurationEvaluationCriterionListWireResponse,
  TechnicalConfigurationEvaluationCriterionWire,
  TechnicalConfigurationEvaluationStatusFilter,
} from "../assessment-types"
import { TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE } from "../comparison-matrix-constants"
import { listTechnicalConfigurationEvaluationCriteria } from "../technical-configuration-assessment-rpc"
import { technicalConfigurationEvaluationCriteriaQueryKey } from "../technical-configuration-query-keys"
import { collectStableTechnicalConfigurationPages } from "../technical-configuration-pagination"

const EVALUATION_CRITERIA_SNAPSHOT_ERROR =
  "Evaluation criterion pagination snapshot changed during load."

type EvaluationCriteriaInput = {
  optionId: string
  baselineVersionId: string
  statusFilter: TechnicalConfigurationEvaluationStatusFilter
}

async function collectTechnicalConfigurationEvaluationCriteria(
  input: EvaluationCriteriaInput,
  signal?: AbortSignal
): Promise<TechnicalConfigurationEvaluationCriterionWire[]> {
  const { items } = await collectStableTechnicalConfigurationPages<
    TechnicalConfigurationEvaluationCriterionWire,
    TechnicalConfigurationEvaluationCriterionListWireResponse
  >({
    loadPage: async (page) => {
      const response = await listTechnicalConfigurationEvaluationCriteria(
        {
          p_option_id: input.optionId,
          p_baseline_version_id: input.baselineVersionId,
          p_status_filter: input.statusFilter,
          p_page: page,
          p_page_size: TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE,
        },
        signal
      )
      if (
        response.page !== page ||
        response.page_size !== TECHNICAL_CONFIGURATION_CRITERION_PAGE_SIZE
      ) {
        throw new Error(EVALUATION_CRITERIA_SNAPSHOT_ERROR)
      }
      return response
    },
    snapshotError: EVALUATION_CRITERIA_SNAPSHOT_ERROR,
    getItemKey: (item) => item.criterion_id,
  })

  return items
}

/** Loads complete criterion IDs after the status filter has been applied by Postgres. */
export function useTechnicalConfigurationEvaluationCriteria(input: EvaluationCriteriaInput) {
  const queryClient = useQueryClient()
  const criteriaQuery = useQuery({
    queryKey: technicalConfigurationEvaluationCriteriaQueryKey(input),
    queryFn: ({ signal }) => collectTechnicalConfigurationEvaluationCriteria(input, signal),
    enabled: Boolean(input.optionId && input.baselineVersionId),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const loadCriteria = React.useCallback(
    (nextInput: EvaluationCriteriaInput) =>
      queryClient.fetchQuery({
        queryKey: technicalConfigurationEvaluationCriteriaQueryKey(nextInput),
        queryFn: ({ signal }) => collectTechnicalConfigurationEvaluationCriteria(nextInput, signal),
        staleTime: 30_000,
        retry: false,
      }),
    [queryClient]
  )

  return {
    criteriaQuery,
    loadCriteria,
  }
}
