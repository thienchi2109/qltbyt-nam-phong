"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import { useServerPagination } from "@/hooks/useServerPagination"
import type { RepairRequestWithEquipment } from "../types"
import type { UiFilters as UiFiltersPrefs } from "@/lib/rr-prefs"

// ── Types ────────────────────────────────────────────────────────

const STATUSES = ['Chờ xử lý', 'Đã duyệt', 'Hoàn thành', 'Không HT'] as const
type Status = typeof STATUSES[number]

export interface UseRepairRequestsDataOptions {
  debouncedSearch: string
  uiFilters: UiFiltersPrefs
  selectedFacilityId: number | null | undefined
  effectiveTenantKey: string | number | null
  userRole: string | undefined
  userDiaBanId: string | number | null | undefined
  shouldFetchData: boolean
  hasUser: boolean
}

export interface UseRepairRequestsDataReturn {
  requests: RepairRequestWithEquipment[]
  isLoading: boolean
  isFetching: boolean
  refetchRequests: () => void
  statusCounts: Record<Status, number> | undefined
  statusCountsLoading: boolean
  totalRequests: number
  repairPagination: ReturnType<typeof useServerPagination>
}

// ── Hook ─────────────────────────────────────────────────────────

export function useRepairRequestsData(
  opts: UseRepairRequestsDataOptions
): UseRepairRequestsDataReturn {
  const {
    debouncedSearch,
    uiFilters,
    selectedFacilityId,
    effectiveTenantKey,
    userRole,
    userDiaBanId,
    shouldFetchData,
    hasUser,
  } = opts

  // Pagination with auto-reset on filter changes
  const paginationResetKey = `${debouncedSearch}|${selectedFacilityId}|${JSON.stringify(uiFilters.dateRange)}|${uiFilters.status.join(',')}`
  const [totalRequests, setTotalRequests] = React.useState(0)
  const repairPagination = useServerPagination({
    totalCount: totalRequests,
    resetKey: paginationResetKey,
  })

  // Main list query
  const {
    data: repairRequestsRes,
    isLoading,
    isFetching,
    refetch: refetchRequests,
  } = useQuery<{
    data: RepairRequestWithEquipment[]
    total: number
    page: number
    pageSize: number
  }>({
    queryKey: ['repair_request_list', {
      tenant: effectiveTenantKey,
      role: userRole,
      diaBan: userDiaBanId,
      donVi: selectedFacilityId,
      statuses: uiFilters.status || [],
      q: debouncedSearch || null,
      page: repairPagination.page,
      pageSize: repairPagination.pageSize,
      dateFrom: uiFilters.dateRange?.from || null,
      dateTo: uiFilters.dateRange?.to || null,
    }],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      return callRpc<{
        data: RepairRequestWithEquipment[]
        total: number
        page: number
        pageSize: number
      }>({
        fn: 'repair_request_list',
        args: {
          p_q: debouncedSearch || null,
          p_status: null,
          p_page: repairPagination.page,
          p_page_size: repairPagination.pageSize,
          p_don_vi: selectedFacilityId,
          p_date_from: uiFilters.dateRange?.from || null,
          p_date_to: uiFilters.dateRange?.to || null,
          p_statuses: uiFilters.status?.length ? uiFilters.status : null,
        },
        signal,
      })
    },
    enabled: hasUser && shouldFetchData,
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  const requests = repairRequestsRes?.data ?? []

  // Sync totalRequests from query result
  React.useEffect(() => {
    const serverTotal = repairRequestsRes?.total ?? 0
    setTotalRequests(serverTotal)
  }, [repairRequestsRes?.total])

  // Status counts query (always fires for authenticated users)
  const { data: statusCounts, isLoading: statusCountsLoading } = useQuery<
    Record<Status, number>
  >({
    queryKey: ['repair_request_status_counts', {
      tenant: effectiveTenantKey,
      role: userRole,
      diaBan: userDiaBanId,
      facilityId: selectedFacilityId ?? null,
      search: debouncedSearch,
      dateFrom: uiFilters.dateRange?.from || null,
      dateTo: uiFilters.dateRange?.to || null,
    }],
    queryFn: async () => {
      const res = await callRpc<Record<Status, number>>({
        fn: 'repair_request_status_counts',
        args: {
          p_q: debouncedSearch || null,
          p_don_vi: selectedFacilityId ?? null,
          p_date_from: uiFilters.dateRange?.from || null,
          p_date_to: uiFilters.dateRange?.to || null,
        },
      })
      return res as Record<Status, number>
    },
    staleTime: 30_000,
    enabled: hasUser,
  })

  return {
    requests,
    isLoading,
    isFetching,
    refetchRequests,
    statusCounts,
    statusCountsLoading,
    totalRequests,
    repairPagination,
  }
}
