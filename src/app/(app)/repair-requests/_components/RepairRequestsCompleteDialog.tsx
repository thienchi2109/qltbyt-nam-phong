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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { Loader2 } from "lucide-react"
import { formatRepairCostInput, parseRepairCostInput } from "../repairRequestCost"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"

const MAX_REPAIR_COST_INPUT_LENGTH = new Intl.NumberFormat("vi-VN").format(Number.MAX_SAFE_INTEGER).length

interface CompleteDialogFormProps {
  requestId: number
  completionType: "Hoàn thành" | "Không HT"
  isPending: boolean
  onCancel: () => void
  onConfirm: (payload: {
    completion: string | null
    reason: string | null
    repairCost: number | null
  }) => void
}

function CompleteDialogForm({
  completionType,
  isPending,
  onCancel,
  onConfirm,
}: CompleteDialogFormProps) {
  const [completionResult, setCompletionResult] = React.useState("")
  const [nonCompletionReason, setNonCompletionReason] = React.useState("")
  const [repairCostInput, setRepairCostInput] = React.useState("")

  const handleRepairCostChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = event.target.value.replace(/\D/g, "")

    if (!digitsOnly) {
      setRepairCostInput("")
      return
    }

    try {
      const parsedValue = parseRepairCostInput(digitsOnly)

      if (parsedValue === null) {
        setRepairCostInput("")
        return
      }

      setRepairCostInput(formatRepairCostInput(parsedValue))
    } catch {
      return
    }
  }

  const handleConfirm = () => {
    const repairCost =
      completionType === "Hoàn thành"
        ? parseRepairCostInput(repairCostInput)
        : null

    onConfirm({
      completion: completionType === "Hoàn thành" ? completionResult.trim() : null,
      reason: completionType === "Không HT" ? nonCompletionReason.trim() : null,
      repairCost,
    })
  }

  return (
    <>
      <div className="space-y-4">
        {completionType === "Hoàn thành" ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="completion-result">Kết quả sửa chữa</Label>
              <Textarea
                id="completion-result"
                value={completionResult}
                onChange={(e) => setCompletionResult(e.target.value)}
                placeholder="Nhập kết quả và tình trạng thiết bị sau khi sửa chữa..."
                rows={4}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repair-cost">Tổng chi phí sửa chữa</Label>
              <Input
                id="repair-cost"
                value={repairCostInput}
                onChange={handleRepairCostChange}
                placeholder="Nhập tổng chi phí sửa chữa"
                inputMode="numeric"
                autoComplete="off"
                disabled={isPending}
                maxLength={MAX_REPAIR_COST_INPUT_LENGTH}
              />
              <p className="text-xs text-muted-foreground">
                Khuyến nghị nhập tổng chi phí để phục vụ thống kê và phân tích.
              </p>
            </div>
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
              disabled={isPending}
            />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>
          Hủy
        </Button>
        <Button onClick={handleConfirm} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {completionType === "Hoàn thành" ? "Xác nhận hoàn thành" : "Xác nhận không hoàn thành"}
        </Button>
      </DialogFooter>
    </>
  )
}

export function RepairRequestsCompleteDialog() {
  const {
    dialogState: { requestToComplete, completionType },
    closeAllDialogs,
    completeMutation,
  } = useRepairRequestsContext()

  if (!requestToComplete) return null
  if (!completionType) return null

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
        <CompleteDialogForm
          key={`${requestToComplete.id}-${completionType}`}
          requestId={requestToComplete.id}
          completionType={completionType}
          isPending={completeMutation.isPending}
          onCancel={closeAllDialogs}
          onConfirm={({ completion, reason, repairCost }) => {
            completeMutation.mutate(
              {
                id: requestToComplete.id,
                completion,
                reason,
                repairCost,
              },
              { onSuccess: closeAllDialogs }
            )
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

// Export alias for backwards compatibility
export const CompleteRequestDialog = RepairRequestsCompleteDialog
