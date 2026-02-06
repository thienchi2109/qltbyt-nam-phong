"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { isEquipmentManagerRole, isRegionalLeaderRole } from "@/lib/rbac"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask, Equipment } from "@/lib/data"
import { useMaintenanceOperations } from "../_hooks/use-maintenance-operations"
import { useMaintenancePrint } from "../_hooks/use-maintenance-print"
import { useTaskEditing, type UseTaskEditingOptions } from "./task-editing"

// ============================================
// Context Types
// ============================================

export interface AuthUser {
  id?: string
  role?: string
  don_vi_id?: number
  dia_ban_id?: number
  full_name?: string
  username?: string
}

interface DialogState {
  isAddPlanDialogOpen: boolean
  editingPlan: MaintenancePlan | null
  isAddTasksDialogOpen: boolean
  isBulkScheduleOpen: boolean
  isConfirmingCancel: boolean
  isConfirmingBulkDelete: boolean
}

interface CompletionStatusEntry {
  historyId: number
}

export interface MaintenanceContextValue {
  // Auth state
  user: AuthUser | null
  isRegionalLeader: boolean
  canManagePlans: boolean
  canCompleteTask: boolean

  // Plan state
  selectedPlan: MaintenancePlan | null
  setSelectedPlan: React.Dispatch<React.SetStateAction<MaintenancePlan | null>>
  activeTab: string
  setActiveTab: React.Dispatch<React.SetStateAction<string>>

  // Dialog state & actions
  dialogState: DialogState
  setIsAddPlanDialogOpen: (open: boolean) => void
  setEditingPlan: (plan: MaintenancePlan | null) => void
  setIsAddTasksDialogOpen: (open: boolean) => void
  setIsBulkScheduleOpen: (open: boolean) => void
  setIsConfirmingCancel: (open: boolean) => void
  setIsConfirmingBulkDelete: (open: boolean) => void

  // Draft management (from use-maintenance-drafts pattern)
  tasks: MaintenanceTask[]
  draftTasks: MaintenanceTask[]
  setDraftTasks: React.Dispatch<React.SetStateAction<MaintenanceTask[]>>
  hasChanges: boolean
  isLoadingTasks: boolean
  isSavingAll: boolean
  fetchPlanDetails: (plan: MaintenancePlan) => Promise<void>
  handleSaveAllChanges: () => Promise<void>
  handleCancelAllChanges: () => void
  getDraftCacheKey: (planId: number) => string

  // Task editing (from task-editing.tsx)
  taskEditing: ReturnType<typeof useTaskEditing>

  // Completion tracking
  completionStatus: Record<string, CompletionStatusEntry>
  isLoadingCompletion: boolean
  isCompletingTask: string | null
  handleMarkAsCompleted: (task: MaintenanceTask, month: number) => Promise<void>

  // Operations (from use-maintenance-operations)
  operations: ReturnType<typeof useMaintenanceOperations>

  // Print (from use-maintenance-print)
  generatePlanForm: () => void
  isPrintGenerating: boolean

  // Helpers
  existingEquipmentIdsInDraft: number[]
  handleAddTasksFromDialog: (newlySelectedEquipment: Equipment[]) => void
  handleSelectPlan: (plan: MaintenancePlan) => void
  onPlanMutationSuccess: () => void
  handleBulkScheduleApply: (months: Record<string, boolean>) => void
  handleBulkAssignUnit: (unit: string | null) => void
  confirmDeleteSingleTask: () => void
  confirmDeleteSelectedTasks: () => void
  isDeletingTasks: boolean
  isPlanApproved: boolean
  selectedTaskRowsCount: number
  taskRowSelection: Record<string, boolean>
  setTaskRowSelection: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}

// ============================================
// Context
// ============================================

export const MaintenanceContext = React.createContext<MaintenanceContextValue | null>(null)

// ============================================
// Provider
// ============================================

interface MaintenanceProviderProps {
  children: React.ReactNode
  refetchPlans: () => void
  taskTable?: {
    getFilteredSelectedRowModel: () => { rows: Array<{ original: MaintenanceTask }> }
    getRowModel: () => { rows: Array<{ original: MaintenanceTask }> }
  }
  taskRowSelection?: Record<string, boolean>
  setTaskRowSelection?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}

export function MaintenanceProvider({
  children,
  refetchPlans,
  taskTable,
  taskRowSelection = {},
  setTaskRowSelection,
}: MaintenanceProviderProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user as AuthUser | null

  // Computed permissions
  const isRegionalLeader = isRegionalLeaderRole(user?.role)
  const canManagePlans = isEquipmentManagerRole(user?.role)
  const canCompleteTask = !isRegionalLeader && isEquipmentManagerRole(user?.role)

  // Plan selection state
  const [selectedPlan, setSelectedPlan] = React.useState<MaintenancePlan | null>(null)
  const [activeTab, setActiveTab] = React.useState("plans")

  // Dialog state
  const [dialogState, setDialogState] = React.useState<DialogState>({
    isAddPlanDialogOpen: false,
    editingPlan: null,
    isAddTasksDialogOpen: false,
    isBulkScheduleOpen: false,
    isConfirmingCancel: false,
    isConfirmingBulkDelete: false,
  })

  // Draft management state
  const [tasks, setTasks] = React.useState<MaintenanceTask[]>([])
  const [draftTasks, setDraftTasks] = React.useState<MaintenanceTask[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = React.useState(false)
  const [isSavingAll, setIsSavingAll] = React.useState(false)
  const [isDeletingTasks, setIsDeletingTasks] = React.useState(false)

  // Completion tracking
  const [completionStatus, setCompletionStatus] = React.useState<Record<string, CompletionStatusEntry>>({})
  const [isLoadingCompletion, setIsLoadingCompletion] = React.useState(false)
  const [isCompletingTask, setIsCompletingTask] = React.useState<string | null>(null)

  const getDraftCacheKey = React.useCallback((planId: number) => `maintenance_draft_${planId}`, [])

  const hasChanges = React.useMemo(() => {
    return JSON.stringify(tasks) !== JSON.stringify(draftTasks)
  }, [tasks, draftTasks])

  const isPlanApproved = selectedPlan?.trang_thai === 'Đã duyệt'

  // Task editing hook
  const taskEditing = useTaskEditing({
    draftTasks,
    setDraftTasks,
    canManagePlans,
    isPlanApproved,
  })

  // Operations hook
  const operations = useMaintenanceOperations({
    selectedPlan,
    setSelectedPlan,
    setActiveTab,
    getDraftCacheKey,
    user,
  })

  // Print hook
  const { generatePlanForm, isGenerating: isPrintGenerating } = useMaintenancePrint({
    selectedPlan,
    tasks,
    user,
  })

  // Dialog setters
  const setIsAddPlanDialogOpen = React.useCallback((open: boolean) => {
    setDialogState(prev => ({ ...prev, isAddPlanDialogOpen: open }))
  }, [])

  const setEditingPlan = React.useCallback((plan: MaintenancePlan | null) => {
    setDialogState(prev => ({ ...prev, editingPlan: plan }))
  }, [])

  const setIsAddTasksDialogOpen = React.useCallback((open: boolean) => {
    setDialogState(prev => ({ ...prev, isAddTasksDialogOpen: open }))
  }, [])

  const setIsBulkScheduleOpen = React.useCallback((open: boolean) => {
    setDialogState(prev => ({ ...prev, isBulkScheduleOpen: open }))
  }, [])

  const setIsConfirmingCancel = React.useCallback((open: boolean) => {
    setDialogState(prev => ({ ...prev, isConfirmingCancel: open }))
  }, [])

  const setIsConfirmingBulkDelete = React.useCallback((open: boolean) => {
    setDialogState(prev => ({ ...prev, isConfirmingBulkDelete: open }))
  }, [])

  // Fetch plan details
  const fetchPlanDetails = React.useCallback(async (plan: MaintenancePlan) => {
    setIsLoadingTasks(true)
    setCompletionStatus({})

    const cacheKey = getDraftCacheKey(plan.id)
    const cachedDraft = localStorage.getItem(cacheKey)

    try {
      const data = await callRpc<any[]>({
        fn: 'maintenance_tasks_list_with_equipment',
        args: {
          p_ke_hoach_id: plan.id,
          p_thiet_bi_id: null,
          p_loai_cong_viec: plan.loai_cong_viec,
          p_don_vi_thuc_hien: null
        }
      })
      const dbTasks = (data || []) as MaintenanceTask[]
      setTasks(dbTasks)

      if (cachedDraft) {
        try {
          setDraftTasks(JSON.parse(cachedDraft))
          toast({ title: "Thông báo", description: "Đã tải lại bản nháp chưa lưu của bạn." })
        } catch {
          setDraftTasks(dbTasks)
        }
      } else {
        setDraftTasks(dbTasks)
      }

      // If plan is approved, compute completion status
      if (plan.trang_thai === 'Đã duyệt') {
        setIsLoadingCompletion(true)
        const statusMap: Record<string, CompletionStatusEntry> = {}
        dbTasks.forEach((t: any) => {
          for (let m = 1; m <= 12; m++) {
            const completed = t[`thang_${m}_hoan_thanh`]
            const dateVal = t[`ngay_hoan_thanh_${m}`]
            if (completed && dateVal) {
              statusMap[`${t.id}-${m}`] = { historyId: 0 }
            }
          }
        })
        setCompletionStatus(statusMap)
        setIsLoadingCompletion(false)
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi tải công việc", description: error.message })
      setTasks([])
      setDraftTasks([])
    }
    setIsLoadingTasks(false)
  }, [getDraftCacheKey, toast])

  // Save drafts to localStorage
  React.useEffect(() => {
    if (selectedPlan && hasChanges) {
      localStorage.setItem(getDraftCacheKey(selectedPlan.id), JSON.stringify(draftTasks))
    }
    if (selectedPlan && !hasChanges) {
      localStorage.removeItem(getDraftCacheKey(selectedPlan.id))
    }
  }, [draftTasks, selectedPlan, hasChanges, getDraftCacheKey])

  // Cancel all changes
  const handleCancelAllChanges = React.useCallback(() => {
    setDraftTasks(tasks)
    if (selectedPlan) {
      localStorage.removeItem(getDraftCacheKey(selectedPlan.id))
    }
    setIsConfirmingCancel(false)
    toast({ title: "Đã hủy", description: "Mọi thay đổi chưa lưu đã được hủy bỏ." })
  }, [tasks, selectedPlan, getDraftCacheKey, toast, setIsConfirmingCancel])

  // Save all changes
  const handleSaveAllChanges = React.useCallback(async () => {
    if (!selectedPlan || !hasChanges) return
    setIsSavingAll(true)

    const tasksToInsert = draftTasks
      .filter(t => t.id < 0)
      .map(task => {
        const { id, thiet_bi, ...dbData } = task
        return dbData
      })

    const tasksToUpdate = draftTasks
      .filter(t => t.id > 0 && tasks.find(original =>
        original.id === t.id && JSON.stringify(original) !== JSON.stringify(t)
      ))
      .map(task => {
        const { thiet_bi, ...dbData } = task
        return dbData
      })

    const draftTaskIds = new Set(draftTasks.map(t => t.id))
    const idsToDelete = tasks.map(t => t.id).filter(id => !draftTaskIds.has(id))

    let hasError = false

    if (tasksToInsert.length > 0) {
      try {
        await callRpc<void>({ fn: 'maintenance_tasks_bulk_insert', args: { p_tasks: tasksToInsert } as any })
      } catch (e: any) {
        toast({ variant: "destructive", title: "Lỗi thêm công việc mới", description: e.message, duration: 10000 })
        hasError = true
      }
    }

    if (tasksToUpdate.length > 0 && !hasError) {
      for (const taskToUpdate of tasksToUpdate) {
        try {
          await callRpc<void>({ fn: 'maintenance_task_update', args: { p_id: taskToUpdate.id, p_task: taskToUpdate } as any })
        } catch (e: any) {
          toast({ variant: "destructive", title: `Lỗi cập nhật công việc ID ${taskToUpdate.id}`, description: e.message, duration: 10000 })
          hasError = true
          break
        }
      }
    }

    if (idsToDelete.length > 0 && !hasError) {
      try {
        await callRpc<void>({ fn: 'maintenance_tasks_delete', args: { p_ids: idsToDelete } as any })
      } catch (e: any) {
        toast({ variant: "destructive", title: "Lỗi xóa công việc cũ", description: e.message, duration: 10000 })
        hasError = true
      }
    }

    if (!hasError) {
      toast({ title: "Thành công", description: "Đã lưu tất cả thay đổi vào cơ sở dữ liệu." })
      localStorage.removeItem(getDraftCacheKey(selectedPlan.id))
      await fetchPlanDetails(selectedPlan)
    }

    setIsSavingAll(false)
  }, [selectedPlan, hasChanges, draftTasks, tasks, toast, getDraftCacheKey, fetchPlanDetails])

  // Mark task as completed
  const handleMarkAsCompleted = React.useCallback(async (task: MaintenanceTask, month: number) => {
    if (!selectedPlan || !user || !canCompleteTask) {
      toast({ variant: "destructive", title: "Không có quyền", description: "Bạn không có quyền thực hiện hành động này." })
      return
    }

    const completionKey = `${task.id}-${month}`
    if (completionStatus[completionKey] || isCompletingTask) return

    setIsCompletingTask(completionKey)

    try {
      await callRpc<void>({ fn: 'maintenance_task_complete', args: { p_task_id: task.id, p_month: month } })

      toast({
        title: "Ghi nhận thành công",
        description: `Đã ghi nhận hoàn thành ${selectedPlan.loai_cong_viec} cho thiết bị tháng ${month}.`,
      })

      setCompletionStatus(prev => ({
        ...prev,
        [completionKey]: { historyId: 0 },
      }))

      await fetchPlanDetails(selectedPlan)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: "Không thể ghi nhận hoàn thành. " + error.message })
    } finally {
      setIsCompletingTask(null)
    }
  }, [selectedPlan, user, canCompleteTask, completionStatus, isCompletingTask, toast, fetchPlanDetails])

  // Select plan handler
  const handleSelectPlan = React.useCallback((plan: MaintenancePlan) => {
    if (hasChanges && selectedPlan) {
      if (confirm(`Bạn có các thay đổi chưa lưu trong kế hoạch "${selectedPlan.ten_ke_hoach}". Bạn có muốn hủy các thay đổi và chuyển sang kế hoạch khác không?`)) {
        handleCancelAllChanges()
        setSelectedPlan(plan)
        setActiveTab("tasks")
      } else {
        setActiveTab("tasks")
        return
      }
    } else {
      setSelectedPlan(plan)
      setActiveTab("tasks")
    }
  }, [hasChanges, selectedPlan, handleCancelAllChanges])

  // Add tasks from dialog
  const existingEquipmentIdsInDraft = React.useMemo(() =>
    draftTasks.map(task => task.thiet_bi_id).filter((id): id is number => id !== null),
    [draftTasks]
  )

  const handleAddTasksFromDialog = React.useCallback((newlySelectedEquipment: Equipment[]) => {
    if (!selectedPlan) return

    let tempIdCounter = Math.min(-1, ...draftTasks.map(t => t.id).filter(id => id < 0), 0) - 1

    const tasksToAdd: MaintenanceTask[] = newlySelectedEquipment.map((equipment) => ({
      id: tempIdCounter--,
      ke_hoach_id: selectedPlan.id,
      thiet_bi_id: equipment.id,
      loai_cong_viec: selectedPlan.loai_cong_viec as any,
      diem_hieu_chuan: null,
      don_vi_thuc_hien: null,
      thang_1: false, thang_2: false, thang_3: false, thang_4: false,
      thang_5: false, thang_6: false, thang_7: false, thang_8: false,
      thang_9: false, thang_10: false, thang_11: false, thang_12: false,
      ghi_chu: null,
      thiet_bi: {
        ma_thiet_bi: equipment.ma_thiet_bi,
        ten_thiet_bi: equipment.ten_thiet_bi,
        khoa_phong_quan_ly: equipment.khoa_phong_quan_ly,
      },
    }))

    setDraftTasks(currentDrafts => [...currentDrafts, ...tasksToAdd])
    setIsAddTasksDialogOpen(false)
    toast({
      title: "Đã thêm vào bản nháp",
      description: `Đã thêm ${newlySelectedEquipment.length} thiết bị. Nhấn "Lưu thay đổi" để xác nhận.`,
    })
  }, [selectedPlan, draftTasks, toast, setIsAddTasksDialogOpen])

  // Plan mutation success callback
  const onPlanMutationSuccess = React.useCallback(() => {
    refetchPlans()
  }, [refetchPlans])

  // Bulk operations
  const handleBulkScheduleApply = React.useCallback((months: Record<string, boolean>) => {
    if (!taskTable) return
    const selectedIds = new Set(taskTable.getFilteredSelectedRowModel().rows.map(row => row.original.id))
    setDraftTasks(currentDrafts =>
      currentDrafts.map(task =>
        selectedIds.has(task.id) ? { ...task, ...months } : task
      )
    )
    setIsBulkScheduleOpen(false)
    toast({ title: "Đã áp dụng lịch", description: "Lịch trình đã được cập nhật vào bản nháp." })
  }, [taskTable, toast, setIsBulkScheduleOpen])

  const handleBulkAssignUnit = React.useCallback((unit: string | null) => {
    if (!taskTable) return
    const selectedIds = new Set(taskTable.getFilteredSelectedRowModel().rows.map(row => row.original.id))
    setDraftTasks(currentDrafts =>
      currentDrafts.map(task =>
        selectedIds.has(task.id) ? { ...task, don_vi_thuc_hien: unit } : task
      )
    )
    toast({ title: "Đã gán đơn vị", description: "Đã cập nhật đơn vị thực hiện vào bản nháp." })
  }, [taskTable, toast])

  // Computed selected task count
  const selectedTaskRowsCount = Object.keys(taskRowSelection).length

  // Delete operations
  const confirmDeleteSingleTask = React.useCallback(() => {
    const toDelete = taskEditing.taskToDelete
    if (!toDelete) return
    setIsDeletingTasks(true)
    setDraftTasks(currentDrafts => currentDrafts.filter(task => task.id !== toDelete.id))
    taskEditing.setTaskToDelete(null)
    setIsDeletingTasks(false)
    toast({ title: "Đã xóa khỏi bản nháp" })
  }, [taskEditing, toast])

  const confirmDeleteSelectedTasks = React.useCallback(() => {
    if (!taskTable || Object.keys(taskRowSelection).length === 0) return
    setIsDeletingTasks(true)
    const tableModel = taskTable.getRowModel()
    const idsToDelete = Object.keys(taskRowSelection).map(idx => tableModel.rows[parseInt(idx, 10)].original.id)
    setDraftTasks(currentDrafts => currentDrafts.filter(task => !idsToDelete.includes(task.id)))
    setTaskRowSelection?.({})
    setIsConfirmingBulkDelete(false)
    setIsDeletingTasks(false)
    toast({ title: "Đã xóa khỏi bản nháp", description: `Đã xóa ${idsToDelete.length} công việc.` })
  }, [taskTable, taskRowSelection, toast, setTaskRowSelection, setIsConfirmingBulkDelete])

  const value = React.useMemo<MaintenanceContextValue>(() => ({
    // Auth
    user,
    isRegionalLeader,
    canManagePlans,
    canCompleteTask,

    // Plan state
    selectedPlan,
    setSelectedPlan,
    activeTab,
    setActiveTab,

    // Dialog state & actions
    dialogState,
    setIsAddPlanDialogOpen,
    setEditingPlan,
    setIsAddTasksDialogOpen,
    setIsBulkScheduleOpen,
    setIsConfirmingCancel,
    setIsConfirmingBulkDelete,

    // Draft management
    tasks,
    draftTasks,
    setDraftTasks,
    hasChanges,
    isLoadingTasks,
    isSavingAll,
    fetchPlanDetails,
    handleSaveAllChanges,
    handleCancelAllChanges,
    getDraftCacheKey,

    // Task editing
    taskEditing,

    // Completion tracking
    completionStatus,
    isLoadingCompletion,
    isCompletingTask,
    handleMarkAsCompleted,

    // Operations
    operations,

    // Print
    generatePlanForm,
    isPrintGenerating,

    // Helpers
    existingEquipmentIdsInDraft,
    handleAddTasksFromDialog,
    handleSelectPlan,
    onPlanMutationSuccess,
    handleBulkScheduleApply,
    handleBulkAssignUnit,
    confirmDeleteSingleTask,
    confirmDeleteSelectedTasks,
    isDeletingTasks,
    isPlanApproved,
    selectedTaskRowsCount,
    taskRowSelection,
    setTaskRowSelection: setTaskRowSelection || (() => {}),
  }), [
    user,
    isRegionalLeader,
    canManagePlans,
    canCompleteTask,
    selectedPlan,
    activeTab,
    dialogState,
    setIsAddPlanDialogOpen,
    setEditingPlan,
    setIsAddTasksDialogOpen,
    setIsBulkScheduleOpen,
    setIsConfirmingCancel,
    setIsConfirmingBulkDelete,
    tasks,
    draftTasks,
    hasChanges,
    isLoadingTasks,
    isSavingAll,
    fetchPlanDetails,
    handleSaveAllChanges,
    handleCancelAllChanges,
    getDraftCacheKey,
    taskEditing,
    completionStatus,
    isLoadingCompletion,
    isCompletingTask,
    handleMarkAsCompleted,
    operations,
    generatePlanForm,
    isPrintGenerating,
    existingEquipmentIdsInDraft,
    handleAddTasksFromDialog,
    handleSelectPlan,
    onPlanMutationSuccess,
    handleBulkScheduleApply,
    handleBulkAssignUnit,
    confirmDeleteSingleTask,
    confirmDeleteSelectedTasks,
    isDeletingTasks,
    isPlanApproved,
    selectedTaskRowsCount,
    taskRowSelection,
    setTaskRowSelection,
  ])

  return (
    <MaintenanceContext.Provider value={value}>
      {children}
    </MaintenanceContext.Provider>
  )
}
