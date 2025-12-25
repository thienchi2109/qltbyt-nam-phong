"use client"

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
import { format } from "date-fns"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import type { RepairRequestWithEquipment, RepairUnit } from "../types"

interface EditRequestDialogProps {
  request: RepairRequestWithEquipment | null
  onClose: () => void
  // Form state
  issueDescription: string
  setIssueDescription: (v: string) => void
  repairItems: string
  setRepairItems: (v: string) => void
  desiredDate: Date | undefined
  setDesiredDate: (v: Date | undefined) => void
  repairUnit: RepairUnit
  setRepairUnit: (v: RepairUnit) => void
  externalCompanyName: string
  setExternalCompanyName: (v: string) => void
  // Submission
  isSubmitting: boolean
  onSubmit: () => void
  canSetRepairUnit: boolean
}

export function EditRequestDialog({
  request,
  onClose,
  issueDescription,
  setIssueDescription,
  repairItems,
  setRepairItems,
  desiredDate,
  setDesiredDate,
  repairUnit,
  setRepairUnit,
  externalCompanyName,
  setExternalCompanyName,
  isSubmitting,
  onSubmit,
  canSetRepairUnit,
}: EditRequestDialogProps) {
  if (!request) return null

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa yêu cầu sửa chữa</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin cho yêu cầu của thiết bị: {request.thiet_bi?.ten_thiet_bi}
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
                  variant={"outline"}
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
                    const requestDate = request?.ngay_yeu_cau
                      ? new Date(request.ngay_yeu_cau)
                      : new Date();
                    return date < new Date(requestDate.setHours(0, 0, 0, 0));
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {canSetRepairUnit && (
            <div className="space-y-2">
              <Label htmlFor="edit-repair-unit">Đơn vị thực hiện</Label>
              <Select value={repairUnit} onValueChange={(value) => setRepairUnit(value as RepairUnit)}>
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

          {canSetRepairUnit && repairUnit === 'thue_ngoai' && (
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
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="touch-target">Hủy</Button>
          <Button onClick={onSubmit} disabled={isSubmitting} className="touch-target">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
