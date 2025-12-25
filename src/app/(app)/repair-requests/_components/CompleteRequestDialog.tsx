"use client"

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
import { vi } from 'date-fns/locale'
import { Loader2 } from "lucide-react"
import type { RepairRequestWithEquipment } from "../types"

interface CompleteRequestDialogProps {
  request: RepairRequestWithEquipment | null
  completionType: 'Hoàn thành' | 'Không HT' | null
  onClose: () => void
  completionResult: string
  setCompletionResult: (v: string) => void
  nonCompletionReason: string
  setNonCompletionReason: (v: string) => void
  isCompleting: boolean
  onConfirm: () => void
}

export function CompleteRequestDialog({
  request,
  completionType,
  onClose,
  completionResult,
  setCompletionResult,
  nonCompletionReason,
  setNonCompletionReason,
  isCompleting,
  onConfirm,
}: CompleteRequestDialogProps) {
  if (!request) return null

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {completionType === 'Hoàn thành' ? 'Ghi nhận hoàn thành sửa chữa' : 'Ghi nhận không hoàn thành'}
          </DialogTitle>
          <DialogDescription>
            {completionType === 'Hoàn thành'
              ? `Ghi nhận kết quả sửa chữa cho thiết bị ${request.thiet_bi?.ten_thiet_bi}`
              : `Ghi nhận lý do không hoàn thành sửa chữa cho thiết bị ${request.thiet_bi?.ten_thiet_bi}`
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {request.nguoi_xac_nhan && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm font-medium text-green-800">Đã được xác nhận bởi:</div>
              <div className="text-sm text-green-600">{request.nguoi_xac_nhan}</div>
              {request.ngay_hoan_thanh && (
                <div className="text-xs text-green-500">
                  {format(parseISO(request.ngay_hoan_thanh), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </div>
              )}
            </div>
          )}
          {completionType === 'Hoàn thành' ? (
            <div>
              <Label htmlFor="completion-result">Kết quả sửa chữa</Label>
              <Textarea
                id="completion-result"
                value={completionResult}
                onChange={(e) => setCompletionResult(e.target.value)}
                placeholder="Nhập kết quả và tình trạng thiết bị sau khi sửa chữa..."
                rows={4}
                disabled={isCompleting}
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
                disabled={isCompleting}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCompleting}>
            Hủy
          </Button>
          <Button onClick={onConfirm} disabled={isCompleting}>
            {isCompleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {completionType === 'Hoàn thành' ? 'Xác nhận hoàn thành' : 'Xác nhận không hoàn thành'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
