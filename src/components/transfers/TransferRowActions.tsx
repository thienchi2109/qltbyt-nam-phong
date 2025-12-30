// src/components/transfers/TransferRowActions.tsx
import * as React from "react"
import {
  Check,
  CheckCircle,
  Edit,
  FileText,
  Play,
  Send,
  Trash2,
  Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { TransferListItem } from "@/types/transfers-data-grid"

interface TransferRowActionsProps {
  item: TransferListItem
  canEdit: boolean
  canDelete: boolean
  isTransferCoreRole: boolean
  userRole: string
  userKhoaPhong?: string | null
  onEdit: () => void
  onDelete: () => void
  onApprove: () => void
  onStart: () => void
  onHandover: () => void
  onReturn: () => void
  onComplete: () => void
  onGenerateHandoverSheet: () => void
}

export const TransferRowActions = React.memo(function TransferRowActions({
  item,
  canEdit,
  canDelete,
  isTransferCoreRole,
  userRole,
  userKhoaPhong,
  onEdit,
  onDelete,
  onApprove,
  onStart,
  onHandover,
  onReturn,
  onComplete,
  onGenerateHandoverSheet,
}: TransferRowActionsProps) {
  const actions: React.ReactNode[] = []

  if (canEdit) {
    actions.push(
      <Tooltip key={`edit-${item.id}`}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-8 sm:w-8"
            onClick={(event) => {
              event.stopPropagation()
              onEdit()
            }}
          >
            <Edit className="h-5 w-5 sm:h-4 sm:w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Sửa</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  switch (item.trang_thai) {
    case "cho_duyet":
      if (isTransferCoreRole) {
        actions.push(
          <Tooltip key={`approve-${item.id}`}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-10 w-10 sm:h-8 sm:w-8"
                onClick={(event) => {
                  event.stopPropagation()
                  onApprove()
                }}
              >
                <Check className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Duyệt</p>
            </TooltipContent>
          </Tooltip>
        )
      }
      break
    case "da_duyet":
      if (
        isTransferCoreRole ||
        (userRole === "qltb_khoa" && userKhoaPhong === item.khoa_phong_hien_tai)
      ) {
        actions.push(
          <Tooltip key={`start-${item.id}`}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-10 w-10 sm:h-8 sm:w-8"
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation()
                  onStart()
                }}
              >
                <Play className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Bắt đầu</p>
            </TooltipContent>
          </Tooltip>
        )
      }
      break
    case "dang_luan_chuyen":
      if (
        isTransferCoreRole ||
        (userRole === "qltb_khoa" &&
          (userKhoaPhong === item.khoa_phong_hien_tai || userKhoaPhong === item.khoa_phong_nhan))
      ) {
        if (item.loai_hinh === "noi_bo") {
          actions.push(
            <Tooltip key={`handover-sheet-${item.id}`}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 sm:h-8 sm:w-8"
                  onClick={(event) => {
                    event.stopPropagation()
                    onGenerateHandoverSheet()
                  }}
                >
                  <FileText className="h-5 w-5 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Biên bản bàn giao</p>
              </TooltipContent>
            </Tooltip>
          )
          actions.push(
            <Tooltip key={`complete-${item.id}`}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className="h-10 w-10 sm:h-8 sm:w-8"
                  onClick={(event) => {
                    event.stopPropagation()
                    onComplete()
                  }}
                >
                  <CheckCircle className="h-5 w-5 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Hoàn thành</p>
              </TooltipContent>
            </Tooltip>
          )
        } else {
          actions.push(
            <Tooltip key={`handover-${item.id}`}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className="h-10 w-10 sm:h-8 sm:w-8"
                  variant="secondary"
                  onClick={(event) => {
                    event.stopPropagation()
                    onHandover()
                  }}
                >
                  <Send className="h-5 w-5 sm:h-4 sm:w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bàn giao</p>
              </TooltipContent>
            </Tooltip>
          )
        }
      }
      break
    case "da_ban_giao":
      if (isTransferCoreRole) {
        actions.push(
          <Tooltip key={`return-${item.id}`}>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-10 w-10 sm:h-8 sm:w-8"
                onClick={(event) => {
                  event.stopPropagation()
                  onReturn()
                }}
              >
                <Undo2 className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Hoàn trả</p>
            </TooltipContent>
          </Tooltip>
        )
      }
      break
    default:
      break
  }

  if (canDelete) {
    actions.push(
      <Tooltip key={`delete-${item.id}`}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-destructive hover:text-destructive sm:h-8 sm:w-8"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Xóa</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  if (actions.length === 0) return null

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 sm:gap-1">{actions}</div>
    </TooltipProvider>
  )
})
