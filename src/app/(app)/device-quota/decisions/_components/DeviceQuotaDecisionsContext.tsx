"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"

// ============================================
// Types
// ============================================

export interface Decision {
  id: number
  don_vi_id: number
  so_quyet_dinh: string
  ngay_ban_hanh: string
  ngay_hieu_luc: string
  ngay_het_hieu_luc: string | null
  nguoi_ky: string
  chuc_vu_nguoi_ky: string
  trang_thai: 'draft' | 'active' | 'inactive'
  ghi_chu: string | null
  thay_the_cho_id: number | null
  created_at: string
  updated_at: string
  total_categories: number
  total_equipment_mapped: number
}

interface AuthUser {
  id: string
  username: string
  full_name?: string | null
  role: string
  don_vi?: string | null
  dia_ban_id?: number | null
}

export type StatusFilter = 'all' | 'draft' | 'active' | 'inactive'

interface DialogState {
  isCreateOpen: boolean
  isEditOpen: boolean
  selectedDecision: Decision | null
}

interface DeviceQuotaDecisionsContextValue {
  // User/Auth
  user: AuthUser | null
  donViId: number | null

  // Data
  decisions: Decision[]

  // Filter
  statusFilter: StatusFilter
  setStatusFilter: (status: StatusFilter) => void

  // Dialog states
  dialogState: DialogState
  isCreateDialogOpen: boolean
  isEditDialogOpen: boolean
  selectedDecision: Decision | null

  // Dialog actions
  openCreateDialog: () => void
  openEditDialog: (decision: Decision) => void
  closeDialogs: () => void

  // Mutations
  createMutation: ReturnType<typeof useCreateMutation>
  updateMutation: ReturnType<typeof useUpdateMutation>
  activateMutation: ReturnType<typeof useActivateMutation>
  deleteMutation: ReturnType<typeof useDeleteMutation>

  // Loading states
  isLoading: boolean
  isError: boolean

  // Refetch
  refetch: () => void
  invalidateAndRefetch: () => void
}

// ============================================
// Mutation Hooks
// ============================================

function useCreateMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void
) {
  return useMutation({
    mutationFn: async (data: {
      so_quyet_dinh: string
      ngay_ban_hanh: string
      ngay_hieu_luc: string
      ngay_het_hieu_luc: string | null
      nguoi_ky: string
      chuc_vu_nguoi_ky: string
      ghi_chu: string | null
      thay_the_cho_id: number | null
    }) => {
      return callRpc({
        fn: 'dinh_muc_quyet_dinh_create',
        args: {
          p_so_quyet_dinh: data.so_quyet_dinh,
          p_ngay_ban_hanh: data.ngay_ban_hanh,
          p_ngay_hieu_luc: data.ngay_hieu_luc,
          p_ngay_het_hieu_luc: data.ngay_het_hieu_luc,
          p_nguoi_ky: data.nguoi_ky,
          p_chuc_vu_nguoi_ky: data.chuc_vu_nguoi_ky,
          p_ghi_chu: data.ghi_chu,
          p_thay_the_cho_id: data.thay_the_cho_id,
        }
      })
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Quyết định đã được tạo."
      })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Tạo quyết định thất bại",
        description: error.message
      })
    },
  })
}

function useUpdateMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void
) {
  return useMutation({
    mutationFn: async (data: {
      id: number
      so_quyet_dinh: string
      ngay_ban_hanh: string
      ngay_hieu_luc: string
      ngay_het_hieu_luc: string | null
      nguoi_ky: string
      chuc_vu_nguoi_ky: string
      ghi_chu: string | null
    }) => {
      return callRpc({
        fn: 'dinh_muc_quyet_dinh_update',
        args: {
          p_id: data.id,
          p_so_quyet_dinh: data.so_quyet_dinh,
          p_ngay_ban_hanh: data.ngay_ban_hanh,
          p_ngay_hieu_luc: data.ngay_hieu_luc,
          p_ngay_het_hieu_luc: data.ngay_het_hieu_luc,
          p_nguoi_ky: data.nguoi_ky,
          p_chuc_vu_nguoi_ky: data.chuc_vu_nguoi_ky,
          p_ghi_chu: data.ghi_chu,
        }
      })
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đã cập nhật quyết định."
      })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: error.message
      })
    },
  })
}

function useActivateMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void
) {
  return useMutation({
    mutationFn: async (id: number) => {
      return callRpc({
        fn: 'dinh_muc_quyet_dinh_activate',
        args: { p_id: id }
      })
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Quyết định đã được kích hoạt."
      })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi kích hoạt quyết định",
        description: error.message
      })
    },
  })
}

function useDeleteMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void
) {
  return useMutation({
    mutationFn: async (id: number) => {
      return callRpc({
        fn: 'dinh_muc_quyet_dinh_delete',
        args: { p_id: id }
      })
    },
    onSuccess: () => {
      toast({
        title: "Đã xóa",
        description: "Quyết định đã được xóa thành công."
      })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi xóa quyết định",
        description: error.message
      })
    },
  })
}

// ============================================
// Context
// ============================================

const DeviceQuotaDecisionsContext = React.createContext<DeviceQuotaDecisionsContextValue | null>(null)

// ============================================
// Provider
// ============================================

interface DeviceQuotaDecisionsProviderProps {
  children: React.ReactNode
}

export function DeviceQuotaDecisionsProvider({ children }: DeviceQuotaDecisionsProviderProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user as AuthUser | null

  // Get tenant ID from user
  const donViId = user?.don_vi ? parseInt(user.don_vi, 10) : null

  // Filter state
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')

  // Dialog state
  const [dialogState, setDialogState] = React.useState<DialogState>({
    isCreateOpen: false,
    isEditOpen: false,
    selectedDecision: null,
  })

  // Fetch decisions list
  const {
    data: decisionsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['dinh_muc_quyet_dinh_list', { donViId, statusFilter }],
    queryFn: async () => {
      const result = await callRpc<Decision[]>({
        fn: 'dinh_muc_quyet_dinh_list',
        args: {
          p_don_vi: donViId,
          p_trang_thai: statusFilter === 'all' ? null : statusFilter,
        },
      })
      return result || []
    },
    enabled: !!donViId,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  // Cache invalidation
  const invalidateAndRefetch = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dinh_muc_quyet_dinh_list'] })
    // Also invalidate dashboard since it shows compliance summary
    queryClient.invalidateQueries({ queryKey: ['dinh_muc_compliance_summary'] })
  }, [queryClient])

  // Mutations
  const createMutation = useCreateMutation(toast, invalidateAndRefetch)
  const updateMutation = useUpdateMutation(toast, invalidateAndRefetch)
  const activateMutation = useActivateMutation(toast, invalidateAndRefetch)
  const deleteMutation = useDeleteMutation(toast, invalidateAndRefetch)

  // Dialog actions
  const openCreateDialog = React.useCallback(() => {
    setDialogState(prev => ({
      ...prev,
      isCreateOpen: true,
      isEditOpen: false,
      selectedDecision: null,
    }))
  }, [])

  const openEditDialog = React.useCallback((decision: Decision) => {
    setDialogState(prev => ({
      ...prev,
      isCreateOpen: false,
      isEditOpen: true,
      selectedDecision: decision,
    }))
  }, [])

  const closeDialogs = React.useCallback(() => {
    setDialogState({
      isCreateOpen: false,
      isEditOpen: false,
      selectedDecision: null,
    })
  }, [])

  const value = React.useMemo<DeviceQuotaDecisionsContextValue>(() => ({
    user,
    donViId,
    decisions: decisionsData || [],
    statusFilter,
    setStatusFilter,
    dialogState,
    isCreateDialogOpen: dialogState.isCreateOpen,
    isEditDialogOpen: dialogState.isEditOpen,
    selectedDecision: dialogState.selectedDecision,
    openCreateDialog,
    openEditDialog,
    closeDialogs,
    createMutation,
    updateMutation,
    activateMutation,
    deleteMutation,
    isLoading,
    isError,
    refetch,
    invalidateAndRefetch,
  }), [
    user,
    donViId,
    decisionsData,
    statusFilter,
    dialogState,
    openCreateDialog,
    openEditDialog,
    closeDialogs,
    createMutation,
    updateMutation,
    activateMutation,
    deleteMutation,
    isLoading,
    isError,
    refetch,
    invalidateAndRefetch,
  ])

  return (
    <DeviceQuotaDecisionsContext.Provider value={value}>
      {children}
    </DeviceQuotaDecisionsContext.Provider>
  )
}

export { DeviceQuotaDecisionsContext }
