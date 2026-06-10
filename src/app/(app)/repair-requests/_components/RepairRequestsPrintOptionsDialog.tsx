"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { RepairRequestSheetOptions } from "../request-sheet"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import type { RepairRequestWithEquipment } from "../types"

interface RepairRequestsPrintOptionsDialogProps {
  readonly onGenerateSheet: (
    request: RepairRequestWithEquipment,
    options?: RepairRequestSheetOptions
  ) => void
}

/** Lets users choose whether the printable request sheet pre-fills requester name. */
export function RepairRequestsPrintOptionsDialog({
  onGenerateSheet,
}: RepairRequestsPrintOptionsDialogProps) {
  const {
    dialogState: { requestToPrint },
    closeAllDialogs,
  } = useRepairRequestsContext()

  const handlePrint = (options: RepairRequestSheetOptions) => {
    if (!requestToPrint) return
    onGenerateSheet(requestToPrint, options)
    closeAllDialogs()
  }

  return (
    <Dialog open={!!requestToPrint} onOpenChange={(open) => !open && closeAllDialogs()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>In phiếu yêu cầu sửa chữa</DialogTitle>
          <DialogDescription>
            Chọn cách hiển thị tên người yêu cầu ở phần ký tên của phiếu in.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handlePrint({ prefillRequesterName: false })}
          >
            Bỏ trống tên
          </Button>
          <Button
            type="button"
            onClick={() => handlePrint({ prefillRequesterName: true })}
          >
            Điền sẵn tên
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
