import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import type {
  TransferListFilters,
  TransferKanbanResponse,
  TransferStatus,
  TransferListItem,
} from '@/types/transfers-data-grid'
import { TransferKanbanResponseSchema, TransferTableModeResponseSchema } from '@/types/transfers-data-grid'

export const transferKanbanKeys = {
  all: ['transfers-kanban'] as const,
  filtered: (filters: TransferListFilters) =>
    [...transferKanbanKeys.all, filters] as const,
  column: (filters: TransferListFilters, status: TransferStatus) =>
    [...transferKanbanKeys.filtered(filters), status] as const,
}

interface UseTransfersKanbanOptions {
  excludeCompleted?: boolean
  perColumnLimit?: number
  /**
   * For global/regional users who can access multiple tenants:
   * Require explicit tenant selection before fetching data.
   * This prevents loading huge datasets across all tenants.
   */
  userRole?: 'global' | 'regional_leader' | 'to_qltb' | 'technician' | 'user'
}

/**
 * Initial kanban load - fetches first page of each column (30 items each)
 *
 * IMPORTANT: For global/regional_leader users, data is NOT fetched until
 * a specific tenant (facilityId) is selected. This prevents performance issues
 * when user has access to 100+ tenants with 10k+ transfers each.
 */
export function useTransfersKanban(
  filters: TransferListFilters,
  options: UseTransfersKanbanOptions = {}
) {
  const { excludeCompleted = true, perColumnLimit = 30, userRole } = options

  // Multi-tenant users must select a specific tenant before fetching
  const isMultiTenantUser = userRole === 'global' || userRole === 'regional_leader'
  const hasTenantSelected = !!filters.facilityId
  const shouldFetch = isMultiTenantUser ? hasTenantSelected : true

  return useQuery({
    queryKey: transferKanbanKeys.filtered(filters),
    queryFn: async (): Promise<TransferKanbanResponse> => {
      const result = await callRpc({
        fn: 'transfer_request_list',
        args: {
          p_q: filters.q,
          p_statuses: null, // Kanban loads all statuses
          p_types: filters.types,
          p_don_vi: filters.facilityId,
          p_date_from: filters.dateFrom,
          p_date_to: filters.dateTo,
          p_assignee_ids: filters.assigneeIds,
          p_view_mode: 'kanban',
          p_per_column_limit: perColumnLimit,
          p_exclude_completed: excludeCompleted,
        },
      })

      // Runtime validation with Zod
      return TransferKanbanResponseSchema.parse(result)
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Poll every 60 seconds
    // Require types AND (single-tenant user OR multi-tenant user with facility selected)
    enabled: !!filters.types && filters.types.length > 0 && shouldFetch,
  })
}

type ColumnPageData = { data: TransferListItem[]; hasMore: boolean }

/**
 * Per-column infinite scroll - loads additional pages for a specific status column
 * Uses table mode with single status filter for pagination
 * IMPORTANT: Starts at page 2 to avoid duplicating initial kanban data (page 1)
 *
 * NOTE: Uses offset pagination for MVP. Known issue: "pagination drift"
 * - If new items arrive during 60s polling, offset shifts
 * - User scrolling down may miss items or see duplicates at page boundary
 * - FUTURE: Implement cursor-based pagination using created_at or id
 */
export function useTransferColumnInfiniteScroll(
  filters: TransferListFilters,
  status: TransferStatus,
  enabled: boolean = false // Disabled by default, enable when user scrolls near bottom
) {
  return useInfiniteQuery({
    queryKey: transferKanbanKeys.column(filters, status),
    queryFn: async ({ pageParam }): Promise<ColumnPageData> => {
      const result = await callRpc({
        fn: 'transfer_request_list',
        args: {
          p_q: filters.q,
          p_statuses: [status], // Single status for this column
          p_types: filters.types,
          p_don_vi: filters.facilityId,
          p_date_from: filters.dateFrom,
          p_date_to: filters.dateTo,
          p_assignee_ids: filters.assigneeIds,
          p_view_mode: 'table', // Use table mode for pagination
          p_page: pageParam,
          p_page_size: 30,
        },
      })

      // Runtime validation with Zod
      const validated = TransferTableModeResponseSchema.parse(result)

      return {
        data: validated.data,
        hasMore: validated.total > pageParam * 30,
      }
    },
    // TanStack Query v5: initialPageParam is required
    initialPageParam: 2, // Start at page 2 - page 1 data comes from initial kanban load
    getNextPageParam: (lastPage, allPages) => {
      // Pages start at 2 (page 1 is from initial kanban load)
      return lastPage.hasMore ? allPages.length + 2 : undefined
    },
    staleTime: 30000,
    enabled: enabled && !!filters.types && filters.types.length > 0,
  })
}

/**
 * Merge initial kanban data with infinite scroll pages for a column
 */
export function useMergedColumnData(
  initialData: TransferListItem[] | undefined,
  infiniteData: { data: TransferListItem[], hasMore: boolean }[] | undefined,
  isInitialLoading: boolean
): { tasks: TransferListItem[], hasMore: boolean, isLoadingMore: boolean } {
  if (isInitialLoading) {
    return { tasks: [], hasMore: false, isLoadingMore: true }
  }

  const tasks = initialData || []

  // If infinite scroll has started, append its pages
  if (infiniteData && infiniteData.length > 0) {
    const additionalTasks = infiniteData.flatMap(page => page.data)
    const merged = [...tasks, ...additionalTasks]
    const lastPage = infiniteData[infiniteData.length - 1]

    return {
      tasks: merged,
      hasMore: lastPage?.hasMore || false,
      isLoadingMore: false,
    }
  }

  // Use initial data's hasMore flag (from initial kanban load)
  return {
    tasks,
    hasMore: tasks.length >= 30, // Assume more if we got full page
    isLoadingMore: false,
  }
}

export function useInvalidateTransfersKanban() {
  const queryClient = useQueryClient()

  return (affectedStatuses?: string[]) => {
    if (affectedStatuses && affectedStatuses.length > 0) {
      // Invalidate main kanban query + affected column queries
      queryClient.invalidateQueries({
        queryKey: transferKanbanKeys.all,
      })
    } else {
      // Invalidate all kanban queries
      queryClient.invalidateQueries({
        queryKey: transferKanbanKeys.all,
      })
    }
  }
}
