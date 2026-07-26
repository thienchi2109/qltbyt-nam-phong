"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { readTechnicalConfigurationComparisonSet } from "../technical-configuration-option-response-operations"
import { selectNewestTechnicalConfigurationOptionResponseSnapshot } from "../technical-configuration-option-response-state"
import { technicalConfigurationOptionResponsesQueryKey } from "../technical-configuration-query-keys"
import type { TechnicalConfigurationComparisonSetWire } from "../supplier-option-types"

/** Reads one option/exact-baseline response snapshot through the shared query contract. */
export function useTechnicalConfigurationOptionResponsesQuery({
  optionId,
  baselineVersionId,
}: {
  optionId: string
  baselineVersionId: string | null
}) {
  const queryKey = React.useMemo(
    () => technicalConfigurationOptionResponsesQueryKey(optionId, baselineVersionId ?? ""),
    [baselineVersionId, optionId]
  )
  const responseQuery = useQuery<TechnicalConfigurationComparisonSetWire | null>({
    queryKey,
    queryFn: ({ signal }) => {
      if (!baselineVersionId) return Promise.resolve(null)
      return readTechnicalConfigurationComparisonSet(
        {
          p_option_id: optionId,
          p_baseline_version_id: baselineVersionId,
        },
        signal
      )
    },
    enabled: baselineVersionId !== null,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    structuralSharing: (current, incoming) =>
      selectNewestTechnicalConfigurationOptionResponseSnapshot(
        current as TechnicalConfigurationComparisonSetWire | null | undefined,
        incoming as TechnicalConfigurationComparisonSetWire | null
      ),
  })

  return { queryKey, responseQuery }
}
