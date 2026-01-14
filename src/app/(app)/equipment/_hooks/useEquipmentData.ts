"use client"

import * as React from "react"
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import { useFacilityFilter } from "@/hooks/useFacilityFilter"
import { useActiveUsageLogs } from "@/hooks/use-usage-logs"
import type { Equipment } from "../types"
import type { FilterBottomSheetData, FacilityOption, EquipmentListResponse } from "../types"

export interface UseEquipmentDataParams {
  isGlobal: boolean
  isRegionalLeader: boolean
  userRole: string
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
}

export interface UseEquipmentDataReturn {
  // Equipment data
  data: Equipment[]
  total: number
  isLoading: boolean
  isFetching: boolean

  // Filter options
  departments: string[]
  users: string[]
  locations: string[]
  statuses: string[]
  classifications: string[]
  filterData: FilterBottomSheetData

  // Facility filter
  showFacilityFilter: boolean
  facilities: FacilityOption[]
  selectedFacilityId: number | null
  setSelectedFacilityId: (id: number | null) => void
  activeFacility: FacilityOption | null
  isFacilitiesLoading: boolean

  // Tenant list (for global users)
  tenantOptions: { id: number; name: string; code: string }[]
  isTenantsLoading: boolean

  // Active usage logs
  activeUsageLogs: ReturnType<typeof useActiveUsageLogs>["data"]
  isLoadingActiveUsage: boolean

  // Cache invalidation
  invalidateEquipmentForCurrentTenant: () => void
}

export function useEquipmentData(params: UseEquipmentDataParams): UseEquipmentDataReturn {
  const {
    isGlobal,
    isRegionalLeader,
    userRole,
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
  } = params

  const queryClient = useQueryClient()

  // Facility filter hook
  const { showFacilityFilter, selectedFacilityId, setSelectedFacilityId } = useFacilityFilter({
    mode: "server",
    userRole: userRole || "user",
  })

  // Effective don_vi considering regional leader
  const effectiveSelectedDonVi = React.useMemo(() => {
    if (isRegionalLeader) return selectedFacilityId
    return selectedDonVi
  }, [isRegionalLeader, selectedFacilityId, selectedDonVi])

  // Active usage logs
  const { data: activeUsageLogs, isLoading: isLoadingActiveUsage } = useActiveUsageLogs({
    tenantId: currentTenantId,
    enabled: true,
    refetchInterval: 5 * 60 * 1000,
  })

  // Tenant list query (for global users)
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

  // Equipment list query
  const effectivePageSize = pagination.pageSize
  const effectivePage = pagination.pageIndex + 1

  const { data: equipmentRes, isLoading: isEqLoading, isFetching: isEqFetching } = useQuery<EquipmentListResponse>({
    queryKey: [
      "equipment_list_enhanced",
      {
        tenant: effectiveTenantKey,
        donVi: effectiveSelectedDonVi,
        page: pagination.pageIndex,
        size: pagination.pageSize,
        q: debouncedSearch || null,
        khoa_phong_array: selectedDepartments,
        nguoi_su_dung_array: selectedUsers,
        vi_tri_lap_dat_array: selectedLocations,
        tinh_trang_array: selectedStatuses,
        phan_loai_array: selectedClassifications,
        sort: sortParam,
      },
    ],
    enabled: shouldFetchEquipment,
    queryFn: async ({ signal }) => {
      const result = await callRpc<EquipmentListResponse>({
        fn: "equipment_list_enhanced",
        args: {
          p_q: debouncedSearch || null,
          p_sort: sortParam,
          p_page: effectivePage,
          p_page_size: effectivePageSize,
          p_don_vi: effectiveSelectedDonVi,
          p_khoa_phong_array: selectedDepartments.length > 0 ? selectedDepartments : null,
          p_nguoi_su_dung_array: selectedUsers.length > 0 ? selectedUsers : null,
          p_vi_tri_lap_dat_array: selectedLocations.length > 0 ? selectedLocations : null,
          p_tinh_trang_array: selectedStatuses.length > 0 ? selectedStatuses : null,
          p_phan_loai_array: selectedClassifications.length > 0 ? selectedClassifications : null,
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

  // Facilities query for regional leader
  const { data: facilitiesData, isLoading: isFacilitiesLoading } = useQuery<
    Array<{ id: number; name: string; code: string; equipment_count: number }>
  >({
    queryKey: ["facilities_with_equipment_count"],
    queryFn: async () => {
      const result = await callRpc<
        { id: number; name: string; code: string; equipment_count: number }[]
      >({ fn: "get_facilities_with_equipment_count", args: {} })
      return result || []
    },
    enabled: showFacilityFilter,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })

  const facilities = React.useMemo(() => {
    if (!showFacilityFilter || !facilitiesData) return []
    return facilitiesData.map((f) => ({
      id: f.id,
      name: f.name,
      count: f.equipment_count,
    }))
  }, [showFacilityFilter, facilitiesData])

  const activeFacility = React.useMemo(() => {
    if (selectedFacilityId == null) return null
    return facilities.find((facility) => facility.id === selectedFacilityId) ?? null
  }, [facilities, selectedFacilityId])

  const isFetching = isEqFetching || isFacilitiesLoading

  // Filter options queries
  const { data: departmentsData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ["departments_list_for_tenant", effectiveSelectedDonVi],
    queryFn: async ({ signal }) => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: "departments_list_for_tenant",
        args: { p_don_vi: effectiveSelectedDonVi },
        signal,
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const departments = React.useMemo(
    () => (departmentsData || []).map((x) => x.name).filter(Boolean),
    [departmentsData]
  )

  const { data: usersData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ["equipment_users_list_for_tenant", effectiveSelectedDonVi],
    queryFn: async ({ signal }) => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: "equipment_users_list_for_tenant",
        args: { p_don_vi: effectiveSelectedDonVi },
        signal,
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const users = React.useMemo(
    () => (usersData || []).map((x) => x.name).filter(Boolean),
    [usersData]
  )

  const { data: locationsData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ["equipment_locations_list_for_tenant", effectiveSelectedDonVi],
    queryFn: async ({ signal }) => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: "equipment_locations_list_for_tenant",
        args: { p_don_vi: effectiveSelectedDonVi },
        signal,
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const locations = React.useMemo(
    () => (locationsData || []).map((x) => x.name).filter(Boolean),
    [locationsData]
  )

  const { data: classificationsData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ["equipment_classifications_list_for_tenant", effectiveSelectedDonVi],
    queryFn: async ({ signal }) => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: "equipment_classifications_list_for_tenant",
        args: { p_don_vi: effectiveSelectedDonVi },
        signal,
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const classifications = React.useMemo(
    () => (classificationsData || []).map((x) => x.name).filter(Boolean),
    [classificationsData]
  )

  const { data: statusesData } = useQuery<{ name: string; count: number }[]>({
    queryKey: ["equipment_statuses_list_for_tenant", effectiveSelectedDonVi],
    queryFn: async ({ signal }) => {
      const result = await callRpc<{ name: string; count: number }[]>({
        fn: "equipment_statuses_list_for_tenant",
        args: { p_don_vi: effectiveSelectedDonVi },
        signal,
      })
      return result || []
    },
    enabled: shouldFetchEquipment,
    staleTime: 300_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const statuses = React.useMemo(
    () => (statusesData || []).map((x) => x.name).filter(Boolean),
    [statusesData]
  )

  // Filter data for bottom sheet
  const filterData: FilterBottomSheetData = React.useMemo(
    () => ({
      status: (statusesData || []).map((x) => ({ id: x.name, label: x.name, count: x.count })),
      department: (departmentsData || []).map((x) => ({ id: x.name, label: x.name, count: x.count })),
      location: (locationsData || []).map((x) => ({ id: x.name, label: x.name, count: x.count })),
      user: (usersData || []).map((x) => ({ id: x.name, label: x.name, count: x.count })),
      classification: (classificationsData || []).map((x) => ({ id: x.name, label: x.name, count: x.count })),
    }),
    [statusesData, departmentsData, locationsData, usersData, classificationsData]
  )

  // Cache invalidation
  const invalidateEquipmentForCurrentTenant = React.useCallback(() => {
    if (isGlobal && !shouldFetchEquipment) return
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey
        if (!Array.isArray(key)) return false
        if (key[0] !== "equipment_list_enhanced") return false
        const queryParams = key[1] as Record<string, unknown>
        return queryParams?.tenant === effectiveTenantKey
      },
      refetchType: "active",
    })
  }, [queryClient, effectiveTenantKey, isGlobal, shouldFetchEquipment])

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
      isLoading,
      isFetching,
      departments,
      users,
      locations,
      statuses,
      classifications,
      filterData,
      showFacilityFilter,
      facilities,
      selectedFacilityId,
      setSelectedFacilityId,
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
      isLoading,
      isFetching,
      departments,
      users,
      locations,
      statuses,
      classifications,
      filterData,
      showFacilityFilter,
      facilities,
      selectedFacilityId,
      setSelectedFacilityId,
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
