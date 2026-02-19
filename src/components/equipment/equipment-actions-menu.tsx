/**
 * equipment-actions-menu.tsx
 *
 * Dropdown menu for per-row equipment actions.
 * Includes view details, usage logging, and repair request creation.
 * Handles RBAC-based visibility and disabled states.
 * 
 * Consumes EquipmentDialogContext for dialog actions - must be used
 * within EquipmentDialogProvider.
 */

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { useEquipmentContext } from "@/app/(app)/equipment/_hooks/useEquipmentContext"
import { useDeleteEquipment } from "@/hooks/use-cached-equipment"
import { isEquipmentManagerRole } from "@/lib/rbac"
import type { Equipment, UsageLog } from "@/types/database"

export interface EquipmentActionsMenuProps {
  equipment: Equipment
  activeUsageLogs: UsageLog[] | undefined
  isLoadingActiveUsage: boolean
}

export function EquipmentActionsMenu({
  equipment,
  activeUsageLogs,
  isLoadingActiveUsage,
}: EquipmentActionsMenuProps) {
  const router = useRouter()
  const {
    user,
    isGlobal,
    isRegionalLeader,
    openDetailDialog,
    openStartUsageDialog,
    openEndUsageDialog,
  } = useEquipmentContext()

  const userId = React.useMemo(() => {
    const uid = user?.id
    const n = typeof uid === 'string' ? Number(uid) : uid
    return Number.isFinite(n) ? (n as number) : null
  }, [user?.id])
  const canDeleteEquipment = React.useMemo(
    () => isEquipmentManagerRole(user?.role),
    [user?.role]
  )
  const { mutate: deleteEquipment, isPending: isDeletingEquipment } = useDeleteEquipment()

  const activeUsageLog = activeUsageLogs?.find(
    (log) => log.thiet_bi_id === equipment.id && log.trang_thai === 'dang_su_dung'
  )

  const isCurrentUserUsing = !!activeUsageLog && userId != null && activeUsageLog.nguoi_su_dung_id === userId
  const startUsageDisabled = isLoadingActiveUsage || !user || !!activeUsageLog || isRegionalLeader

  const handleShowDetails = React.useCallback(() => {
    openDetailDialog(equipment)
  }, [openDetailDialog, equipment])

  const handleStartUsage = React.useCallback(() => {
    if (startUsageDisabled) return
    openStartUsageDialog(equipment)
  }, [openStartUsageDialog, equipment, startUsageDisabled])

  const handleEndUsage = React.useCallback(() => {
    if (activeUsageLog) {
      openEndUsageDialog(activeUsageLog)
    }
  }, [openEndUsageDialog, activeUsageLog])

  const handleCreateRepairRequest = React.useCallback(() => {
    if (isGlobal || isRegionalLeader) return
    router.push(`/repair-requests?action=create&equipmentId=${equipment.id}`)
  }, [router, equipment.id, isGlobal, isRegionalLeader])

  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)

  const handleDeleteEquipment = React.useCallback(() => {
    if (!canDeleteEquipment || isDeletingEquipment) return
    deleteEquipment(String(equipment.id), {
      onSuccess: () => setShowDeleteDialog(false)
    })
  }, [canDeleteEquipment, isDeletingEquipment, deleteEquipment, equipment.id])

  return (
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 touch-target-sm md:h-8 md:w-8"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel>Hành động</DropdownMenuLabel>
          <DropdownMenuItem onSelect={handleShowDetails}>
            Xem chi tiết
          </DropdownMenuItem>
          {!isCurrentUserUsing && (
            <DropdownMenuItem
              disabled={startUsageDisabled}
              onSelect={handleStartUsage}
              title={activeUsageLog ? "Thiết bị đang được sử dụng" : undefined}
            >
              Viết nhật ký SD
            </DropdownMenuItem>
          )}
          {isCurrentUserUsing && (
            <DropdownMenuItem onSelect={handleEndUsage}>
              Kết thúc sử dụng
            </DropdownMenuItem>
          )}
          {!isGlobal && !isRegionalLeader && (
            <DropdownMenuItem onSelect={handleCreateRepairRequest}>
              Tạo yêu cầu sửa chữa
            </DropdownMenuItem>
          )}
          {canDeleteEquipment && (
            <DropdownMenuItem
              disabled={isDeletingEquipment}
              onSelect={(e) => {
                e.preventDefault()
                setShowDeleteDialog(true)
              }}
              className="text-destructive focus:text-destructive"
            >
              Xóa Thiết bị
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Bạn có chắc chắn muốn xóa thiết bị này không?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này sẽ chuyển thiết bị vào thùng rác (xóa mềm).
            Bạn có thể khôi phục lại sau nếu cần.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleDeleteEquipment()
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeletingEquipment}
          >
            {isDeletingEquipment ? "Đang xóa..." : "Xóa"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
