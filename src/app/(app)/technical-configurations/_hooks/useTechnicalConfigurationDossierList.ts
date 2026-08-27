"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { useDebounce } from "@/hooks/use-debounce"
import { useServerPagination } from "@/hooks/useServerPagination"

import {
  TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_DEBOUNCE_MS,
  normalizeTechnicalConfigurationDossierSearch,
} from "../technical-configuration-dossier-search"
import { technicalConfigurationDossierListQueryKey } from "../technical-configuration-query-keys"
import { listTechnicalConfigurationDossiers } from "../technical-configuration-rpc"
import type {
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierListRpcArgs,
} from "../types"

const DOSSIER_PAGE_SIZE = 20
const DOSSIER_LIST_STALE_TIME_MS = 30_000

const EMPTY_DOSSIERS: TechnicalConfigurationDossierListItemWire[] = []
const DOSSIER_LIST_REQUEST_IDENTITY_META_KEY = "technicalConfigurationDossierListRequestIdentity"

type DossierListRequestIdentity = {
  search: string
  rawSearch: string
  page: number
  pageSize: number
}

/** Reads one dossier-list request identity from TanStack Query metadata. */
function getDossierListRequestIdentity(
  meta: Record<string, unknown> | undefined
): DossierListRequestIdentity | null {
  const identity = meta?.[DOSSIER_LIST_REQUEST_IDENTITY_META_KEY]
  if (!identity || typeof identity !== "object") return null

  const candidate = identity as Record<string, unknown>
  if (
    typeof candidate.search !== "string" ||
    typeof candidate.rawSearch !== "string" ||
    typeof candidate.page !== "number" ||
    typeof candidate.pageSize !== "number"
  ) {
    return null
  }

  return identity as DossierListRequestIdentity
}

/**
 * Owns dossier-list raw/normalized/debounced search, server pagination,
 * and the pinned last-settled request identity for one module.
 */
export function useTechnicalConfigurationDossierList() {
  const [searchText, setSearchText] = React.useState("")
  const normalizedSearch = normalizeTechnicalConfigurationDossierSearch(searchText)
  const debouncedSearch = useDebounce(
    normalizedSearch,
    TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_DEBOUNCE_MS
  )
  const isDebouncePending = normalizedSearch !== debouncedSearch

  const [settled, setSettled] = React.useState<DossierListRequestIdentity>({
    search: "",
    rawSearch: "",
    page: 1,
    pageSize: DOSSIER_PAGE_SIZE,
  })
  const placeholderIdentityRef = React.useRef<DossierListRequestIdentity | null>(null)

  const listQueryKey = technicalConfigurationDossierListQueryKey({
    page: settled.page,
    pageSize: settled.pageSize,
    normalizedSearch: settled.search,
  })
  const isSettledSearchCurrent = settled.search === debouncedSearch

  const dossierListQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: ({ signal }) => {
      const rpcArgs: TechnicalConfigurationDossierListRpcArgs = {
        p_page: settled.page,
        p_page_size: settled.pageSize,
        p_include_archived: false,
      }
      if (settled.search !== "") {
        rpcArgs.p_search = settled.search
      }

      return listTechnicalConfigurationDossiers(rpcArgs, signal)
    },
    enabled: !isDebouncePending && isSettledSearchCurrent,
    meta: {
      [DOSSIER_LIST_REQUEST_IDENTITY_META_KEY]: settled,
    },
    placeholderData: (previousData, previousQuery) => {
      placeholderIdentityRef.current = getDossierListRequestIdentity(previousQuery?.meta)

      return previousData
    },
    staleTime: DOSSIER_LIST_STALE_TIME_MS,
  })
  const visibleRequestIdentity = dossierListQuery.isPlaceholderData
    ? (placeholderIdentityRef.current ?? settled)
    : settled
  const visibleListQueryKey = technicalConfigurationDossierListQueryKey({
    page: visibleRequestIdentity.page,
    pageSize: visibleRequestIdentity.pageSize,
    normalizedSearch: visibleRequestIdentity.search,
  })
  const visibleSearchText =
    normalizedSearch === visibleRequestIdentity.search
      ? searchText
      : visibleRequestIdentity.rawSearch

  const totalCount = dossierListQuery.data?.total ?? 0
  const pagination = useServerPagination({
    totalCount,
    initialPageSize: DOSSIER_PAGE_SIZE,
    resetKey: normalizedSearch,
  })

  React.useEffect(() => {
    if (isDebouncePending) return

    setSettled((current) => {
      if (
        current.search === debouncedSearch &&
        current.rawSearch === searchText &&
        current.page === pagination.page &&
        current.pageSize === pagination.pageSize
      ) {
        return current
      }

      return {
        search: debouncedSearch,
        rawSearch: searchText,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }
    })
  }, [isDebouncePending, debouncedSearch, pagination.page, pagination.pageSize, searchText])

  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      pagination.setPagination((current) => ({
        ...current,
        pageIndex: Math.max(0, nextPage - 1),
      }))
    },
    [pagination.setPagination]
  )

  return {
    searchText,
    handleSearchTextChange: setSearchText,
    hasActiveSearch: normalizedSearch !== "",
    visibleSearchText,
    hasVisibleActiveSearch: visibleRequestIdentity.search !== "",
    dossiers: dossierListQuery.data?.data ?? EMPTY_DOSSIERS,
    total: totalCount,
    page: pagination.page,
    pageSize: pagination.pageSize,
    pageCount: pagination.pageCount,
    canPreviousPage: pagination.canPreviousPage,
    canNextPage: pagination.canNextPage,
    handlePageChange,
    listQueryKey,
    visibleListQueryKey,
    visiblePage: visibleRequestIdentity.page,
    isLoading: dossierListQuery.isLoading,
    isError: dossierListQuery.isError,
    error: dossierListQuery.error,
    refetch: dossierListQuery.refetch,
    isSearchPending: isDebouncePending || !isSettledSearchCurrent || dossierListQuery.isFetching,
  }
}
