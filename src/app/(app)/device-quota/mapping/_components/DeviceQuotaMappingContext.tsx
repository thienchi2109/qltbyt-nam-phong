"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { useServerPagination } from "@/hooks/useServerPagination"
import { useUnassignedEquipmentFilters } from "../_hooks/useUnassignedEquipmentFilters"
import { filterCategoriesWithAncestorsAndDescendants } from "../../categories/_utils/filterCategoriesWithAncestorsAndDescendants"
import { useLinkEquipmentMutation } from "./DeviceQuotaMappingMutations"
import { getNextPaginationTotalCount } from "./DeviceQuotaMappingPagination"
import type {
  AuthUser,
  Category,
  DeviceQuotaMappingContextValue,
  FilterOptions,
  UnassignedEquipment,
  UnassignedEquipmentRow,
} from "./DeviceQuotaMappingTypes"
export type { Category, DeviceQuotaMappingContextValue } from "./DeviceQuotaMappingTypes"

// ============================================
function useFilteredCategories(allCategories: Category[], searchTerm: string): Category[] {
  return React.useMemo(
    () => filterCategoriesWithAncestorsAndDescendants(allCategories, searchTerm),
    [allCategories, searchTerm]
  )
}

const DeviceQuotaMappingContext = React.createContext<DeviceQuotaMappingContextValue | null>(null)

interface DeviceQuotaMappingProviderProps {
  children: React.ReactNode
}

export function DeviceQuotaMappingProvider({ children }: DeviceQuotaMappingProviderProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user as AuthUser | null
  const { selectedFacilityId, showSelector } = useTenantSelection()

  const userDonViId = user?.don_vi ? parseInt(user.don_vi, 10) : null
  const isFacilitySelected = !showSelector || typeof selectedFacilityId === "number"
  const donViId = showSelector
    ? (typeof selectedFacilityId === "number" ? selectedFacilityId : null)
    : userDonViId

  // Equipment filters + search
  const filters = useUnassignedEquipmentFilters()

  // Build resetKey so pagination resets to page 1 on tenant + any filter/search change.
  const paginationResetKey = `${donViId ?? 'none'}|${filters.debouncedSearch}|${filters.selectedDepartments.join(',')}|${filters.selectedUsers.join(',')}|${filters.selectedLocations.join(',')}|${filters.selectedFundingSources.join(',')}`

  // Selection state
  const [selectedEquipmentIds, setSelectedEquipmentIds] = React.useState<Set<number>>(new Set())
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number | null>(null)
  const [categorySearchTerm, setCategorySearchTerm] = React.useState("")

  // Fetch filter options (distinct values for faceted filters)
  const { data: filterOptionsData } = useQuery({
    queryKey: ['dinh_muc_thiet_bi_unassigned_filter_options', { donViId }],
    queryFn: async () => {
      const result = await callRpc<FilterOptions>({
        fn: 'dinh_muc_thiet_bi_unassigned_filter_options',
        args: { p_don_vi: donViId },
      })
      return result || { departments: [], users: [], locations: [], fundingSources: [] }
    },
    enabled: !!donViId,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  })

  const filterOptions: FilterOptions = filterOptionsData || {
    departments: [], users: [], locations: [], fundingSources: [],
  }

  // Pagination state — initialized with totalCount=0, updated reactively
  // Must be defined BEFORE the query so queryFn can read page/pageSize
  const [paginationTotalCount, setPaginationTotalCount] = React.useState(0)
  const paginationState = useServerPagination({
    totalCount: paginationTotalCount,
    initialPageSize: 20,
    pageSizeStorageKey: "datatable:device-quota-unassigned:page-size",
    resetKey: paginationResetKey,
  })

  // Fetch unassigned equipment (with filters + pagination)
  const {
    data: equipmentRawData,
    isLoading: isLoadingEquipment,
    refetch: refetchEquipment,
  } = useQuery({
    queryKey: ['dinh_muc_thiet_bi_unassigned', {
      donViId,
      search: filters.debouncedSearch,
      departments: filters.selectedDepartments,
      users: filters.selectedUsers,
      locations: filters.selectedLocations,
      fundingSources: filters.selectedFundingSources,
      page: paginationState.page,
      pageSize: paginationState.pageSize,
    }],
    queryFn: async () => {
      const result = await callRpc<UnassignedEquipmentRow[]>({
        fn: 'dinh_muc_thiet_bi_unassigned',
        args: {
          p_don_vi: donViId,
          p_search: filters.debouncedSearch || null,
          p_limit: paginationState.pageSize,
          p_offset: (paginationState.page - 1) * paginationState.pageSize,
          p_khoa_phong_array: filters.selectedDepartments.length > 0 ? filters.selectedDepartments : null,
          p_nguoi_su_dung_array: filters.selectedUsers.length > 0 ? filters.selectedUsers : null,
          p_vi_tri_lap_dat_array: filters.selectedLocations.length > 0 ? filters.selectedLocations : null,
          p_nguon_kinh_phi_array: filters.selectedFundingSources.length > 0 ? filters.selectedFundingSources : null,
        },
      })
      return result || []
    },
    enabled: !!donViId,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  })

  // Keep total count synced to server while recovering from empty out-of-range pages.
  const nextPaginationTotalCount = React.useMemo(
    () => getNextPaginationTotalCount({
      donViId,
      equipmentRawData,
      page: paginationState.page,
    }),
    [donViId, equipmentRawData, paginationState.page]
  )

  React.useEffect(() => {
    if (nextPaginationTotalCount === null) return
    setPaginationTotalCount(nextPaginationTotalCount)
  }, [nextPaginationTotalCount])

  React.useEffect(() => {
    if (!donViId || !equipmentRawData || equipmentRawData.length > 0 || paginationState.page === 1) {
      return
    }
    paginationState.resetToFirstPage()
  }, [donViId, equipmentRawData, paginationState.page, paginationState.resetToFirstPage])

  const totalEquipmentCount = paginationTotalCount

  // Strip total_count from rows for consumers
  const unassignedEquipment: UnassignedEquipment[] = React.useMemo(
    () => (equipmentRawData || []).map(({ total_count: _, ...rest }) => rest),
    [equipmentRawData]
  )

  // Fetch categories
  const {
    data: allCategoriesData,
    isLoading: isLoadingCategories,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['dinh_muc_nhom_list', { donViId }],
    queryFn: async () => {
      const result = await callRpc<Category[]>({
        fn: 'dinh_muc_nhom_list',
        args: { p_don_vi: donViId },
      })
      return result || []
    },
    enabled: !!donViId,
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
  })

  const allCategories: Category[] = React.useMemo(
    () => allCategoriesData || [],
    [allCategoriesData]
  )

  // Client-side category search with ancestor + descendant preservation
  const categories = useFilteredCategories(allCategories, categorySearchTerm)

  // Cache invalidation
  const invalidateAndRefetch = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dinh_muc_thiet_bi_unassigned'] })
    queryClient.invalidateQueries({ queryKey: ['dinh_muc_thiet_bi_unassigned_filter_options'] })
    queryClient.invalidateQueries({ queryKey: ['dinh_muc_nhom_list'] })
    queryClient.invalidateQueries({ queryKey: ['dinh_muc_compliance_summary'] })
  }, [queryClient])

  const clearSelection = React.useCallback(() => {
    setSelectedEquipmentIds(new Set())
    setSelectedCategoryId(null)
  }, [])

  const linkMutation = useLinkEquipmentMutation(toast, clearSelection, donViId)

  // Selection actions — "select all" only selects current page
  const toggleEquipmentSelection = React.useCallback((id: number) => {
    setSelectedEquipmentIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])

  const selectAllEquipment = React.useCallback(() => {
    if (unassignedEquipment) {
      setSelectedEquipmentIds(prev => {
        const next = new Set(prev)
        for (const eq of unassignedEquipment) next.add(eq.id)
        return next
      })
    }
  }, [unassignedEquipment])

  const deselectPageEquipment = React.useCallback(() => {
    if (unassignedEquipment) {
      const pageIds = new Set(unassignedEquipment.map(eq => eq.id))
      setSelectedEquipmentIds(prev => {
        const next = new Set(prev)
        for (const id of pageIds) next.delete(id)
        return next
      })
    }
  }, [unassignedEquipment])

  const clearEquipmentSelection = React.useCallback(() => {
    setSelectedEquipmentIds(new Set())
  }, [])

  const refetch = React.useCallback(() => {
    refetchEquipment()
    refetchCategories()
  }, [refetchEquipment, refetchCategories])

  const value = React.useMemo<DeviceQuotaMappingContextValue>(() => ({
    user, donViId, isFacilitySelected,
    unassignedEquipment, totalEquipmentCount,
    allCategories, categories,
    selectedEquipmentIds, selectedCategoryId,
    toggleEquipmentSelection, selectAllEquipment, deselectPageEquipment, clearEquipmentSelection,
    setSelectedCategory: setSelectedCategoryId,
    filters, filterOptions, pagination: paginationState,
    categorySearchTerm, setCategorySearchTerm,
    linkEquipment: linkMutation,
    isLoading: isLoadingEquipment || isLoadingCategories,
    isLinking: linkMutation.isPending,
    refetch,
  }), [
    user, donViId, isFacilitySelected,
    unassignedEquipment, totalEquipmentCount,
    allCategories, categories,
    selectedEquipmentIds, selectedCategoryId,
    toggleEquipmentSelection, selectAllEquipment, deselectPageEquipment, clearEquipmentSelection,
    filters, filterOptions, paginationState,
    categorySearchTerm,
    linkMutation, isLoadingEquipment, isLoadingCategories, refetch,
  ])

  return (
    <DeviceQuotaMappingContext.Provider value={value}>
      {children}
    </DeviceQuotaMappingContext.Provider>
  )
}

export { DeviceQuotaMappingContext }
