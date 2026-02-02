"use client"

import * as React from "react"
import { parseISO, format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { parseLocalDate } from "@/lib/date-utils"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import type { RepairUnit } from "../types"

export function RepairRequestsEditDialog() {
  const {
    dialogState: { requestToEdit },
    closeAllDialogs,
    updateMutation,
    canSetRepairUnit,
  } = useRepairRequestsContext()

  // Local form state
  const [issueDescription, setIssueDescription] = React.useState("")
  const [repairItems, setRepairItems] = React.useState("")
  const [desiredDate, setDesiredDate] = React.useState<Date | undefined>()
  const [repairUnit, setRepairUnit] = React.useState<RepairUnit>("noi_bo")
  const [externalCompanyName, setExternalCompanyName] = React.useState("")

  // Populate form when dialog opens
  React.useEffect(() => {
    if (requestToEdit) {
      setIssueDescription(requestToEdit.mo_ta_su_co)
      setRepairItems(requestToEdit.hang_muc_sua_chua || "")
      setDesiredDate(
        requestToEdit.ngay_mong_muon_hoan_thanh
          ? parseISO(requestToEdit.ngay_mong_muon_hoan_thanh)
          : undefined
      )
      setRepairUnit(requestToEdit.don_vi_thuc_hien || "noi_bo")
      setExternalCompanyName(requestToEdit.ten_don_vi_thue || "")
    }
  }, [requestToEdit])

  const handleSubmit = () => {
    if (!requestToEdit) return

    updateMutation.mutate(
      {
        id: requestToEdit.id,
        mo_ta_su_co: issueDescription,
        hang_muc_sua_chua: repairItems,
        ngay_mong_muon_hoan_thanh: desiredDate
          ? format(desiredDate, "yyyy-MM-dd")
          : null,
        don_vi_thuc_hien: canSetRepairUnit ? repairUnit : undefined,
        ten_don_vi_thue: canSetRepairUnit && repairUnit === "thue_ngoai"
          ? externalCompanyName.trim()
          : null,
      },
      { onSuccess: closeAllDialogs }
    )
  }

  if (!requestToEdit) return null

  return (
    <Dialog open={!!requestToEdit} onOpenChange={(open) => !open && closeAllDialogs()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa yêu cầu sửa chữa</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin cho yêu cầu của thiết bị: {requestToEdit.thiet_bi?.ten_thiet_bi}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 mobile-card-spacing">
          <div className="space-y-2">
            <Label htmlFor="edit-issue">Mô tả sự cố</Label>
            <Textarea
              id="edit-issue"
              placeholder="Mô tả chi tiết vấn đề gặp phải..."
              rows={4}
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-repair-items">Các hạng mục yêu cầu sửa chữa</Label>
            <Textarea
              id="edit-repair-items"
              placeholder="VD: Thay màn hình, sửa nguồn..."
              rows={3}
              value={repairItems}
              onChange={(e) => setRepairItems(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Ngày mong muốn hoàn thành (nếu có)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal touch-target",
                    !desiredDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {desiredDate ? format(desiredDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={desiredDate}
                  onSelect={setDesiredDate}
                  initialFocus
                  disabled={(date) => {
                    const requestDate = requestToEdit?.ngay_yeu_cau
                      ? parseLocalDate(requestToEdit.ngay_yeu_cau) ?? new Date()
                      : new Date()
                    return date < new Date(requestDate.setHours(0, 0, 0, 0))
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {canSetRepairUnit && (
            <div className="space-y-2">
              <Label htmlFor="edit-repair-unit">Đơn vị thực hiện</Label>
              <Select
                value={repairUnit}
                onValueChange={(value) => setRepairUnit(value as RepairUnit)}
              >
                <SelectTrigger className="touch-target">
                  <SelectValue placeholder="Chọn đơn vị thực hiện" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="noi_bo">Nội bộ</SelectItem>
                  <SelectItem value="thue_ngoai">Thuê ngoài</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {canSetRepairUnit && repairUnit === "thue_ngoai" && (
            <div className="space-y-2">
              <Label htmlFor="edit-external-company">Tên đơn vị được thuê</Label>
              <Input
                id="edit-external-company"
                placeholder="Nhập tên đơn vị được thuê sửa chữa..."
                value={externalCompanyName}
                onChange={(e) => setExternalCompanyName(e.target.value)}
                required
                className="touch-target"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={closeAllDialogs}
            disabled={updateMutation.isPending}
            className="touch-target"
          >
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="touch-target"
          >
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
