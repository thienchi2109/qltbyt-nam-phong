"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"

// ============================================
// Types
// ============================================

interface UnassignedEquipment {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  model: string | null
  serial: string | null
  hang_san_xuat: string | null
  khoa_phong_quan_ly: string | null
  tinh_trang: string | null
}

interface Category {
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

interface DeviceQuotaMappingContextValue {
  // User/Auth
  user: AuthUser | null
  donViId: number | null

  // Data
  unassignedEquipment: UnassignedEquipment[]
  categories: Category[]

  // Selection state
  selectedEquipmentIds: Set<number>
  selectedCategoryId: number | null

  // Actions
  toggleEquipmentSelection: (id: number) => void
  selectAllEquipment: () => void
  clearEquipmentSelection: () => void
  setSelectedCategory: (id: number | null) => void

  // Search/filter
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Mutations
  linkEquipment: ReturnType<typeof useLinkEquipmentMutation>

  // Loading states
  isLoading: boolean
  isLinking: boolean

  // Refetch
  refetch: () => void
}

// ============================================
// Mutation Hook
// ============================================

function useLinkEquipmentMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void,
  clearSelection: () => void
) {
  return useMutation({
    mutationFn: async (data: {
      thiet_bi_ids: number[]
      nhom_id: number
    }) => {
      return callRpc({
        fn: 'dinh_muc_thiet_bi_link',
        args: {
          p_thiet_bi_ids: data.thiet_bi_ids,
          p_nhom_id: data.nhom_id,
        }
      })
    },
    onSuccess: (_, variables) => {
      const count = variables.thiet_bi_ids.length
      toast({
        title: "Thành công",
        description: `Đã gán ${count} thiết bị vào nhóm định mức.`
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
// Context
// ============================================

const DeviceQuotaMappingContext = React.createContext<DeviceQuotaMappingContextValue | null>(null)

// ============================================
// Provider
// ============================================

interface DeviceQuotaMappingProviderProps {
  children: React.ReactNode
}

export function DeviceQuotaMappingProvider({ children }: DeviceQuotaMappingProviderProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user as AuthUser | null

  // Get tenant ID from user
  const donViId = user?.don_vi ? parseInt(user.don_vi, 10) : null

  // Selection state
  const [selectedEquipmentIds, setSelectedEquipmentIds] = React.useState<Set<number>>(new Set())
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Fetch unassigned equipment
  const {
    data: unassignedData,
    isLoading: isLoadingEquipment,
    refetch: refetchEquipment,
  } = useQuery({
    queryKey: ['dinh_muc_thiet_bi_unassigned', { donViId, searchQuery }],
    queryFn: async () => {
      const result = await callRpc<UnassignedEquipment[]>({
        fn: 'dinh_muc_thiet_bi_unassigned',
        args: {
          p_don_vi: donViId,
          p_search: searchQuery || null,
        },
      })
      return result || []
    },
    enabled: !!donViId,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch categories
  const {
    data: categoriesData,
    isLoading: isLoadingCategories,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['dinh_muc_nhom_list', { donViId }],
    queryFn: async () => {
      const result = await callRpc<Category[]>({
        fn: 'dinh_muc_nhom_list',
        args: {
          p_quyet_dinh_id: null, // Auto-find active decision
          p_don_vi: donViId,
        },
      })
      return result || []
    },
    enabled: !!donViId,
    staleTime: 60000, // 1 minute (categories change less frequently)
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  // Cache invalidation
  const invalidateAndRefetch = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dinh_muc_thiet_bi_unassigned'] })
    queryClient.invalidateQueries({ queryKey: ['dinh_muc_nhom_list'] })
    // Also invalidate dashboard summary (unassigned count changes)
    queryClient.invalidateQueries({ queryKey: ['dinh_muc_compliance_summary'] })
  }, [queryClient])

  // Clear selection
  const clearSelection = React.useCallback(() => {
    setSelectedEquipmentIds(new Set())
    setSelectedCategoryId(null)
  }, [])

  // Link mutation
  const linkMutation = useLinkEquipmentMutation(toast, invalidateAndRefetch, clearSelection)

  // Selection actions
  const toggleEquipmentSelection = React.useCallback((id: number) => {
    setSelectedEquipmentIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAllEquipment = React.useCallback(() => {
    if (unassignedData) {
      setSelectedEquipmentIds(new Set(unassignedData.map(e => e.id)))
    }
  }, [unassignedData])

  const clearEquipmentSelection = React.useCallback(() => {
    setSelectedEquipmentIds(new Set())
  }, [])

  // Refetch all data
  const refetch = React.useCallback(() => {
    refetchEquipment()
    refetchCategories()
  }, [refetchEquipment, refetchCategories])

  const value = React.useMemo<DeviceQuotaMappingContextValue>(() => ({
    user,
    donViId,
    unassignedEquipment: unassignedData || [],
    categories: categoriesData || [],
    selectedEquipmentIds,
    selectedCategoryId,
    toggleEquipmentSelection,
    selectAllEquipment,
    clearEquipmentSelection,
    setSelectedCategory: setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
    linkEquipment: linkMutation,
    isLoading: isLoadingEquipment || isLoadingCategories,
    isLinking: linkMutation.isPending,
    refetch,
  }), [
    user,
    donViId,
    unassignedData,
    categoriesData,
    selectedEquipmentIds,
    selectedCategoryId,
    toggleEquipmentSelection,
    selectAllEquipment,
    clearEquipmentSelection,
    searchQuery,
    linkMutation,
    isLoadingEquipment,
    isLoadingCategories,
    refetch,
  ])

  return (
    <DeviceQuotaMappingContext.Provider value={value}>
      {children}
    </DeviceQuotaMappingContext.Provider>
  )
}

export { DeviceQuotaMappingContext }
export type { UnassignedEquipment, Category, DeviceQuotaMappingContextValue }
