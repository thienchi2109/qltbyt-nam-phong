"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { isEquipmentManagerRole, isRegionalLeaderRole } from "@/lib/rbac"
import type {
  RepairRequestWithEquipment,
  RepairUnit,
  AuthUser,
  EquipmentSelectItem
} from "../types"

// ============================================
// Context Types
// ============================================

interface DialogState {
  requestToEdit: RepairRequestWithEquipment | null
  requestToDelete: RepairRequestWithEquipment | null
  requestToApprove: RepairRequestWithEquipment | null
  requestToComplete: RepairRequestWithEquipment | null
  requestToView: RepairRequestWithEquipment | null
  completionType: 'Hoàn thành' | 'Không HT' | null
  isCreateOpen: boolean
  preSelectedEquipment: EquipmentSelectItem | null
}

interface RepairRequestsContextValue {
  // User/Auth
  user: AuthUser | null
  canSetRepairUnit: boolean
  isRegionalLeader: boolean

  // Dialog state
  dialogState: DialogState

  // Dialog actions
  openEditDialog: (request: RepairRequestWithEquipment) => void
  openDeleteDialog: (request: RepairRequestWithEquipment) => void
  openApproveDialog: (request: RepairRequestWithEquipment) => void
  openCompleteDialog: (request: RepairRequestWithEquipment, type: 'Hoàn thành' | 'Không HT') => void
  openViewDialog: (request: RepairRequestWithEquipment) => void
  openCreateSheet: (equipment?: EquipmentSelectItem) => void
  closeAllDialogs: () => void

  // Mutations
  createMutation: ReturnType<typeof useCreateMutation>
  updateMutation: ReturnType<typeof useUpdateMutation>
  deleteMutation: ReturnType<typeof useDeleteMutation>
  approveMutation: ReturnType<typeof useApproveMutation>
  completeMutation: ReturnType<typeof useCompleteMutation>

  // Cache invalidation
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
      thiet_bi_id: number
      mo_ta_su_co: string
      hang_muc_sua_chua: string
      ngay_mong_muon_hoan_thanh: string | null
      nguoi_yeu_cau: string
      don_vi_thuc_hien: RepairUnit | null
      ten_don_vi_thue: string | null
    }) => {
      return callRpc({
        fn: 'repair_request_create',
        args: {
          p_thiet_bi_id: data.thiet_bi_id,
          p_mo_ta_su_co: data.mo_ta_su_co,
          p_hang_muc_sua_chua: data.hang_muc_sua_chua,
          p_ngay_mong_muon_hoan_thanh: data.ngay_mong_muon_hoan_thanh,
          p_nguoi_yeu_cau: data.nguoi_yeu_cau,
          p_don_vi_thuc_hien: data.don_vi_thuc_hien,
          p_ten_don_vi_thue: data.ten_don_vi_thue,
        }
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Yêu cầu sửa chữa đã được gửi." })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Gửi yêu cầu thất bại",
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
      mo_ta_su_co: string
      hang_muc_sua_chua: string
      ngay_mong_muon_hoan_thanh: string | null
      don_vi_thuc_hien?: RepairUnit
      ten_don_vi_thue: string | null
    }) => {
      return callRpc({
        fn: 'repair_request_update',
        args: {
          p_id: data.id,
          p_mo_ta_su_co: data.mo_ta_su_co,
          p_hang_muc_sua_chua: data.hang_muc_sua_chua,
          p_ngay_mong_muon_hoan_thanh: data.ngay_mong_muon_hoan_thanh,
          p_don_vi_thuc_hien: data.don_vi_thuc_hien,
          p_ten_don_vi_thue: data.ten_don_vi_thue,
        }
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã cập nhật yêu cầu." })
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

function useDeleteMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void
) {
  return useMutation({
    mutationFn: async (id: number) => {
      return callRpc({ fn: 'repair_request_delete', args: { p_id: id } })
    },
    onSuccess: () => {
      toast({ title: "Đã xóa", description: "Yêu cầu đã được xóa thành công." })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi xóa yêu cầu",
        description: error.message
      })
    },
  })
}

function useApproveMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void,
  user: AuthUser | null
) {
  return useMutation({
    mutationFn: async (data: {
      id: number
      don_vi_thuc_hien: RepairUnit
      ten_don_vi_thue: string | null
    }) => {
      return callRpc({
        fn: 'repair_request_approve',
        args: {
          p_id: data.id,
          p_nguoi_duyet: user?.full_name || user?.username || '',
          p_don_vi_thuc_hien: data.don_vi_thuc_hien,
          p_ten_don_vi_thue: data.ten_don_vi_thue,
        }
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã duyệt yêu cầu." })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi duyệt yêu cầu",
        description: error.message
      })
    },
  })
}

function useCompleteMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void
) {
  return useMutation({
    mutationFn: async (data: {
      id: number
      completion: string | null
      reason: string | null
    }) => {
      return callRpc({
        fn: 'repair_request_complete',
        args: {
          p_id: data.id,
          p_completion: data.completion,
          p_reason: data.reason,
        }
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã cập nhật trạng thái yêu cầu." })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật yêu cầu",
        description: error.message
      })
    },
  })
}

// ============================================
// Context
// ============================================

const RepairRequestsContext = React.createContext<RepairRequestsContextValue | null>(null)

// ============================================
// Provider
// ============================================

interface RepairRequestsProviderProps {
  children: React.ReactNode
}

export function RepairRequestsProvider({ children }: RepairRequestsProviderProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user as AuthUser | null

  // Computed permissions
  const canSetRepairUnit = isEquipmentManagerRole(user?.role)
  const isRegionalLeader = isRegionalLeaderRole(user?.role)

  // Dialog state
  const [dialogState, setDialogState] = React.useState<DialogState>({
    requestToEdit: null,
    requestToDelete: null,
    requestToApprove: null,
    requestToComplete: null,
    requestToView: null,
    completionType: null,
    isCreateOpen: false,
    preSelectedEquipment: null,
  })

  // Cache invalidation
  const invalidateAndRefetch = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['repair_request_list'] })
    queryClient.invalidateQueries({ queryKey: ['repair_request_facilities'] })
    queryClient.invalidateQueries({ queryKey: ['repair_request_status_counts'] })
    // Invalidate dashboard stats so Equipment tab updates immediately
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }, [queryClient])

  // Mutations
  const createMutation = useCreateMutation(toast, invalidateAndRefetch)
  const updateMutation = useUpdateMutation(toast, invalidateAndRefetch)
  const deleteMutation = useDeleteMutation(toast, invalidateAndRefetch)
  const approveMutation = useApproveMutation(toast, invalidateAndRefetch, user)
  const completeMutation = useCompleteMutation(toast, invalidateAndRefetch)

  // Dialog actions
  const openEditDialog = React.useCallback((request: RepairRequestWithEquipment) => {
    setDialogState(prev => ({ ...prev, requestToEdit: request }))
  }, [])

  const openDeleteDialog = React.useCallback((request: RepairRequestWithEquipment) => {
    setDialogState(prev => ({ ...prev, requestToDelete: request }))
  }, [])

  const openApproveDialog = React.useCallback((request: RepairRequestWithEquipment) => {
    setDialogState(prev => ({ ...prev, requestToApprove: request }))
  }, [])

  const openCompleteDialog = React.useCallback((
    request: RepairRequestWithEquipment,
    type: 'Hoàn thành' | 'Không HT'
  ) => {
    setDialogState(prev => ({
      ...prev,
      requestToComplete: request,
      completionType: type
    }))
  }, [])

  const openViewDialog = React.useCallback((request: RepairRequestWithEquipment) => {
    setDialogState(prev => ({ ...prev, requestToView: request }))
  }, [])

  const openCreateSheet = React.useCallback((equipment?: EquipmentSelectItem) => {
    setDialogState(prev => ({
      ...prev,
      isCreateOpen: true,
      preSelectedEquipment: equipment ?? null
    }))
  }, [])

  const closeAllDialogs = React.useCallback(() => {
    setDialogState({
      requestToEdit: null,
      requestToDelete: null,
      requestToApprove: null,
      requestToComplete: null,
      requestToView: null,
      completionType: null,
      isCreateOpen: false,
      preSelectedEquipment: null,
    })
  }, [])

  const value = React.useMemo<RepairRequestsContextValue>(() => ({
    user,
    canSetRepairUnit,
    isRegionalLeader,
    dialogState,
    openEditDialog,
    openDeleteDialog,
    openApproveDialog,
    openCompleteDialog,
    openViewDialog,
    openCreateSheet,
    closeAllDialogs,
    createMutation,
    updateMutation,
    deleteMutation,
    approveMutation,
    completeMutation,
    invalidateAndRefetch,
  }), [
    user,
    canSetRepairUnit,
    isRegionalLeader,
    dialogState,
    openEditDialog,
    openDeleteDialog,
    openApproveDialog,
    openCompleteDialog,
    openViewDialog,
    openCreateSheet,
    closeAllDialogs,
    createMutation,
    updateMutation,
    deleteMutation,
    approveMutation,
    completeMutation,
    invalidateAndRefetch,
  ])

  return (
    <RepairRequestsContext.Provider value={value}>
      {children}
    </RepairRequestsContext.Provider>
  )
}

export { RepairRequestsContext }
