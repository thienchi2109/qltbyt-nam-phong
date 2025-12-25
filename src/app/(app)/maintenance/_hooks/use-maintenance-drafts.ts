"use client"

import * as React from "react"
import { callRpc } from "@/lib/rpc-client"
import { useToast } from "@/hooks/use-toast"
import type { MaintenanceTask } from "@/lib/data"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"

interface UseMaintenanceDraftsParams {
  selectedPlan: MaintenancePlan | null
  onSaveSuccess?: () => void
}

export function useMaintenanceDrafts({
  selectedPlan,
  onSaveSuccess,
}: UseMaintenanceDraftsParams) {
  const { toast } = useToast()

  const [tasks, setTasks] = React.useState<MaintenanceTask[]>([])
  const [draftTasks, setDraftTasks] = React.useState<MaintenanceTask[]>([])
  const [isSaving, setIsSaving] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  const getDraftCacheKey = React.useCallback(
    (planId: number) => `maintenance_draft_${planId}`,
    []
  )

  const hasChanges = React.useMemo(() => {
    return JSON.stringify(tasks) !== JSON.stringify(draftTasks)
  }, [tasks, draftTasks])

  // Sync drafts to localStorage
  React.useEffect(() => {
    if (selectedPlan && hasChanges) {
      const cacheKey = getDraftCacheKey(selectedPlan.id)
      localStorage.setItem(cacheKey, JSON.stringify(draftTasks))
    }
    if (selectedPlan && !hasChanges) {
      const cacheKey = getDraftCacheKey(selectedPlan.id)
      localStorage.removeItem(cacheKey)
    }
  }, [draftTasks, selectedPlan, hasChanges, getDraftCacheKey])

  // Fetch tasks when plan changes
  const fetchTasks = React.useCallback(async (plan: MaintenancePlan) => {
    setIsLoading(true)
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
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi tải công việc", description: error.message })
      setTasks([])
      setDraftTasks([])
    }
    setIsLoading(false)
  }, [getDraftCacheKey, toast])

  // Save all changes
  const saveAllChanges = React.useCallback(async () => {
    if (!selectedPlan || !hasChanges) return
    setIsSaving(true)

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
    const idsToDelete = tasks
      .map(t => t.id)
      .filter(id => !draftTaskIds.has(id))

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
      await fetchTasks(selectedPlan)
      onSaveSuccess?.()
    }

    setIsSaving(false)
  }, [selectedPlan, hasChanges, draftTasks, tasks, toast, getDraftCacheKey, fetchTasks, onSaveSuccess])

  // Cancel all changes
  const cancelAllChanges = React.useCallback(() => {
    setDraftTasks(tasks)
    if (selectedPlan) {
      localStorage.removeItem(getDraftCacheKey(selectedPlan.id))
    }
    toast({ title: "Đã hủy", description: "Mọi thay đổi chưa lưu đã được hủy bỏ." })
  }, [tasks, selectedPlan, getDraftCacheKey, toast])

  return {
    // State
    tasks,
    draftTasks,
    setDraftTasks,
    hasChanges,
    isLoading,
    isSaving,

    // Actions
    fetchTasks,
    saveAllChanges,
    cancelAllChanges,
    getDraftCacheKey,
  }
}
