"use client"

import { useQuery } from "@tanstack/react-query"

import type {
  TechnicalConfigurationComparisonRequest,
  TechnicalConfigurationComparisonResult,
} from "../comparison-types"
import { getTechnicalConfigurationComparison } from "../technical-configuration-comparison-rpc"
import { technicalConfigurationComparisonQueryKey } from "../technical-configuration-query-keys"

interface UseTechnicalConfigurationComparisonInput {
  baselineVersionId: string | null
  optionIds: readonly string[]
  page: number
  pageSize: number
}

function isValidComparisonRequest(request: TechnicalConfigurationComparisonRequest): boolean {
  return (
    request.baselineVersionId !== "" &&
    request.optionIds.length >= 1 &&
    request.optionIds.length <= 8 &&
    new Set(request.optionIds).size === request.optionIds.length &&
    Number.isInteger(request.page) &&
    request.page >= 1 &&
    Number.isInteger(request.pageSize) &&
    request.pageSize >= 1 &&
    request.pageSize <= 100
  )
}

/** Exposes the P10A2 comparison read without mounting any matrix UI. */
export function useTechnicalConfigurationComparison({
  baselineVersionId,
  optionIds,
  page,
  pageSize,
}: UseTechnicalConfigurationComparisonInput) {
  const queryKey = technicalConfigurationComparisonQueryKey({
    baselineVersionId: baselineVersionId ?? "",
    optionIds,
    page,
    pageSize,
  })
  const request: TechnicalConfigurationComparisonRequest = {
    baselineVersionId: queryKey[2],
    optionIds: queryKey[3],
    page: queryKey[4],
    pageSize: queryKey[5],
  }
  const enabled = isValidComparisonRequest(request)
  const comparisonQuery = useQuery<TechnicalConfigurationComparisonResult>({
    queryKey,
    queryFn: ({ signal }) => {
      if (!enabled) {
        return Promise.reject(new Error("Technical configuration comparison query is disabled"))
      }

      return getTechnicalConfigurationComparison(request, signal)
    },
    enabled,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  return { queryKey, comparisonQuery }
}
