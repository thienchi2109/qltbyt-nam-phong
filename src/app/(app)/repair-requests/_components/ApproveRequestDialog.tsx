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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'
import { Loader2 } from "lucide-react"
import type { RepairRequestWithEquipment, RepairUnit } from "../types"

interface ApproveRequestDialogProps {
  request: RepairRequestWithEquipment | null
  onClose: () => void
  repairUnit: RepairUnit
  setRepairUnit: (v: RepairUnit) => void
  externalCompanyName: string
  setExternalCompanyName: (v: string) => void
  isApproving: boolean
  onConfirm: () => void
}

export function ApproveRequestDialog({
  request,
  onClose,
  repairUnit,
  setRepairUnit,
  externalCompanyName,
  setExternalCompanyName,
  isApproving,
  onConfirm,
}: ApproveRequestDialogProps) {
  if (!request) return null

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duyệt yêu cầu sửa chữa</DialogTitle>
          <DialogDescription>
            Duyệt yêu cầu sửa chữa cho thiết bị <strong>{request.thiet_bi?.ten_thiet_bi}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {request.nguoi_duyet && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-blue-800">Đã được duyệt bởi:</div>
              <div className="text-sm text-blue-600">{request.nguoi_duyet}</div>
              {request.ngay_duyet && (
                <div className="text-xs text-blue-500">
                  {format(parseISO(request.ngay_duyet), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </div>
              )}
            </div>
          )}
          <div>
            <Label htmlFor="approval-repair-unit">Đơn vị thực hiện</Label>
            <Select value={repairUnit} onValueChange={(value) => setRepairUnit(value as RepairUnit)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="noi_bo">Nội bộ</SelectItem>
                <SelectItem value="thue_ngoai">Thuê ngoài</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {repairUnit === 'thue_ngoai' && (
            <div>
              <Label htmlFor="approval-external-company">Tên đơn vị thực hiện sửa chữa</Label>
              <Input
                id="approval-external-company"
                value={externalCompanyName}
                onChange={(e) => setExternalCompanyName(e.target.value)}
                placeholder="Nhập tên đơn vị được thuê sửa chữa"
                disabled={isApproving}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isApproving}>
            Hủy
          </Button>
          <Button onClick={onConfirm} disabled={isApproving}>
            {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận duyệt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
