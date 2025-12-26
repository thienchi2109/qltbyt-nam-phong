"use client"

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
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"

export interface MaintenanceDialogsProps {
  // Dialog triggers (controlled by parent)
  isAddPlanDialogOpen: boolean
  setIsAddPlanDialogOpen: (open: boolean) => void
  editingPlan: MaintenancePlan | null
  setEditingPlan: (plan: MaintenancePlan | null) => void
  isAddTasksDialogOpen: boolean
  setIsAddTasksDialogOpen: (open: boolean) => void
  isBulkScheduleOpen: boolean
  setIsBulkScheduleOpen: (open: boolean) => void
  isConfirmingCancel: boolean
  setIsConfirmingCancel: (open: boolean) => void
  isConfirmingBulkDelete: boolean
  setIsConfirmingBulkDelete: (open: boolean) => void

  // Data references
  selectedPlan: MaintenancePlan | null
  draftTasks: MaintenanceTask[]
  selectedTaskRowsCount: number
  existingEquipmentIdsInDraft: number[]

  // Handlers (from hooks or parent)
  onAddPlanSuccess: () => void
  onEditPlanSuccess: () => void
  onAddTasksSuccess: () => void
  onBulkScheduleApply: (months: Record<string, boolean>) => void
  onCancelConfirm: () => void
  confirmDeleteSingleTask: () => void
  confirmDeleteSelectedTasks: () => void
  taskToDelete: MaintenanceTask | null
  setTaskToDelete: (task: MaintenanceTask | null) => void

  // Operations state (for approve/reject/delete dialogs)
  operations: {
    confirmDialog: {
      type: 'approve' | 'reject' | 'delete' | null
      plan?: MaintenancePlan
      rejectionReason?: string
    }
    isApproving: boolean
    isRejecting: boolean
    isDeleting: boolean
    closeDialog: () => void
    setRejectionReason: (reason: string) => void
    handleApprovePlan: () => void
    handleRejectPlan: () => void
    handleDeletePlan: () => void
  }

  // Additional state
  isDeletingTasks: boolean
}

export function MaintenanceDialogs(props: MaintenanceDialogsProps) {
  const {
    isAddPlanDialogOpen,
    setIsAddPlanDialogOpen,
    editingPlan,
    setEditingPlan,
    isAddTasksDialogOpen,
    setIsAddTasksDialogOpen,
    isBulkScheduleOpen,
    setIsBulkScheduleOpen,
    isConfirmingCancel,
    setIsConfirmingCancel,
    isConfirmingBulkDelete,
    setIsConfirmingBulkDelete,
    selectedPlan,
    draftTasks,
    selectedTaskRowsCount,
    existingEquipmentIdsInDraft,
    onAddPlanSuccess,
    onEditPlanSuccess,
    onAddTasksSuccess,
    onBulkScheduleApply,
    onCancelConfirm,
    confirmDeleteSingleTask,
    confirmDeleteSelectedTasks,
    taskToDelete,
    setTaskToDelete,
    operations,
    isDeletingTasks,
  } = props

  return (
    <>
      <AddMaintenancePlanDialog
        open={isAddPlanDialogOpen}
        onOpenChange={setIsAddPlanDialogOpen}
        onSuccess={onAddPlanSuccess}
      />
      <EditMaintenancePlanDialog
        open={!!editingPlan}
        onOpenChange={(open) => !open && setEditingPlan(null)}
        onSuccess={onEditPlanSuccess}
        plan={editingPlan as any}
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
        open={isBulkScheduleOpen}
        onOpenChange={setIsBulkScheduleOpen}
        onApply={onBulkScheduleApply}
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
      {(taskToDelete || isConfirmingBulkDelete) && (
        <AlertDialog open={!!taskToDelete || isConfirmingBulkDelete} onOpenChange={(open) => {
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
      {isConfirmingCancel && (
        <AlertDialog open={isConfirmingCancel} onOpenChange={setIsConfirmingCancel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hủy bỏ mọi thay đổi?</AlertDialogTitle>
              <AlertDialogDescription>
                Hành động này sẽ loại bỏ tất cả các thay đổi bạn đã thực hiện trong bản nháp này và khôi phục lại dữ liệu gốc.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Ở lại</AlertDialogCancel>
              <AlertDialogAction onClick={onCancelConfirm}>Xác nhận hủy</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <AddTasksDialog
        open={isAddTasksDialogOpen}
        onOpenChange={setIsAddTasksDialogOpen}
        plan={selectedPlan as any}
        existingEquipmentIds={existingEquipmentIdsInDraft}
        onSuccess={onAddTasksSuccess}
      />
    </>
  )
}
