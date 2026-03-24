"use client"

import * as React from "react"
import { Edit, Loader2, Printer, QrCode, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Equipment } from "@/types/database"

interface EquipmentDetailFooterProps {
  canDeleteEquipment: boolean
  canEdit: boolean
  displayEquipment: Equipment
  isEditingDetails: boolean
  isRegionalLeader: boolean
  isUpdating: boolean
  onCancelEditing: () => void
  onClose: () => void
  onDeleteEquipment: () => void
  onGenerateDeviceLabel: () => void
  onGenerateProfileSheet: () => void
  onStartEditing: () => void
}

export function EquipmentDetailFooter({
  canDeleteEquipment,
  canEdit,
  displayEquipment,
  isEditingDetails,
  isRegionalLeader,
  isUpdating,
  onCancelEditing,
  onClose,
  onDeleteEquipment,
  onGenerateDeviceLabel,
  onGenerateProfileSheet,
  onStartEditing,
}: EquipmentDetailFooterProps): React.ReactNode {
  return (
    <TooltipProvider>
      <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {canEdit &&
            (!isEditingDetails ? (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={onStartEditing}>
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Sửa thông tin</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sửa thông tin</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={onCancelEditing}
                  disabled={isUpdating}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  form="equipment-inline-edit-form"
                  disabled={isUpdating}
                >
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Lưu thay đổi
                </Button>
              </>
            ))}
        </div>
        <div className="flex items-center gap-2">
          {!isRegionalLeader && (
            <>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={onGenerateDeviceLabel}>
                    <QrCode className="h-4 w-4" />
                    <span className="sr-only">Tạo nhãn thiết bị</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Tạo nhãn thiết bị</TooltipContent>
              </Tooltip>

              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={onGenerateProfileSheet}>
                    <Printer className="h-4 w-4" />
                    <span className="sr-only">In lý lịch</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>In lý lịch</TooltipContent>
              </Tooltip>
            </>
          )}

          <div className="w-px h-6 bg-border mx-1 hidden sm:block"></div>

          {canDeleteEquipment && (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/30"
                  onClick={onDeleteEquipment}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Xóa thiết bị</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Xóa thiết bị</TooltipContent>
            </Tooltip>
          )}

          <Button variant="default" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}
