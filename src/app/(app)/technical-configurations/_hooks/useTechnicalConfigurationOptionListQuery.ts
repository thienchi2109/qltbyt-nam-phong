"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { listAllTechnicalConfigurationOptions } from "../technical-configuration-supplier-option-operations"
import { technicalConfigurationOptionsQueryKey } from "../technical-configuration-query-keys"

/** Shares the dossier-scoped read-only option snapshot across authoring and comparison flows. */
export function useTechnicalConfigurationOptionListQuery(dossierId: string) {
  const queryKey = React.useMemo(
    () => technicalConfigurationOptionsQueryKey(dossierId),
    [dossierId]
  )

  const optionsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => listAllTechnicalConfigurationOptions(dossierId, signal),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  return { queryKey, optionsQuery }
}
