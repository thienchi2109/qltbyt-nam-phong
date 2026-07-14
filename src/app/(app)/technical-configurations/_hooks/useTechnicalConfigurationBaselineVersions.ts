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
  replaceTechnicalConfigurationBaselineFirstPageInPages,
  replaceTechnicalConfigurationBaselineVersionInPages,
  toTechnicalConfigurationBaselineVersionPages,
  validateTechnicalConfigurationBaselineVersionPage,
} from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"
import type { TechnicalConfigurationBaselineVersionPages } from "@/app/(app)/technical-configurations/technical-configuration-baseline-version-state"
import { technicalConfigurationBaselineVersionsQueryKey } from "@/app/(app)/technical-configurations/technical-configuration-query-keys"

type ListVersions = (
  args: TechnicalConfigurationBaselineVersionsListRpcArgs
) => Promise<TechnicalConfigurationBaselineVersionsListWireResponse>

/** Owns paginated baseline history retrieval and cache updates. */
export function useTechnicalConfigurationBaselineVersions({
  dossierId,
  listVersions,
}: {
  dossierId: string
  listVersions: ListVersions
}) {
  const queryClient = useQueryClient()
  const queryKey = React.useMemo(
    () => technicalConfigurationBaselineVersionsQueryKey(dossierId),
    [dossierId]
  )
  const versionsQuery = useInfiniteQuery<
    TechnicalConfigurationBaselineVersionsListWireResponse,
    Error,
    TechnicalConfigurationBaselineVersionPages,
    ReturnType<typeof technicalConfigurationBaselineVersionsQueryKey>,
    number
  >({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const precedingPages =
        queryClient
          .getQueryData<TechnicalConfigurationBaselineVersionPages>(queryKey)
          ?.pages.filter((page) => page.page < pageParam) ?? []
      return validateTechnicalConfigurationBaselineVersionPage(
        await listVersions({
          p_dossier_id: dossierId,
          p_page: pageParam,
          p_page_size: BASELINE_VERSION_PAGE_SIZE,
        }),
        precedingPages
      )
    },
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
        replaceTechnicalConfigurationBaselineFirstPageInPages(current, response)
      )
    },
    [queryClient, queryKey]
  )

  const refreshVersions = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey, exact: true }, { throwOnError: true })
    const refreshedVersions = flattenTechnicalConfigurationBaselineVersionPages(
      queryClient.getQueryData<TechnicalConfigurationBaselineVersionPages>(queryKey)
    )
    return (
      refreshedVersions.find((version) => version.status === "draft") ??
      refreshedVersions[0] ??
      null
    )
  }, [queryClient, queryKey])

  const retryVersions = React.useCallback(async () => {
    await versionsQuery.refetch()
  }, [versionsQuery])

  const loadMoreVersions = React.useCallback(async () => {
    if (versionsQuery.isFetchNextPageError) {
      await versionsQuery.refetch()
      return
    }
    if (!versionsQuery.hasNextPage || versionsQuery.isFetchingNextPage) return
    await versionsQuery.fetchNextPage()
  }, [versionsQuery])

  return {
    versionsQuery,
    versions,
    cacheVersion,
    replaceVersions,
    refreshVersions,
    retryVersions,
    loadMoreVersions,
  }
}
