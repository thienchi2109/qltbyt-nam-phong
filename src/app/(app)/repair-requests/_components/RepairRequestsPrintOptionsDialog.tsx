"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { RepairRequestSheetOptions } from "../request-sheet"
import { useRepairRequestUIHandlers } from "../_hooks/useRepairRequestUIHandlers"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"

/** Lets users choose whether the printable request sheet pre-fills requester name. */
export function RepairRequestsPrintOptionsDialog() {
  const {
    dialogState: { requestToPrint },
    closeAllDialogs,
  } = useRepairRequestsContext()
  const {
    data: branding,
    isPending,
    isPlaceholderData,
  } = useTenantBranding({
    formTenantId: requestToPrint?.thiet_bi?.facility_id ?? null,
    useFormContext: true,
  })
  const { toast } = useToast()
  const { handleGenerateRequestSheet } = useRepairRequestUIHandlers({
    branding,
    toast,
  })

  const handlePrint = (options: RepairRequestSheetOptions) => {
    if (!requestToPrint) return
    if (handleGenerateRequestSheet(requestToPrint, options)) {
      closeAllDialogs()
    }
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
            disabled={isPending || isPlaceholderData}
            onClick={() => handlePrint({ prefillRequesterName: false })}
          >
            Bỏ trống tên
          </Button>
          <Button
            type="button"
            disabled={isPending || isPlaceholderData}
            onClick={() => handlePrint({ prefillRequesterName: true })}
          >
            Điền sẵn tên
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
