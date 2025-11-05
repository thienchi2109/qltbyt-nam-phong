import { useQuery, type UseQueryOptions, useQueryClient } from "@tanstack/react-query"

import {
  type TransferCountsResponse,
  type TransferListFilters,
  type TransferListItem,
  type TransferListResponse,
} from "@/types/transfers-data-grid"

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 50

type TransferListQueryOptions = Omit<
  UseQueryOptions<TransferListResponse, Error>,
  "queryKey" | "queryFn"
>

type TransferCountsQueryOptions = Omit<
  UseQueryOptions<TransferCountsResponse, Error>,
  "queryKey" | "queryFn"
>

const sanitizeFilters = (filters: TransferListFilters = {}) => {
  const {
    q = null,
    statuses = [],
    types = [],
    page = DEFAULT_PAGE,
    pageSize = DEFAULT_PAGE_SIZE,
    facilityId = null,
    dateFrom = null,
    dateTo = null,
    assigneeIds = [],
  } = filters

  return {
    q,
    statuses: [...statuses].sort(),
    types: [...types].sort(),
    page,
    pageSize,
    facilityId,
    dateFrom,
    dateTo,
    assigneeIds: [...assigneeIds].sort((a, b) => a - b),
  }
}

const buildListParams = (filters: ReturnType<typeof sanitizeFilters>) => {
  const params = new URLSearchParams()

  if (filters.q) params.set("q", filters.q)
  if (filters.statuses.length > 0) params.set("statuses", filters.statuses.join(","))
  if (filters.types.length > 0) params.set("types", filters.types.join(","))
  if (filters.facilityId) params.set("facilityId", String(filters.facilityId))
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
  if (filters.dateTo) params.set("dateTo", filters.dateTo)
  if (filters.assigneeIds.length > 0) params.set("assigneeIds", filters.assigneeIds.join(","))

  params.set("page", String(filters.page || DEFAULT_PAGE))
  params.set("pageSize", String(filters.pageSize || DEFAULT_PAGE_SIZE))

  return params
}

const buildCountsParams = (filters: ReturnType<typeof sanitizeFilters>) => {
  const params = new URLSearchParams()

  if (filters.q) params.set("q", filters.q)
  if (filters.types.length > 0) params.set("types", filters.types.join(","))
  if (filters.facilityId) params.set("facilityId", String(filters.facilityId))
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
  if (filters.dateTo) params.set("dateTo", filters.dateTo)
  if (filters.assigneeIds.length > 0) params.set("assigneeIds", filters.assigneeIds.join(","))

  return params
}

const fetchTransferList = async (
  filters: TransferListFilters = {},
  signal?: AbortSignal,
): Promise<TransferListResponse> => {
  const sanitized = sanitizeFilters(filters)
  const params = buildListParams(sanitized)

  const response = await fetch(`/api/transfers/list?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal,
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.error || "Failed to fetch transfer list")
  }

  const data = (await response.json()) as TransferListResponse
  return {
    data: data.data || [],
    total: data.total ?? 0,
    page: data.page ?? sanitized.page,
    pageSize: data.pageSize ?? sanitized.pageSize,
  }
}

const fetchTransferCounts = async (
  filters: TransferListFilters = {},
  signal?: AbortSignal,
): Promise<TransferCountsResponse> => {
  const sanitized = sanitizeFilters(filters)
  const params = buildCountsParams(sanitized)

  const response = await fetch(`/api/transfers/counts?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal,
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.error || "Failed to fetch transfer counts")
  }

  return (await response.json()) as TransferCountsResponse
}

export const transferDataGridKeys = {
  all: ["transfers", "dataGrid"] as const,
  list: (filters: TransferListFilters = {}) => [
    ...transferDataGridKeys.all,
    "list",
    sanitizeFilters(filters),
  ] as const,
  counts: (filters: TransferListFilters = {}) => [
    ...transferDataGridKeys.all,
    "counts",
    sanitizeFilters(filters),
  ] as const,
}

export const useTransferList = (
  filters: TransferListFilters = {},
  options?: TransferListQueryOptions,
) => {
  return useQuery<TransferListResponse, Error>({
    queryKey: transferDataGridKeys.list(filters),
    queryFn: ({ signal }) => fetchTransferList(filters, signal),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    retry: 2,
    ...options,
  })
}

export const useTransferCounts = (
  filters: TransferListFilters = {},
  options?: TransferCountsQueryOptions,
) => {
  return useQuery<TransferCountsResponse, Error>({
    queryKey: transferDataGridKeys.counts(filters),
    queryFn: ({ signal }) => fetchTransferCounts(filters, signal),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
    ...options,
  })
}

export const usePrefetchTransferList = () => {
  const queryClient = useQueryClient()

  return async (filters: TransferListFilters = {}) => {
    await queryClient.prefetchQuery({
      queryKey: transferDataGridKeys.list(filters),
      queryFn: ({ signal }) => fetchTransferList(filters, signal),
    })
  }
}

export const usePrefetchTransferCounts = () => {
  const queryClient = useQueryClient()

  return async (filters: TransferListFilters = {}) => {
    await queryClient.prefetchQuery({
      queryKey: transferDataGridKeys.counts(filters),
      queryFn: ({ signal }) => fetchTransferCounts(filters, signal),
    })
  }
}

export const getTransferListData = (
  response: TransferListResponse | undefined,
): TransferListItem[] => response?.data ?? []
