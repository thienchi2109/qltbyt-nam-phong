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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { Loader2 } from "lucide-react"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import type { RepairUnit } from "../types"

export function RepairRequestsApproveDialog() {
  const {
    dialogState: { requestToApprove },
    closeAllDialogs,
    approveMutation,
  } = useRepairRequestsContext()

  // Local form state
  const [repairUnit, setRepairUnit] = React.useState<RepairUnit>("noi_bo")
  const [externalCompanyName, setExternalCompanyName] = React.useState("")

  // Reset form when dialog opens
  React.useEffect(() => {
    if (requestToApprove) {
      setRepairUnit("noi_bo")
      setExternalCompanyName("")
    }
  }, [requestToApprove])

  const handleConfirm = () => {
    if (!requestToApprove) return

    approveMutation.mutate(
      {
        id: requestToApprove.id,
        don_vi_thuc_hien: repairUnit,
        ten_don_vi_thue: repairUnit === "thue_ngoai"
          ? externalCompanyName.trim()
          : null,
      },
      { onSuccess: closeAllDialogs }
    )
  }

  if (!requestToApprove) return null

  return (
    <Dialog open={!!requestToApprove} onOpenChange={(open) => !open && closeAllDialogs()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duyệt yêu cầu sửa chữa</DialogTitle>
          <DialogDescription>
            Duyệt yêu cầu sửa chữa cho thiết bị <strong>{requestToApprove.thiet_bi?.ten_thiet_bi}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {requestToApprove.nguoi_duyet && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-blue-800">Đã được duyệt bởi:</div>
              <div className="text-sm text-blue-600">{requestToApprove.nguoi_duyet}</div>
              {requestToApprove.ngay_duyet && (
                <div className="text-xs text-blue-500">
                  {format(parseISO(requestToApprove.ngay_duyet), "dd/MM/yyyy HH:mm", { locale: vi })}
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
          {repairUnit === "thue_ngoai" && (
            <div>
              <Label htmlFor="approval-external-company">Tên đơn vị thực hiện sửa chữa</Label>
              <Input
                id="approval-external-company"
                value={externalCompanyName}
                onChange={(e) => setExternalCompanyName(e.target.value)}
                placeholder="Nhập tên đơn vị được thuê sửa chữa"
                disabled={approveMutation.isPending}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={closeAllDialogs} disabled={approveMutation.isPending}>
            Hủy
          </Button>
          <Button onClick={handleConfirm} disabled={approveMutation.isPending}>
            {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận duyệt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Export alias for backwards compatibility
export const ApproveRequestDialog = RepairRequestsApproveDialog