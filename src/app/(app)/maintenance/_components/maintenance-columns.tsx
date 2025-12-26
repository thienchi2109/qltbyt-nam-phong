"use client"

import * as React from "react"
import type { ColumnDef, SortingState, Row } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Check, X, Edit, Trash2, Save, CheckCircle2, Loader2 } from "lucide-react"
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
import { NotesInput } from "./notes-input"

export interface TableMeta {
  editingTaskId: number | null
  editingTaskData: Partial<MaintenanceTask> | null
  handleTaskDataChange: (field: keyof MaintenanceTask, value: unknown) => void
  handleSaveTask: () => void
  handleCancelEdit: () => void
  handleStartEdit: (task: MaintenanceTask) => void
  isPlanApproved: boolean
  setTaskToDelete: (task: MaintenanceTask | null) => void
  completionStatus: Record<string, { historyId: number }>
  isLoadingCompletion: boolean
  handleMarkAsCompleted: (task: MaintenanceTask, month: number) => void
  isCompletingTask: string | null
  canCompleteTask: boolean
}

export interface PlanColumnOptions {
  sorting: SortingState
  setSorting: (sorting: SortingState) => void
  onRowClick: (plan: MaintenancePlan) => void
  openApproveDialog: (plan: MaintenancePlan) => void
  openRejectDialog: (plan: MaintenancePlan) => void
  openDeleteDialog: (plan: MaintenancePlan) => void
  canManagePlans: boolean
  isRegionalLeader: boolean
}

// Helper function for status badge variants
const getStatusVariant = (status: MaintenancePlan["trang_thai"]) => {
  switch (status) {
    case "Bản nháp":
      return "secondary"
    case "Đã duyệt":
      return "default"
    case "Không duyệt":
      return "destructive"
    default:
      return "outline"
  }
}

export function usePlanColumns(options: PlanColumnOptions): ColumnDef<MaintenancePlan>[] {
  const {
    onRowClick,
    openApproveDialog,
    openRejectDialog,
    openDeleteDialog,
    canManagePlans,
  } = options

  const planColumns: ColumnDef<MaintenancePlan>[] = [
    {
      accessorKey: "ten_ke_hoach",
      header: "Tên kế hoạch",
      cell: ({ row }) => <div className="font-medium">{row.getValue("ten_ke_hoach")}</div>,
    },
    {
      accessorKey: "nguoi_lap_ke_hoach",
      header: "Người lập",
      cell: ({ row }) => {
        const nguoiLap = row.getValue("nguoi_lap_ke_hoach") as string | null;
        return nguoiLap ? (
          <div className="text-sm">{nguoiLap}</div>
        ) : (
          <span className="text-muted-foreground italic text-xs">Chưa có</span>
        );
      },
    },
    {
      accessorKey: "nam",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Năm
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="text-center">{row.getValue("nam")}</div>
    },
    {
      accessorKey: "khoa_phong",
      header: "Khoa/Phòng",
      cell: ({ row }) => row.getValue("khoa_phong") || <span className="text-muted-foreground italic">Tổng thể</span>,
    },
    {
      accessorKey: "loai_cong_viec",
      header: "Loại CV",
      cell: ({ row }) => <Badge variant="outline">{row.getValue("loai_cong_viec")}</Badge>,
    },
    {
      accessorKey: "trang_thai",
      header: "Trạng thái",
      cell: ({ row }) => {
        const status = row.getValue("trang_thai") as MaintenancePlan["trang_thai"]
        const plan = row.original
        return (
          <div className="space-y-1">
            <Badge variant={getStatusVariant(status)}>{status}</Badge>
            {status === "Không duyệt" && plan.ly_do_khong_duyet && (
              <div className="text-xs text-muted-foreground italic max-w-[200px] break-words">
                Lý do: {plan.ly_do_khong_duyet}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "ngay_phe_duyet",
      header: "Ngày phê duyệt",
      cell: ({ row }) => {
        const date = row.getValue("ngay_phe_duyet") as string | null
        const plan = row.original
        return date ? (
          <div className="space-y-1">
            <div>{format(parseISO(date), 'dd/MM/yyyy HH:mm', { locale: vi })}</div>
            {plan.nguoi_duyet && (
              <div className="text-xs text-blue-600 font-medium">
                Duyệt: {plan.nguoi_duyet}
              </div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground italic">Chưa duyệt</span>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const plan = row.original
        const canManage = canManagePlans;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="sr-only">Mở menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Hành động</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onRowClick(plan)}>
                Xem chi tiết công việc
              </DropdownMenuItem>
              {plan.trang_thai === 'Bản nháp' && (
                <>
                  <DropdownMenuSeparator />
                  {canManage && (
                    <>
                      <DropdownMenuItem onSelect={() => openApproveDialog(plan)}>
                        <Check className="mr-2 h-4 w-4" />
                        Duyệt
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openRejectDialog(plan)}>
                        <X className="mr-2 h-4 w-4" />
                        Không duyệt
                      </DropdownMenuItem>
                    </>
                  )}
                  {canManage && (
                    <>
                      <DropdownMenuItem onSelect={() => {/* setEditingPlan(plan) */}}>
                        <Edit className="mr-2 h-4 w-4" />
                        Sửa
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => openDeleteDialog(plan)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Xoá
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return planColumns
}

export interface TaskColumnOptions {
  editingTaskId: number | null
  handleStartEdit: (task: MaintenanceTask) => void
  handleCancelEdit: () => void
  handleTaskDataChange: (field: keyof MaintenanceTask, value: unknown) => void
  handleSaveTask: () => void
  setTaskToDelete: (task: MaintenanceTask | null) => void
  canManagePlans: boolean
  isPlanApproved: boolean
  canCompleteTask: boolean
  handleMarkAsCompleted: (task: MaintenanceTask, month: number) => void
  isCompletingTask: string | null
  completionStatus: Record<string, { historyId: number }>
  isLoadingCompletion: boolean
  selectedPlan: MaintenancePlan | null
}

export function useTaskColumns(options: TaskColumnOptions): ColumnDef<MaintenanceTask>[] {
  const {
    editingTaskId,
    handleStartEdit,
    handleCancelEdit,
    handleTaskDataChange,
    handleSaveTask,
    setTaskToDelete,
    canManagePlans,
    isPlanApproved,
    canCompleteTask,
    handleMarkAsCompleted,
    isCompletingTask,
    completionStatus,
    isLoadingCompletion,
  } = options

  const taskColumns: ColumnDef<MaintenanceTask>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          disabled={isPlanApproved || !!editingTaskId}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          disabled={isPlanApproved || !!editingTaskId}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      id: 'stt',
      header: 'STT',
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;
        return pageIndex * pageSize + row.index + 1;
      },
      size: 50,
    },
    {
      accessorKey: 'thiet_bi.ma_thiet_bi',
      header: 'Mã TB',
      cell: ({ row }) => row.original.thiet_bi?.ma_thiet_bi || '',
      size: 120,
    },
    {
      accessorKey: 'thiet_bi.ten_thiet_bi',
      header: 'Tên thiết bị',
      cell: ({ row }) => row.original.thiet_bi?.ten_thiet_bi || '',
      size: 250,
    },
    {
      accessorKey: 'loai_cong_viec',
      header: 'Loại CV',
      cell: ({ row }) => <Badge variant="outline">{row.getValue("loai_cong_viec")}</Badge>,
      size: 140,
    },
    ...Array.from({ length: 12 }, (_, i) => i + 1).map((month) => ({
      id: `thang_${month}`,
      header: () => <div className="text-center">{month}</div>,
      cell: ({ row, table }: { row: Row<MaintenanceTask>, table: any }) => {
        const meta = table.options.meta as TableMeta;
        const {
          editingTaskId, editingTaskData, handleTaskDataChange,
          isPlanApproved, completionStatus, isLoadingCompletion,
          handleMarkAsCompleted, isCompletingTask, canCompleteTask,
        } = meta;
        const fieldName = `thang_${month}` as keyof MaintenanceTask;

        if (isPlanApproved) {
          const isScheduled = !!row.original[fieldName];
          if (!isScheduled) return null;

          if (isLoadingCompletion) return <Skeleton className="h-4 w-4 mx-auto" />;

          // Check completion status from actual database field
          const completionFieldName = `thang_${month}_hoan_thanh` as keyof MaintenanceTask;
          const isCompletedFromDB = !!row.original[completionFieldName];

          const completionKey = `${row.original.id}-${month}`;
          const isUpdating = isCompletingTask === completionKey;

          if (isUpdating) {
            return (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            );
          }

          if (isCompletedFromDB) {
            const completionDateField = `ngay_hoan_thanh_${month}` as keyof MaintenanceTask;
            const completionDate = row.original[completionDateField] as string;
            const formattedDate = completionDate ? new Date(completionDate).toLocaleDateString('vi-VN') : '';

            return (
              <div className="flex justify-center items-center h-full">
                <div title={`Đã hoàn thành${formattedDate ? ` ngày ${formattedDate}` : ''}`}>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
              </div>
            );
          }

          // Interactive checkbox for scheduled but not completed tasks
          return (
            <div className="flex justify-center items-center h-full">
              <Checkbox
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleMarkAsCompleted(row.original, month);
                  }
                }}
                disabled={!canCompleteTask}
                title={canCompleteTask ? "Nhấp để ghi nhận hoàn thành" : "Bạn không có quyền thực hiện"}
              />
            </div>
          );
        }

        // Draft mode logic
        const isEditing = editingTaskId === row.original.id;
        const isChecked = isEditing ? editingTaskData?.[fieldName] : row.original[fieldName];
        return (
          <div className="flex justify-center items-center h-full">
            <Checkbox
              key={`checkbox-${row.original.id}-${fieldName}`}
              checked={!!isChecked}
              onCheckedChange={(value) => isEditing && handleTaskDataChange(fieldName, !!value)}
              disabled={!isEditing}
            />
          </div>
        );
      },
      size: 40,
    })),
    {
      accessorKey: 'don_vi_thuc_hien',
      header: 'Đơn vị TH',
      cell: ({ row, table }) => {
        const meta = table.options.meta as TableMeta;
        const { editingTaskId, editingTaskData, handleTaskDataChange } = meta;
        const isEditing = editingTaskId === row.original.id;
        return isEditing ? (
          <Select
            key={`select-don-vi-${row.original.id}`}
            value={editingTaskData?.don_vi_thuc_hien || ""}
            onValueChange={(value) => handleTaskDataChange('don_vi_thuc_hien', value === 'none' ? null : value)}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Chọn đơn vị" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Nội bộ">Nội bộ</SelectItem>
              <SelectItem value="Thuê ngoài">Thuê ngoài</SelectItem>
              <SelectItem value="none">Xóa</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          row.original.don_vi_thuc_hien
        )
      },
      size: 150,
    },
    {
      accessorKey: 'ghi_chu',
      header: 'Ghi chú',
      cell: ({ row, table }) => {
        const meta = table.options.meta as TableMeta;
        const { editingTaskId, editingTaskData, handleTaskDataChange } = meta;
        const isEditing = editingTaskId === row.original.id;

        if (!isEditing) {
          return row.original.ghi_chu;
        }

        return (
          <NotesInput
            taskId={row.original.id}
            value={editingTaskData?.ghi_chu || ""}
            onChange={(value) => handleTaskDataChange('ghi_chu', value)}
          />
        );
      },
      size: 200,
    },
    {
      id: "actions",
      cell: ({ row, table }) => {
        const meta = table.options.meta as TableMeta;
        const { editingTaskId, handleSaveTask, handleCancelEdit, handleStartEdit, isPlanApproved, setTaskToDelete } = meta;
        const task = row.original;
        const isEditing = editingTaskId === task.id;

        if (isPlanApproved) return null;

        if (isEditing) {
          return (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700" onClick={handleSaveTask}>
                <Save className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600 hover:bg-gray-100" onClick={handleCancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        }

        return (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartEdit(task)} disabled={!!editingTaskId}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setTaskToDelete(task)} disabled={!!editingTaskId}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
      size: 100,
    }
  ]

  return taskColumns
}
