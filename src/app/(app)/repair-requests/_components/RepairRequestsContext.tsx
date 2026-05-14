"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { isEquipmentManagerRole, isRegionalLeaderRole } from "@/lib/rbac"
import type {
  RepairRequestWithEquipment,
  AuthUser,
  EquipmentSelectItem
} from "../types"
import type { RepairRequestDraftPayload } from "@/lib/ai/draft/repair-request-draft-schema"
import { useAssistantDraft } from "../_hooks/useAssistantDraft"
import {
  useApproveMutation,
  useCompleteMutation,
  useCreateMutation,
  useDeleteMutation,
  useUpdateMutation,
} from "./RepairRequestsMutations"

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

  // Assistant draft
  assistantDraft: RepairRequestDraftPayload | null
  applyAssistantDraft: (draft: RepairRequestDraftPayload) => void
  clearAssistantDraft: () => void
}

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

  // Assistant draft state (extracted hook)
  const {
    assistantDraft,
    draftEquipment,
    applyAssistantDraft,
    clearAssistantDraft,
  } = useAssistantDraft()

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
    queryClient.invalidateQueries({ queryKey: ['repair_request_change_history'] })
    // Invalidate dashboard stats so Equipment tab updates immediately
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }, [queryClient])

  // Mutations
  const createMutation = useCreateMutation(toast)
  const updateMutation = useUpdateMutation(toast)
  const deleteMutation = useDeleteMutation(toast)
  const approveMutation = useApproveMutation(toast, user)
  const completeMutation = useCompleteMutation(toast)

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
    clearAssistantDraft()
  }, [clearAssistantDraft])

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
    assistantDraft,
    applyAssistantDraft,
    clearAssistantDraft,
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
    assistantDraft,
    applyAssistantDraft,
    clearAssistantDraft,
  ])

  return (
    <RepairRequestsContext.Provider value={value}>
      {children}
    </RepairRequestsContext.Provider>
  )
}

export { RepairRequestsContext }
