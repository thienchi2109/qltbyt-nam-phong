"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { AddMaintenancePlanDialog } from "@/components/add-maintenance-plan-dialog"
import { EditMaintenancePlanDialog } from "@/components/edit-maintenance-plan-dialog"
import { AddTasksDialog } from "@/components/add-tasks-dialog"
import { BulkScheduleDialog } from "@/components/bulk-schedule-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { MaintenancePlan as DialogMaintenancePlan } from "@/lib/data"
import { useMaintenanceContext } from "../_hooks/useMaintenanceContext"

export function MaintenanceDialogs() {
  const ctx = useMaintenanceContext()

  const {
    dialogState,
    setIsAddPlanDialogOpen,
    setEditingPlan,
    setIsAddTasksDialogOpen,
    setIsBulkScheduleOpen,
    setIsConfirmingCancel,
    setIsConfirmingBulkDelete,
    selectedPlan,
    selectedTaskRowsCount,
    existingEquipmentIdsInDraft,
    onPlanMutationSuccess,
    handleAddTasksFromDialog,
    handleBulkScheduleApply,
    handleCancelAllChanges,
    confirmDeleteSingleTask,
    confirmDeleteSelectedTasks,
    taskEditing,
    operations,
    isDeletingTasks,
  } = ctx

  const { taskToDelete, setTaskToDelete } = taskEditing
  const editDialogPlan = React.useMemo<DialogMaintenancePlan | null>(() => {
    if (!dialogState.editingPlan) {
      return null
    }
    return {
      ...dialogState.editingPlan,
      facility_name: dialogState.editingPlan.facility_name ?? undefined,
    }
  }, [dialogState.editingPlan])

  const addTasksDialogPlan = React.useMemo<DialogMaintenancePlan | null>(() => {
    if (!selectedPlan) {
      return null
    }
    return {
      ...selectedPlan,
      facility_name: selectedPlan.facility_name ?? undefined,
    }
  }, [selectedPlan])

  return (
    <>
      <AddMaintenancePlanDialog
        open={dialogState.isAddPlanDialogOpen}
        onOpenChange={setIsAddPlanDialogOpen}
        onSuccess={onPlanMutationSuccess}
      />
      <EditMaintenancePlanDialog
        open={!!dialogState.editingPlan}
        onOpenChange={(open) => !open && setEditingPlan(null)}
        onSuccess={onPlanMutationSuccess}
        plan={editDialogPlan}
      />
      {/* Approve Dialog */}
      <AlertDialog open={operations.confirmDialog.type === 'approve'} onOpenChange={(open) => !open && operations.closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn duyệt kế hoạch này?</AlertDialogTitle>
            <AlertDialogDescription>
              Sau khi duyệt, kế hoạch <strong>{operations.confirmDialog.plan?.ten_ke_hoach}</strong> sẽ bị khóa. Bạn sẽ không thể thêm, sửa, hoặc xóa công việc khỏi kế hoạch này nữa. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {operations.confirmDialog.plan?.nguoi_duyet && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-blue-800">Đã được duyệt bởi:</div>
              <div className="text-sm text-blue-600">{operations.confirmDialog.plan.nguoi_duyet}</div>
              {operations.confirmDialog.plan.ngay_phe_duyet && (
                <div className="text-xs text-blue-500">
                  {format(parseISO(operations.confirmDialog.plan.ngay_phe_duyet), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={operations.isApproving}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={operations.handleApprovePlan} disabled={operations.isApproving}>
              {operations.isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận duyệt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Reject Dialog */}
      <AlertDialog open={operations.confirmDialog.type === 'reject'} onOpenChange={(open) => !open && operations.closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Không duyệt kế hoạch</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn đang từ chối kế hoạch <strong>{operations.confirmDialog.plan?.ten_ke_hoach}</strong>. Vui lòng nhập lý do không duyệt:
            </AlertDialogDescription>
          </AlertDialogHeader>
          {operations.confirmDialog.plan?.nguoi_duyet && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="text-sm font-medium text-red-800">Đã được từ chối bởi:</div>
              <div className="text-sm text-red-600">{operations.confirmDialog.plan.nguoi_duyet}</div>
              {operations.confirmDialog.plan.ngay_phe_duyet && (
                <div className="text-xs text-red-500">
                  {format(parseISO(operations.confirmDialog.plan.ngay_phe_duyet), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </div>
              )}
            </div>
          )}
          <div className="py-4">
            <textarea
              className="w-full min-h-[100px] p-3 border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="Nhập lý do không duyệt kế hoạch này..."
              value={operations.confirmDialog.rejectionReason}
              onChange={(e) => operations.setRejectionReason(e.target.value)}
              disabled={operations.isRejecting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={operations.isRejecting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={operations.handleRejectPlan}
              disabled={operations.isRejecting || !operations.confirmDialog.rejectionReason?.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {operations.isRejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận không duyệt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BulkScheduleDialog
        open={dialogState.isBulkScheduleOpen}
        onOpenChange={setIsBulkScheduleOpen}
        onApply={handleBulkScheduleApply}
      />
      {/* Delete Dialog */}
      <AlertDialog open={operations.confirmDialog.type === 'delete'} onOpenChange={(open) => !open && operations.closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Kế hoạch
              <strong> {operations.confirmDialog.plan?.ten_ke_hoach} </strong>
              sẽ bị xóa vĩnh viễn, bao gồm tất cả công việc liên quan. Mọi bản nháp chưa lưu cũng sẽ bị xóa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={operations.isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={operations.handleDeletePlan} disabled={operations.isDeleting} className="bg-destructive hover:bg-destructive/90">
              {operations.isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {(taskToDelete || dialogState.isConfirmingBulkDelete) && (
        <AlertDialog open={!!taskToDelete || dialogState.isConfirmingBulkDelete} onOpenChange={(open) => {
          if (!open) {
            setTaskToDelete(null)
            setIsConfirmingBulkDelete(false)
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
              <AlertDialogDescription>
                {taskToDelete ? `Hành động này sẽ xóa công việc của thiết bị "${taskToDelete.thiet_bi?.ten_thiet_bi}" khỏi bản nháp.` : `Hành động này sẽ xóa ${selectedTaskRowsCount} công việc đã chọn khỏi bản nháp.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingTasks}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={taskToDelete ? confirmDeleteSingleTask : confirmDeleteSelectedTasks}
                disabled={isDeletingTasks}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeletingTasks && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {dialogState.isConfirmingCancel && (
        <AlertDialog open={dialogState.isConfirmingCancel} onOpenChange={setIsConfirmingCancel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hủy bỏ mọi thay đổi?</AlertDialogTitle>
              <AlertDialogDescription>
                Hành động này sẽ loại bỏ tất cả các thay đổi bạn đã thực hiện trong bản nháp này và khôi phục lại dữ liệu gốc.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Ở lại</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelAllChanges}>Xác nhận hủy</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <AddTasksDialog
        open={dialogState.isAddTasksDialogOpen}
        onOpenChange={setIsAddTasksDialogOpen}
        plan={addTasksDialogPlan}
        existingEquipmentIds={existingEquipmentIdsInDraft}
        onSuccess={handleAddTasksFromDialog}
      />
    </>
  )
}
