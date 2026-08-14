"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { getNextPaginationTotalCount } from "../_components/manual-mapping/DeviceQuotaManualMappingPagination"
import type {
  FilterOptions,
  UnassignedEquipment,
  UnassignedEquipmentRow,
} from "../_components/manual-mapping/DeviceQuotaManualMappingTypes"
import { useServerPagination } from "@/hooks/useServerPagination"
import { callRpc } from "@/lib/rpc-client"
import { useUnassignedEquipmentFilters } from "./useUnassignedEquipmentFilters"

interface UseDeviceQuotaManualMappingEquipmentOptions {
  donViId: number | null
}

const EMPTY_FILTER_OPTIONS: FilterOptions = {
  departments: [],
  users: [],
  locations: [],
  fundingSources: [],
}

/**
 * Owns the route-agnostic unassigned-equipment filters, pagination, queries,
 * and page-scoped selection used by manual device-quota mapping surfaces.
 */
export function useDeviceQuotaManualMappingEquipment({
  donViId,
}: UseDeviceQuotaManualMappingEquipmentOptions) {
  const filters = useUnassignedEquipmentFilters()
  const paginationResetKey = `${donViId ?? "none"}|${filters.debouncedSearch}|${filters.selectedDepartments.join(",")}|${filters.selectedUsers.join(",")}|${filters.selectedLocations.join(",")}|${filters.selectedFundingSources.join(",")}`
  const [selectedEquipmentIds, setSelectedEquipmentIds] = React.useState<Set<number>>(new Set())
  const [paginationTotalCount, setPaginationTotalCount] = React.useState(0)
  const pagination = useServerPagination({
    totalCount: paginationTotalCount,
    initialPageSize: 20,
    pageSizeStorageKey: "datatable:device-quota-unassigned:page-size",
    resetKey: paginationResetKey,
  })

  const { data: filterOptionsData } = useQuery({
    queryKey: ["dinh_muc_thiet_bi_unassigned_filter_options", { donViId }],
    queryFn: async () => {
      const result = await callRpc<FilterOptions>({
        fn: "dinh_muc_thiet_bi_unassigned_filter_options",
        args: { p_don_vi: donViId },
      })
      return result || EMPTY_FILTER_OPTIONS
    },
    enabled: !!donViId,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  })
  const filterOptions = filterOptionsData || EMPTY_FILTER_OPTIONS

  const {
    data: equipmentRawData,
    isLoading,
    refetch: refetchEquipment,
  } = useQuery({
    queryKey: [
      "dinh_muc_thiet_bi_unassigned",
      {
        donViId,
        search: filters.debouncedSearch,
        departments: filters.selectedDepartments,
        users: filters.selectedUsers,
        locations: filters.selectedLocations,
        fundingSources: filters.selectedFundingSources,
        page: pagination.page,
        pageSize: pagination.pageSize,
      },
    ],
    queryFn: async () => {
      const result = await callRpc<UnassignedEquipmentRow[]>({
        fn: "dinh_muc_thiet_bi_unassigned",
        args: {
          p_don_vi: donViId,
          p_search: filters.debouncedSearch || null,
          p_limit: pagination.pageSize,
          p_offset: (pagination.page - 1) * pagination.pageSize,
          p_khoa_phong_array:
            filters.selectedDepartments.length > 0 ? filters.selectedDepartments : null,
          p_nguoi_su_dung_array: filters.selectedUsers.length > 0 ? filters.selectedUsers : null,
          p_vi_tri_lap_dat_array:
            filters.selectedLocations.length > 0 ? filters.selectedLocations : null,
          p_nguon_kinh_phi_array:
            filters.selectedFundingSources.length > 0 ? filters.selectedFundingSources : null,
        },
      })
      return result || []
    },
    enabled: !!donViId,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  })

  const nextPaginationTotalCount = React.useMemo(
    () =>
      getNextPaginationTotalCount({
        donViId,
        equipmentRawData,
        page: pagination.page,
      }),
    [donViId, equipmentRawData, pagination.page]
  )

  React.useEffect(() => {
    if (nextPaginationTotalCount === null) return
    setPaginationTotalCount(nextPaginationTotalCount)
  }, [nextPaginationTotalCount])

  React.useEffect(() => {
    if (!donViId || !equipmentRawData || equipmentRawData.length > 0 || pagination.page === 1) {
      return
    }
    pagination.resetToFirstPage()
  }, [donViId, equipmentRawData, pagination.page, pagination.resetToFirstPage])

  const unassignedEquipment: UnassignedEquipment[] = React.useMemo(
    () => (equipmentRawData || []).map(({ total_count: _, ...rest }) => rest),
    [equipmentRawData]
  )

  const toggleEquipmentSelection = React.useCallback((id: number) => {
    setSelectedEquipmentIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAllEquipment = React.useCallback(() => {
    setSelectedEquipmentIds((previous) => {
      const next = new Set(previous)
      for (const item of unassignedEquipment) next.add(item.id)
      return next
    })
  }, [unassignedEquipment])

  const deselectPageEquipment = React.useCallback(() => {
    const pageIds = new Set(unassignedEquipment.map((item) => item.id))
    setSelectedEquipmentIds((previous) => {
      const next = new Set(previous)
      for (const id of pageIds) next.delete(id)
      return next
    })
  }, [unassignedEquipment])

  const clearEquipmentSelection = React.useCallback(() => {
    setSelectedEquipmentIds(new Set())
  }, [])

  const refetch = React.useCallback(() => {
    void refetchEquipment()
  }, [refetchEquipment])

  return React.useMemo(
    () => ({
      unassignedEquipment,
      totalEquipmentCount: paginationTotalCount,
      selectedEquipmentIds,
      toggleEquipmentSelection,
      selectAllEquipment,
      deselectPageEquipment,
      clearEquipmentSelection,
      filters,
      filterOptions,
      pagination,
      isLoading,
      refetch,
    }),
    [
      unassignedEquipment,
      paginationTotalCount,
      selectedEquipmentIds,
      toggleEquipmentSelection,
      selectAllEquipment,
      deselectPageEquipment,
      clearEquipmentSelection,
      filters,
      filterOptions,
      pagination,
      isLoading,
      refetch,
    ]
  )
}
