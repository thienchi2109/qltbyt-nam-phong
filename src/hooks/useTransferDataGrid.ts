import { useQuery, type UseQueryOptions } from "@tanstack/react-query"

import { callRpc } from "@/lib/rpc-client"
import {
  type TransferListFilters,
  type TransferPageDataResponse,
  TransferPageDataResponseSchema,
  type ViewMode,
} from "@/types/transfers-data-grid"

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 50

type TransferPageDataQueryOptions = Omit<
  UseQueryOptions<TransferPageDataResponse, Error>,
  "queryKey" | "queryFn"
> & {
  viewMode: ViewMode
  perColumnLimit?: number
  excludeCompleted?: boolean
  includeCounts?: boolean
}

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
    // Cache isolation fields - for query key scoping only
    _role = null,
    _diaBan = null,
    _tenantKey = null,
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
    // Include cache isolation fields in query key
    _role,
    _diaBan,
    _tenantKey,
  }
}

const fetchTransferPageData = async (
  filters: TransferListFilters = {},
  viewMode: ViewMode,
  perColumnLimit: number,
  excludeCompleted: boolean,
  includeCounts: boolean,
  signal?: AbortSignal,
): Promise<TransferPageDataResponse> => {
  const sanitized = sanitizeFilters(filters)
  const result = await callRpc({
    fn: "transfer_request_page_data",
    args: {
      p_q: sanitized.q,
      p_statuses: sanitized.statuses.length > 0 ? sanitized.statuses : null,
      p_types: sanitized.types.length > 0 ? sanitized.types : null,
      p_page: sanitized.page,
      p_page_size: sanitized.pageSize,
      p_don_vi: sanitized.facilityId,
      p_date_from: sanitized.dateFrom,
      p_date_to: sanitized.dateTo,
      p_assignee_ids: sanitized.assigneeIds.length > 0 ? sanitized.assigneeIds : null,
      p_view_mode: viewMode,
      p_per_column_limit: perColumnLimit,
      p_exclude_completed: excludeCompleted,
      p_include_counts: includeCounts,
    },
    signal,
  })

  return TransferPageDataResponseSchema.parse(result)
}

export const transferDataGridKeys = {
  all: ['transfers-data-grid'] as const,
  lists: () => [...transferDataGridKeys.all, 'list'] as const,
  list: (filters: TransferListFilters) =>
    [...transferDataGridKeys.lists(), sanitizeFilters(filters)] as const,
  counts: (filters: TransferListFilters) =>
    [...transferDataGridKeys.all, 'counts', sanitizeFilters(filters)] as const,
  pageData: (
    filters: TransferListFilters,
    options: {
      viewMode: ViewMode
      perColumnLimit: number
      excludeCompleted: boolean
      includeCounts: boolean
    },
  ) => [...transferDataGridKeys.all, 'page-data', sanitizeFilters(filters), options] as const,
}

export {
  useTransfersKanban,
  useTransferColumnInfiniteScroll,
  useMergedColumnData
} from './useTransfersKanban'

export const useTransferPageData = (
  filters: TransferListFilters = {},
  options: TransferPageDataQueryOptions,
) => {
  const {
    viewMode,
    perColumnLimit = 30,
    excludeCompleted = false,
    includeCounts = true,
    ...queryOptions
  } = options

  return useQuery<TransferPageDataResponse, Error>({
    queryKey: transferDataGridKeys.pageData(filters, {
      viewMode,
      perColumnLimit,
      excludeCompleted,
      includeCounts,
    }),
    queryFn: ({ signal }) =>
      fetchTransferPageData(filters, viewMode, perColumnLimit, excludeCompleted, includeCounts, signal),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    retry: 2,
    ...queryOptions,
  })
}
