"use client"

import * as React from "react"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Check, X, Edit, Trash2 } from "lucide-react"
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
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"

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

export function useTaskColumns() {
  return []
}
