"use client"

import * as React from "react"
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import { useActiveUsageLogs } from "@/hooks/use-usage-logs"
import { buildEquipmentDataQueryParams } from "./EquipmentDataQueryParams"
import { useEquipmentFilterBuckets } from "./useEquipmentFilterBuckets"
import type { Equipment } from "../types"
import type {
  EquipmentDepartmentDistributionItem,
  EquipmentListResponse,
  FacilityOption,
  FilterBottomSheetData,
} from "../types"

export interface UseEquipmentDataParams {
  isGlobal: boolean
  isRegionalLeader: boolean
  userRole: string
  userDiaBanId?: number | null
  shouldFetchEquipment: boolean
  effectiveTenantKey: string
  selectedDonVi: number | null
  currentTenantId: number | null
  debouncedSearch: string
  sortParam: string
  pagination: { pageIndex: number; pageSize: number }
  selectedDepartments: string[]
  selectedUsers: string[]
  selectedLocations: string[]
  selectedStatuses: string[]
  selectedClassifications: string[]
  selectedFundingSources: string[]
  // From TenantSelectionContext via useEquipmentAuth
  selectedFacilityId: number | null | undefined
  showSelector: boolean
  facilities: { id: number; name: string; code?: string; count?: number }[]
  isFacilitiesLoading: boolean
}

export interface UseEquipmentDataReturn {
  // Equipment data
  data: Equipment[]
  total: number
  departmentDistribution: EquipmentDepartmentDistributionItem[]
  isLoading: boolean
  isFetching: boolean

  // Computed fetch flag (for UI display)
  shouldFetchData: boolean

  // Filter options
  departments: string[]
  users: string[]
  locations: string[]
  statuses: string[]
  classifications: string[]
  fundingSources: string[]
  filterData: FilterBottomSheetData

  // Facility filter (from context via auth hook)
  showFacilityFilter: boolean
  facilities: FacilityOption[]
  selectedFacilityId: number | null | undefined
  activeFacility: FacilityOption | null
  isFacilitiesLoading: boolean

  // Tenant list (for global users - deprecated, kept for compatibility)
  tenantOptions: { id: number; name: string; code: string }[]
  isTenantsLoading: boolean

  // Active usage logs
  activeUsageLogs: ReturnType<typeof useActiveUsageLogs>["data"]
  isLoadingActiveUsage: boolean

  // Cache invalidation
  invalidateEquipmentForCurrentTenant: () => void
}

/** Loads equipment table data, filter buckets, and department distribution for the current scope. */
export function useEquipmentData(params: UseEquipmentDataParams): UseEquipmentDataReturn {
  const {
    isGlobal,
    isRegionalLeader,
    userRole,
    userDiaBanId,
    shouldFetchEquipment,
    effectiveTenantKey,
    selectedDonVi,
    currentTenantId,
    debouncedSearch,
    sortParam,
    pagination,
    selectedDepartments,
    selectedUsers,
    selectedLocations,
    selectedStatuses,
    selectedClassifications,
    selectedFundingSources,
    // From context
    selectedFacilityId,
    showSelector,
    facilities: contextFacilities,
    isFacilitiesLoading,
  } = params

  const queryClient = useQueryClient()

  // Computed: should we fetch data based on tenant/facility selection
  // For regional_leader, undefined means facility context is still hydrating.
  // Null is an explicit all-allowed-facilities scope for regional deep-links.
  const shouldFetchData = React.useMemo(() => {
    if (!shouldFetchEquipment) return false
    if (isRegionalLeader && selectedFacilityId === undefined) return false
    return true
  }, [shouldFetchEquipment, isRegionalLeader, selectedFacilityId])

  // Effective don_vi considering regional leader
  const effectiveSelectedDonVi = React.useMemo(() => {
    if (isRegionalLeader) {
      // Regional leaders always use selectedFacilityId
      return selectedFacilityId !== undefined && selectedFacilityId !== null
        ? selectedFacilityId
        : null
    }
    return selectedDonVi
  }, [isRegionalLeader, selectedFacilityId, selectedDonVi])

  const { queryKeyParams, rpcArgs } = buildEquipmentDataQueryParams({
    effectiveTenantKey,
    userRole,
    userDiaBanId,
    effectiveSelectedDonVi,
    debouncedSearch,
    selectedDepartments,
    selectedUsers,
    selectedLocations,
    selectedStatuses,
    selectedClassifications,
    selectedFundingSources,
  })

  // Active usage logs
  const { data: activeUsageLogs, isLoading: isLoadingActiveUsage } = useActiveUsageLogs({
    tenantId: currentTenantId,
    enabled: true,
    refetchInterval: 5 * 60 * 1000,
  })

  // Tenant list query (for global users - kept for backward compatibility with tenant change toasts)
  const { data: tenantList, isLoading: isTenantsLoading } = useQuery<
    { id: number; name: string; code: string }[]
  >({
    queryKey: ["tenant_list"],
    queryFn: async () => {
      const list = await callRpc<{ id: number; name: string; code: string }[]>({
        fn: "tenant_list",
        args: {},
      })
      return (list || []).map((t) => ({ id: t.id, name: t.name, code: t.code }))
    },
    enabled: isGlobal,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const tenantOptions = (tenantList ?? []) as { id: number; name: string; code: string }[]

  // Equipment list query - updated with role/diaBan in query key
  const effectivePageSize = pagination.pageSize
  const effectivePage = pagination.pageIndex + 1

  const {
    data: equipmentRes,
    isLoading: isEqLoading,
    isFetching: isEqFetching,
  } = useQuery<EquipmentListResponse>({
    queryKey: [
      "equipment_list_enhanced",
      {
        ...queryKeyParams,
        page: pagination.pageIndex,
        size: pagination.pageSize,
        sort: sortParam,
        liquidationLast: true,
      },
    ],
    enabled: shouldFetchData,
    queryFn: async ({ signal }) => {
      const result = await callRpc<EquipmentListResponse>({
        fn: "equipment_list_enhanced",
        args: {
          ...rpcArgs,
          p_sort: sortParam,
          p_page: effectivePage,
          p_page_size: effectivePageSize,
          p_liquidation_last: true,
        },
        signal,
      })
      return result
    },
    placeholderData: keepPreviousData,
    staleTime: 120_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })

  const data = (equipmentRes?.data ?? []) as Equipment[]
  const total = equipmentRes?.total ?? 0
  const isLoading = isEqLoading

  const { data: departmentDistributionData } = useQuery<EquipmentDepartmentDistributionItem[]>({
    queryKey: [
      "equipment_department_distribution",
      {
        ...queryKeyParams,
      },
    ],
    queryFn: async ({ signal }) => {
      const result = await callRpc<EquipmentDepartmentDistributionItem[]>({
        fn: "equipment_department_distribution",
        args: {
          ...rpcArgs,
        },
        signal,
      })
      return result ?? []
    },
    enabled: shouldFetchData,
    staleTime: 120_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })

  const departmentDistribution = departmentDistributionData ?? []

  // Map context facilities to FacilityOption format
  const facilities: FacilityOption[] = React.useMemo(() => {
    if (!showSelector || !contextFacilities) return []
    return contextFacilities.map((f) => ({
      id: f.id,
      name: f.name,
      count: f.count ?? 0,
    }))
  }, [showSelector, contextFacilities])

  const activeFacility = React.useMemo(() => {
    if (selectedFacilityId == null || selectedFacilityId === undefined) return null
    return facilities.find((facility) => facility.id === selectedFacilityId) ?? null
  }, [facilities, selectedFacilityId])

  const isFetching = isEqFetching

  const { departments, users, locations, statuses, classifications, fundingSources, filterData } =
    useEquipmentFilterBuckets({
      shouldFetchData,
      effectiveTenantKey,
      userRole,
      userDiaBanId,
      effectiveSelectedDonVi,
      debouncedSearch,
      selectedDepartments,
      selectedUsers,
      selectedLocations,
      selectedStatuses,
      selectedClassifications,
      selectedFundingSources,
    })

  // Cache invalidation - check all cache isolation fields
  const invalidateEquipmentForCurrentTenant = React.useCallback(() => {
    if (isGlobal && !shouldFetchData) return
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey
        if (!Array.isArray(key)) return false
        if (
          key[0] !== "equipment_list_enhanced" &&
          key[0] !== "equipment_department_distribution" &&
          key[0] !== "equipment_filter_buckets"
        )
          return false
        const queryParams = key[1] as Record<string, unknown>
        return (
          queryParams?.tenant === effectiveTenantKey &&
          queryParams?.role === userRole &&
          queryParams?.diaBan === userDiaBanId
        )
      },
      refetchType: "active",
    })
  }, [queryClient, effectiveTenantKey, userRole, userDiaBanId, isGlobal, shouldFetchData])

  // Cache invalidation event listeners
  React.useEffect(() => {
    const handleCacheInvalidation = () => {
      invalidateEquipmentForCurrentTenant()
    }

    window.addEventListener("equipment-cache-invalidated", handleCacheInvalidation)
    window.addEventListener("tenant-switched", handleCacheInvalidation)

    return () => {
      window.removeEventListener("equipment-cache-invalidated", handleCacheInvalidation)
      window.removeEventListener("tenant-switched", handleCacheInvalidation)
    }
  }, [invalidateEquipmentForCurrentTenant])

  return React.useMemo(
    () => ({
      data,
      total,
      departmentDistribution,
      isLoading,
      isFetching,
      shouldFetchData,
      departments,
      users,
      locations,
      statuses,
      classifications,
      fundingSources,
      filterData,
      showFacilityFilter: showSelector,
      facilities,
      selectedFacilityId,
      activeFacility,
      isFacilitiesLoading,
      tenantOptions,
      isTenantsLoading,
      activeUsageLogs,
      isLoadingActiveUsage,
      invalidateEquipmentForCurrentTenant,
    }),
    [
      data,
      total,
      departmentDistribution,
      isLoading,
      isFetching,
      shouldFetchData,
      departments,
      users,
      locations,
      statuses,
      classifications,
      fundingSources,
      filterData,
      showSelector,
      facilities,
      selectedFacilityId,
      activeFacility,
      isFacilitiesLoading,
      tenantOptions,
      isTenantsLoading,
      activeUsageLogs,
      isLoadingActiveUsage,
      invalidateEquipmentForCurrentTenant,
    ]
  )
}
