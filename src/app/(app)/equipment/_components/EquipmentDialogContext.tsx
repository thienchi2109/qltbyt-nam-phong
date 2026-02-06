"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { isGlobalRole, isRegionalLeaderRole } from "@/lib/rbac"
import type { Equipment, UsageLog, SessionUser } from "../types"

// ============================================
// Design Note
// ============================================
// Unlike RepairRequestsContext which includes CRUD mutations directly,
// this context focuses on dialog orchestration only. Mutations are handled
// within individual dialog components because:
//
// 1. Equipment module has more diverse operations (CRUD, usage tracking,
//    import, export, print) that would bloat the context
// 2. Dialog components already manage their own form state with react-hook-form
// 3. Simpler context = fewer re-renders when mutations update
//
// Dialogs call onDataMutationSuccess() after successful mutations to
// invalidate queries and sync state across the application.
// ============================================

// ============================================
// Context Types
// ============================================

interface DialogState {
  isAddOpen: boolean
  isImportOpen: boolean
  isColumnsOpen: boolean
  isDetailOpen: boolean
  isStartUsageOpen: boolean
  isEndUsageOpen: boolean
  editingEquipment: Equipment | null
  detailEquipment: Equipment | null
  startUsageEquipment: Equipment | null
  endUsageLog: UsageLog | null
}

interface EquipmentDialogContextValue {
  // User/Auth
  user: SessionUser | null
  isGlobal: boolean
  isRegionalLeader: boolean

  // Dialog state
  dialogState: DialogState

  // Dialog actions
  openAddDialog: () => void
  openImportDialog: () => void
  openColumnsDialog: () => void
  openEditDialog: (equipment: Equipment) => void
  openDetailDialog: (equipment: Equipment) => void
  openStartUsageDialog: (equipment: Equipment) => void
  openEndUsageDialog: (usageLog: UsageLog) => void
  closeAddDialog: () => void
  closeImportDialog: () => void
  closeColumnsDialog: () => void
  closeEditDialog: () => void
  closeDetailDialog: () => void
  closeStartUsageDialog: () => void
  closeEndUsageDialog: () => void
  closeAllDialogs: () => void

  // Cache invalidation callback for dialogs
  onDataMutationSuccess: () => void
}

// ============================================
// Context
// ============================================

const EquipmentDialogContext = React.createContext<EquipmentDialogContextValue | null>(null)

// ============================================
// Provider
// ============================================

interface EquipmentDialogProviderProps {
  children: React.ReactNode
  effectiveTenantKey: string
}

export function EquipmentDialogProvider({
  children,
  effectiveTenantKey,
}: EquipmentDialogProviderProps) {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user as SessionUser | null

  // Computed permissions
  const isGlobal = isGlobalRole(user?.role)
  const isRegionalLeader = isRegionalLeaderRole(user?.role)

  // Dialog state
  const [dialogState, setDialogState] = React.useState<DialogState>({
    isAddOpen: false,
    isImportOpen: false,
    isColumnsOpen: false,
    isDetailOpen: false,
    isStartUsageOpen: false,
    isEndUsageOpen: false,
    editingEquipment: null,
    detailEquipment: null,
    startUsageEquipment: null,
    endUsageLog: null,
  })

  // Cache invalidation
  const onDataMutationSuccess = React.useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey
        if (!Array.isArray(key)) return false
        if (key[0] !== "equipment_list_enhanced") return false
        const params = key[1] as Record<string, unknown>
        return params?.tenant === effectiveTenantKey
      },
      refetchType: "active",
    })
    // Also invalidate related queries
    queryClient.invalidateQueries({ queryKey: ["active_usage_logs"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent("equipment-cache-invalidated"))
  }, [queryClient, effectiveTenantKey])

  // Dialog open actions
  const openAddDialog = React.useCallback(() => {
    setDialogState((prev) => ({ ...prev, isAddOpen: true }))
  }, [])

  const openImportDialog = React.useCallback(() => {
    setDialogState((prev) => ({ ...prev, isImportOpen: true }))
  }, [])

  const openColumnsDialog = React.useCallback(() => {
    setDialogState((prev) => ({ ...prev, isColumnsOpen: true }))
  }, [])

  const openEditDialog = React.useCallback((equipment: Equipment) => {
    setDialogState((prev) => ({ ...prev, editingEquipment: equipment }))
  }, [])

  const openDetailDialog = React.useCallback((equipment: Equipment) => {
    setDialogState((prev) => ({
      ...prev,
      detailEquipment: equipment,
      isDetailOpen: true,
    }))
  }, [])

  const openStartUsageDialog = React.useCallback((equipment: Equipment) => {
    setDialogState((prev) => ({
      ...prev,
      startUsageEquipment: equipment,
      isStartUsageOpen: true,
    }))
  }, [])

  const openEndUsageDialog = React.useCallback((usageLog: UsageLog) => {
    setDialogState((prev) => ({
      ...prev,
      endUsageLog: usageLog,
      isEndUsageOpen: true,
    }))
  }, [])

  // Dialog close actions
  const closeAddDialog = React.useCallback(() => {
    setDialogState((prev) => ({ ...prev, isAddOpen: false }))
  }, [])

  const closeImportDialog = React.useCallback(() => {
    setDialogState((prev) => ({ ...prev, isImportOpen: false }))
  }, [])

  const closeColumnsDialog = React.useCallback(() => {
    setDialogState((prev) => ({ ...prev, isColumnsOpen: false }))
  }, [])

  const closeEditDialog = React.useCallback(() => {
    setDialogState((prev) => ({ ...prev, editingEquipment: null }))
  }, [])

  const closeDetailDialog = React.useCallback(() => {
    setDialogState((prev) => ({
      ...prev,
      detailEquipment: null,
      isDetailOpen: false,
    }))
  }, [])

  const closeStartUsageDialog = React.useCallback(() => {
    setDialogState((prev) => ({
      ...prev,
      startUsageEquipment: null,
      isStartUsageOpen: false,
    }))
  }, [])

  const closeEndUsageDialog = React.useCallback(() => {
    setDialogState((prev) => ({
      ...prev,
      endUsageLog: null,
      isEndUsageOpen: false,
    }))
  }, [])

  const closeAllDialogs = React.useCallback(() => {
    setDialogState({
      isAddOpen: false,
      isImportOpen: false,
      isColumnsOpen: false,
      isDetailOpen: false,
      isStartUsageOpen: false,
      isEndUsageOpen: false,
      editingEquipment: null,
      detailEquipment: null,
      startUsageEquipment: null,
      endUsageLog: null,
    })
  }, [])

  const value = React.useMemo<EquipmentDialogContextValue>(
    () => ({
      user,
      isGlobal,
      isRegionalLeader,
      dialogState,
      openAddDialog,
      openImportDialog,
      openColumnsDialog,
      openEditDialog,
      openDetailDialog,
      openStartUsageDialog,
      openEndUsageDialog,
      closeAddDialog,
      closeImportDialog,
      closeColumnsDialog,
      closeEditDialog,
      closeDetailDialog,
      closeStartUsageDialog,
      closeEndUsageDialog,
      closeAllDialogs,
      onDataMutationSuccess,
    }),
    [
      user,
      isGlobal,
      isRegionalLeader,
      dialogState,
      openAddDialog,
      openImportDialog,
      openColumnsDialog,
      openEditDialog,
      openDetailDialog,
      openStartUsageDialog,
      openEndUsageDialog,
      closeAddDialog,
      closeImportDialog,
      closeColumnsDialog,
      closeEditDialog,
      closeDetailDialog,
      closeStartUsageDialog,
      closeEndUsageDialog,
      closeAllDialogs,
      onDataMutationSuccess,
    ]
  )

  return (
    <EquipmentDialogContext.Provider value={value}>
      {children}
    </EquipmentDialogContext.Provider>
  )
}

export { EquipmentDialogContext }
