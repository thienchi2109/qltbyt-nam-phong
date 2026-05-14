"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import {
  useActivateMutation,
  useCreateMutation,
  useDeleteMutation,
  useUpdateMutation,
} from "./DeviceQuotaDecisionMutations"

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
      const result = await callRpc<{ data: Decision[]; total: number }>({
        fn: 'dinh_muc_quyet_dinh_list',
        args: {
          p_don_vi: donViId,
          p_trang_thai: statusFilter === 'all' ? null : statusFilter,
        },
      })
      return result?.data || []
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
  const createMutation = useCreateMutation(toast)
  const updateMutation = useUpdateMutation(toast)
  const activateMutation = useActivateMutation(toast)
  const deleteMutation = useDeleteMutation(toast)

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
