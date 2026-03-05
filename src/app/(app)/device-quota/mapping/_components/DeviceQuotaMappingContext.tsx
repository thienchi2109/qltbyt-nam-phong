"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { useServerPagination } from "@/hooks/useServerPagination"
import { useUnassignedEquipmentFilters } from "../_hooks/useUnassignedEquipmentFilters"
import { filterCategoriesWithAncestorsAndDescendants } from "../../categories/_utils/filterCategoriesWithAncestorsAndDescendants"

// ============================================
// Types
// ============================================

interface UnassignedEquipmentRow {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  model: string | null
  serial: string | null
  hang_san_xuat: string | null
  khoa_phong_quan_ly: string | null
  tinh_trang: string | null
  total_count: number
}

export interface UnassignedEquipment {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  model: string | null
  serial: string | null
  hang_san_xuat: string | null
  khoa_phong_quan_ly: string | null
  tinh_trang: string | null
}

export interface Category {
  id: number
  parent_id: number | null
  ma_nhom: string
  ten_nhom: string
  phan_loai: string | null
  level: number
  so_luong_hien_co: number
}

interface AuthUser {
  id: string
  username: string
  full_name?: string | null
  role: string
  don_vi?: string | null
  dia_ban_id?: number | null
}

export interface FilterOptions {
  departments: string[]
  users: string[]
  locations: string[]
  fundingSources: string[]
}

export interface DeviceQuotaMappingContextValue {
  user: AuthUser | null
  donViId: number | null
  isFacilitySelected: boolean

  // Equipment data (current page)
  unassignedEquipment: UnassignedEquipment[]
  totalEquipmentCount: number

  // Categories (all, and search-filtered)
  allCategories: Category[]
  categories: Category[]

  // Selection
  selectedEquipmentIds: Set<number>
  selectedCategoryId: number | null
  toggleEquipmentSelection: (id: number) => void
  selectAllEquipment: () => void
  clearEquipmentSelection: () => void
  setSelectedCategory: (id: number | null) => void

  // Equipment filters (from useUnassignedEquipmentFilters)
  filters: ReturnType<typeof useUnassignedEquipmentFilters>
  filterOptions: FilterOptions

  // Equipment pagination (from useServerPagination)
  pagination: ReturnType<typeof useServerPagination>

  // Category search (client-side)
  categorySearchTerm: string
  setCategorySearchTerm: (term: string) => void

  // Mutations
  linkEquipment: ReturnType<typeof useLinkEquipmentMutation>

  // Loading
  isLoading: boolean
  isLinking: boolean
  refetch: () => void
}

// ============================================
// Mutation Hook
// ============================================

function useLinkEquipmentMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void,
  clearSelection: () => void,
  donViId: number | null
) {
  return useMutation({
    mutationFn: async (data: { thiet_bi_ids: number[]; nhom_id: number }) => {
      return callRpc({
        fn: 'dinh_muc_thiet_bi_link',
        args: {
          p_thiet_bi_ids: data.thiet_bi_ids,
          p_nhom_id: data.nhom_id,
          p_don_vi: donViId,
        }
      })
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Thành công",
        description: `Đã gán ${variables.thiet_bi_ids.length} thiết bị vào nhóm định mức.`
      })
      clearSelection()
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi gán thiết bị",
        description: error.message
      })
    },
  })
}

// ============================================
// Client-side Category Search with ancestor + descendant preservation
// ============================================

function useFilteredCategories(allCategories: Category[], searchTerm: string): Category[] {
  return React.useMemo(
    () => filterCategoriesWithAncestorsAndDescendants(allCategories, searchTerm),
    [allCategories, searchTerm]
  )
}

// ============================================
// Context & Provider
// ============================================

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

  // Build resetKey so pagination resets to page 1 on any filter/search change
  const paginationResetKey = `${filters.debouncedSearch}|${filters.selectedDepartments.join(',')}|${filters.selectedUsers.join(',')}|${filters.selectedLocations.join(',')}|${filters.selectedFundingSources.join(',')}`

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

  // Parse total_count from first row and sync to pagination
  const totalEquipmentCount = equipmentRawData?.[0]?.total_count ?? 0
  React.useEffect(() => {
    setPaginationTotalCount(totalEquipmentCount)
  }, [totalEquipmentCount])

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

  const linkMutation = useLinkEquipmentMutation(toast, invalidateAndRefetch, clearSelection, donViId)

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
    toggleEquipmentSelection, selectAllEquipment, clearEquipmentSelection,
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
    toggleEquipmentSelection, selectAllEquipment, clearEquipmentSelection,
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
