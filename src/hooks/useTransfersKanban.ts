/**
 * TanStack Query Hooks for Transfer Kanban
 * Related: Day 2 - Server-Side Data Fetching
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { 
  TransferKanbanFilters, 
  TransferKanbanResponse,
  TransferCountsResponse 
} from '@/types/transfer-kanban'

// ============================================================================
// Query Key Factory
// ============================================================================

export const transferKanbanKeys = {
  all: ['transfers', 'kanban'] as const,
  lists: () => [...transferKanbanKeys.all, 'list'] as const,
  list: (filters: TransferKanbanFilters) => [...transferKanbanKeys.lists(), filters] as const,
  counts: (facilityIds?: number[]) => [...transferKanbanKeys.all, 'counts', facilityIds] as const,
}

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchTransfersKanban(
  filters: TransferKanbanFilters
): Promise<TransferKanbanResponse> {
  const params = new URLSearchParams()
  
  if (filters.facilityIds && filters.facilityIds.length > 0) {
    params.set('facilityIds', filters.facilityIds.join(','))
  }
  
  if (filters.assigneeIds && filters.assigneeIds.length > 0) {
    params.set('assigneeIds', filters.assigneeIds.join(','))
  }
  
  if (filters.types && filters.types.length > 0) {
    params.set('types', filters.types.join(','))
  }
  
  if (filters.statuses && filters.statuses.length > 0) {
    params.set('statuses', filters.statuses.join(','))
  }
  
  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom)
  }
  
  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo)
  }
  
  if (filters.searchText && filters.searchText.trim()) {
    params.set('searchText', filters.searchText.trim())
  }
  
  if (filters.limit) {
    params.set('limit', filters.limit.toString())
  }
  
  if (filters.cursor) {
    params.set('cursor', filters.cursor.toString())
  }

  const response = await fetch(`/api/transfers/kanban?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch transfers')
  }

  return response.json()
}

async function fetchTransferCounts(
  facilityIds?: number[]
): Promise<TransferCountsResponse> {
  const params = new URLSearchParams()
  
  if (facilityIds && facilityIds.length > 0) {
    params.set('facilityIds', facilityIds.join(','))
  }

  const response = await fetch(`/api/transfers/counts?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch counts')
  }

  return response.json()
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Fetch transfers for Kanban board with server-side filtering and pagination
 * 
 * @param filters - Filter criteria (facility, assignee, type, status, dates, search)
 * @param options - TanStack Query options
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useTransfersKanban({
 *   facilityIds: [1, 2],
 *   statuses: ['cho_duyet', 'da_duyet'],
 *   searchText: 'máy xét nghiệm',
 * })
 * ```
 */
export function useTransfersKanban(
  filters: TransferKanbanFilters = {},
  options?: Omit<
    UseQueryOptions<TransferKanbanResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<TransferKanbanResponse, Error>({
    queryKey: transferKanbanKeys.list(filters),
    queryFn: () => fetchTransfersKanban(filters),
    staleTime: 30_000, // 30 seconds - data considered fresh
    gcTime: 5 * 60_000, // 5 minutes - garbage collection time
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  })
}

/**
 * Fetch transfer counts by status for Kanban column headers
 * 
 * @param facilityIds - Optional facility IDs to filter counts
 * @param options - TanStack Query options
 * 
 * @example
 * ```tsx
 * const { data: counts, isLoading } = useTransferCounts([1, 2])
 * // counts.columnCounts.cho_duyet => 5
 * // counts.columnCounts.da_duyet => 12
 * ```
 */
export function useTransferCounts(
  facilityIds?: number[],
  options?: Omit<
    UseQueryOptions<TransferCountsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<TransferCountsResponse, Error>({
    queryKey: transferKanbanKeys.counts(facilityIds),
    queryFn: () => fetchTransferCounts(facilityIds),
    staleTime: 60_000, // 1 minute - counts change less frequently
    gcTime: 10 * 60_000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
    ...options,
  })
}

// ============================================================================
// Helper Hooks for Common Use Cases
// ============================================================================

/**
 * Fetch transfers for a specific status column
 */
export function useTransfersByStatus(
  status: 'cho_duyet' | 'da_duyet' | 'dang_luan_chuyen' | 'da_ban_giao' | 'hoan_thanh',
  filters: Omit<TransferKanbanFilters, 'statuses'> = {}
) {
  const query = useTransfersKanban({
    ...filters,
    statuses: [status],
  })

  return {
    ...query,
    data: query.data?.transfers[status] || [],
  }
}

/**
 * Fetch transfers for current user's facility only
 */
export function useMyFacilityTransfers(
  facilityId: number,
  filters: Omit<TransferKanbanFilters, 'facilityIds'> = {}
) {
  return useTransfersKanban({
    ...filters,
    facilityIds: [facilityId],
  })
}
