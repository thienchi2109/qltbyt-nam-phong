import * as React from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"

import type {
  TechnicalConfigurationBaselineDraftWire,
  TechnicalConfigurationBaselineVersionsListRpcArgs,
  TechnicalConfigurationBaselineVersionsListWireResponse,
} from "@/app/(app)/technical-configurations/baseline-types"
import {
  BASELINE_VERSION_PAGE_SIZE,
  flattenTechnicalConfigurationBaselineVersionPages,
  getTechnicalConfigurationBaselineNextPage,
  replaceTechnicalConfigurationBaselineVersionInPages,
  toTechnicalConfigurationBaselineVersionPages,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"
import type { TechnicalConfigurationBaselineVersionPages } from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"

type ListVersions = (
  args: TechnicalConfigurationBaselineVersionsListRpcArgs
) => Promise<TechnicalConfigurationBaselineVersionsListWireResponse>

function baselineVersionsQueryKey(dossierId: string) {
  return ["technical-configurations", "baseline-versions", dossierId] as const
}

/** Owns paginated baseline history retrieval and cache updates. */
export function useTechnicalConfigurationBaselineVersions({
  dossierId,
  listVersions,
}: {
  dossierId: string
  listVersions: ListVersions
}) {
  const queryClient = useQueryClient()
  const queryKey = React.useMemo(() => baselineVersionsQueryKey(dossierId), [dossierId])
  const versionsQuery = useInfiniteQuery<
    TechnicalConfigurationBaselineVersionsListWireResponse,
    Error,
    TechnicalConfigurationBaselineVersionPages,
    ReturnType<typeof baselineVersionsQueryKey>,
    number
  >({
    queryKey,
    queryFn: ({ pageParam }) =>
      listVersions({
        p_dossier_id: dossierId,
        p_page: pageParam,
        p_page_size: BASELINE_VERSION_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: getTechnicalConfigurationBaselineNextPage,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const versions = React.useMemo(
    () => flattenTechnicalConfigurationBaselineVersionPages(versionsQuery.data),
    [versionsQuery.data]
  )

  const cacheVersion = React.useCallback(
    (version: TechnicalConfigurationBaselineDraftWire) => {
      queryClient.setQueryData<TechnicalConfigurationBaselineVersionPages>(queryKey, (current) =>
        replaceTechnicalConfigurationBaselineVersionInPages(current, version)
      )
    },
    [queryClient, queryKey]
  )

  const replaceVersions = React.useCallback(
    (response: TechnicalConfigurationBaselineVersionsListWireResponse) => {
      queryClient.setQueryData<TechnicalConfigurationBaselineVersionPages>(queryKey, (current) =>
        current
          ? {
              ...current,
              pages: [response, ...current.pages.slice(1)],
              pageParams: [response.page, ...current.pageParams.slice(1)],
            }
          : toTechnicalConfigurationBaselineVersionPages(response)
      )
    },
    [queryClient, queryKey]
  )

  const loadMoreVersions = React.useCallback(async () => {
    if (!versionsQuery.hasNextPage || versionsQuery.isFetchingNextPage) return
    await versionsQuery.fetchNextPage()
  }, [versionsQuery])

  return {
    versionsQuery,
    versions,
    cacheVersion,
    replaceVersions,
    loadMoreVersions,
  }
}
