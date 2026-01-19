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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { Loader2 } from "lucide-react"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"

export function RepairRequestsCompleteDialog() {
  const {
    dialogState: { requestToComplete, completionType },
    closeAllDialogs,
    completeMutation,
  } = useRepairRequestsContext()

  // Local form state
  const [completionResult, setCompletionResult] = React.useState("")
  const [nonCompletionReason, setNonCompletionReason] = React.useState("")

  // Reset form when dialog opens
  React.useEffect(() => {
    if (requestToComplete) {
      setCompletionResult("")
      setNonCompletionReason("")
    }
  }, [requestToComplete])

  const handleConfirm = () => {
    if (!requestToComplete || !completionType) return

    completeMutation.mutate(
      {
        id: requestToComplete.id,
        completion: completionType === "Hoàn thành" ? completionResult.trim() : null,
        reason: completionType === "Không HT" ? nonCompletionReason.trim() : null,
      },
      { onSuccess: closeAllDialogs }
    )
  }

  if (!requestToComplete) return null

  return (
    <Dialog open={!!requestToComplete} onOpenChange={(open) => !open && closeAllDialogs()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {completionType === "Hoàn thành"
              ? "Ghi nhận hoàn thành sửa chữa"
              : "Ghi nhận không hoàn thành"}
          </DialogTitle>
          <DialogDescription>
            {completionType === "Hoàn thành"
              ? `Ghi nhận kết quả sửa chữa cho thiết bị ${requestToComplete.thiet_bi?.ten_thiet_bi}`
              : `Ghi nhận lý do không hoàn thành sửa chữa cho thiết bị ${requestToComplete.thiet_bi?.ten_thiet_bi}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {requestToComplete.nguoi_xac_nhan && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm font-medium text-green-800">Đã được xác nhận bởi:</div>
              <div className="text-sm text-green-600">{requestToComplete.nguoi_xac_nhan}</div>
              {requestToComplete.ngay_hoan_thanh && (
                <div className="text-xs text-green-500">
                  {format(parseISO(requestToComplete.ngay_hoan_thanh), "dd/MM/yyyy HH:mm", { locale: vi })}
                </div>
              )}
            </div>
          )}
          {completionType === "Hoàn thành" ? (
            <div>
              <Label htmlFor="completion-result">Kết quả sửa chữa</Label>
              <Textarea
                id="completion-result"
                value={completionResult}
                onChange={(e) => setCompletionResult(e.target.value)}
                placeholder="Nhập kết quả và tình trạng thiết bị sau khi sửa chữa..."
                rows={4}
                disabled={completeMutation.isPending}
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="non-completion-reason">Lý do không hoàn thành</Label>
              <Textarea
                id="non-completion-reason"
                value={nonCompletionReason}
                onChange={(e) => setNonCompletionReason(e.target.value)}
                placeholder="Nhập lý do không thể hoàn thành sửa chữa..."
                rows={4}
                disabled={completeMutation.isPending}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={closeAllDialogs} disabled={completeMutation.isPending}>
            Hủy
          </Button>
          <Button onClick={handleConfirm} disabled={completeMutation.isPending}>
            {completeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {completionType === "Hoàn thành" ? "Xác nhận hoàn thành" : "Xác nhận không hoàn thành"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Export alias for backwards compatibility
export const CompleteRequestDialog = RepairRequestsCompleteDialog