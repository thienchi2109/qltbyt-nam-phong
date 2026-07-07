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
import { useDeferredDropdownAction } from "@/components/ui/use-deferred-dropdown-action"
import { useEquipmentContext } from "@/app/(app)/equipment/_hooks/useEquipmentContext"
import { buildRepairRequestCreateIntentHref } from "@/lib/repair-request-deep-link"
import { isEquipmentManagerRole } from "@/lib/rbac"
import type { Equipment, UsageLog } from "@/types/database"

export interface EquipmentActionsMenuProps {
  equipment: Equipment
  activeUsageLogs: UsageLog[] | undefined
  isLoadingActiveUsage: boolean
}

/** Renders the desktop equipment actions menu with status-aware commands. */
export function EquipmentActionsMenu({
  equipment,
  activeUsageLogs,
  isLoadingActiveUsage,
}: EquipmentActionsMenuProps) {
  const { push } = useRouter()
  const {
    user,
    isGlobal,
    isRegionalLeader,
    openDetailDialog,
    openStartUsageDialog,
    openEndUsageDialog,
    openDeleteDialog,
  } = useEquipmentContext()
  const deferDropdownAction = useDeferredDropdownAction()

  const userId = React.useMemo(() => {
    const uid = user?.id
    const n = typeof uid === "string" ? Number(uid) : uid
    return Number.isFinite(n) ? (n as number) : null
  }, [user?.id])

  const canDeleteEquipment = React.useMemo(() => isEquipmentManagerRole(user?.role), [user?.role])

  const activeUsageLog = activeUsageLogs?.find(
    (log) => log.thiet_bi_id === equipment.id && log.trang_thai === "dang_su_dung"
  )

  const isCurrentUserUsing =
    !!activeUsageLog && userId != null && activeUsageLog.nguoi_su_dung_id === userId
  const startUsageDisabled = isLoadingActiveUsage || !user || !!activeUsageLog || isRegionalLeader

  const handleShowDetails = React.useCallback(() => {
    deferDropdownAction(() => openDetailDialog(equipment))
  }, [deferDropdownAction, openDetailDialog, equipment])

  const handleStartUsage = React.useCallback(() => {
    if (startUsageDisabled) return
    deferDropdownAction(() => openStartUsageDialog(equipment))
  }, [deferDropdownAction, openStartUsageDialog, equipment, startUsageDisabled])

  const handleEndUsage = React.useCallback(() => {
    if (activeUsageLog) {
      deferDropdownAction(() => openEndUsageDialog(activeUsageLog))
    }
  }, [deferDropdownAction, openEndUsageDialog, activeUsageLog])

  const handleDeleteEquipment = React.useCallback(() => {
    deferDropdownAction(() => openDeleteDialog(equipment, "actions_menu"))
  }, [deferDropdownAction, openDeleteDialog, equipment])

  const handleCreateRepairRequest = React.useCallback(() => {
    if (isGlobal || isRegionalLeader) return
    push(buildRepairRequestCreateIntentHref(equipment.id))
  }, [push, equipment.id, isGlobal, isRegionalLeader])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="size-8 p-0 touch-target-sm md:size-8"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Hành động</DropdownMenuLabel>
        <DropdownMenuItem onSelect={handleShowDetails}>Xem chi tiết</DropdownMenuItem>
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
          <DropdownMenuItem onSelect={handleEndUsage}>Kết thúc sử dụng</DropdownMenuItem>
        )}
        {!isGlobal && !isRegionalLeader && (
          <DropdownMenuItem onSelect={handleCreateRepairRequest}>
            Tạo yêu cầu sửa chữa
          </DropdownMenuItem>
        )}
        {canDeleteEquipment && (
          <DropdownMenuItem
            onSelect={handleDeleteEquipment}
            className="text-destructive focus:text-destructive"
          >
            Xóa Thiết bị
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
