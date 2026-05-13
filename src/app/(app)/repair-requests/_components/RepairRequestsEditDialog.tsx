"use client"

import * as React from "react"
import { parseISO, format, startOfDay } from "date-fns"
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
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import type { RepairUnit } from "../types"

interface RepairRequestsEditFormState {
  desiredDate: Date | undefined
  externalCompanyName: string
  issueDescription: string
  repairItems: string
  repairUnit: RepairUnit
}

type RepairRequestsEditFormAction =
  | { type: "patch"; updates: Partial<RepairRequestsEditFormState> }

const initialEditFormState: RepairRequestsEditFormState = {
  desiredDate: undefined,
  externalCompanyName: "",
  issueDescription: "",
  repairItems: "",
  repairUnit: "noi_bo",
}

function repairRequestsEditFormReducer(
  state: RepairRequestsEditFormState,
  action: RepairRequestsEditFormAction,
): RepairRequestsEditFormState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.updates }
  }
}

type RepairRequestToEdit = NonNullable<
  ReturnType<typeof useRepairRequestsContext>["dialogState"]["requestToEdit"]
>

function createEditFormState(requestToEdit: RepairRequestToEdit): RepairRequestsEditFormState {
  return {
    desiredDate: requestToEdit.ngay_mong_muon_hoan_thanh
      ? parseISO(requestToEdit.ngay_mong_muon_hoan_thanh)
      : undefined,
    externalCompanyName: requestToEdit.ten_don_vi_thue || "",
    issueDescription: requestToEdit.mo_ta_su_co,
    repairItems: requestToEdit.hang_muc_sua_chua || "",
    repairUnit: requestToEdit.don_vi_thuc_hien || "noi_bo",
  }
}

export function RepairRequestsEditDialog() {
  const {
    dialogState: { requestToEdit },
    closeAllDialogs,
    updateMutation,
    canSetRepairUnit,
  } = useRepairRequestsContext()

  if (!requestToEdit) return null

  return (
    <RepairRequestsEditDialogContent
      key={requestToEdit.id}
      canSetRepairUnit={canSetRepairUnit}
      closeAllDialogs={closeAllDialogs}
      requestToEdit={requestToEdit}
      updateMutation={updateMutation}
    />
  )
}

function RepairRequestsEditDialogContent({
  canSetRepairUnit,
  closeAllDialogs,
  requestToEdit,
  updateMutation,
}: {
  canSetRepairUnit: boolean
  closeAllDialogs: () => void
  requestToEdit: RepairRequestToEdit
  updateMutation: ReturnType<typeof useRepairRequestsContext>["updateMutation"]
}) {
  const [formState, dispatchForm] = React.useReducer(
    repairRequestsEditFormReducer,
    requestToEdit,
    createEditFormState,
  )

  const handleSubmit = () => {
    if (!requestToEdit) return

    updateMutation.mutate(
      {
        id: requestToEdit.id,
        mo_ta_su_co: formState.issueDescription,
        hang_muc_sua_chua: formState.repairItems,
        ngay_mong_muon_hoan_thanh: formState.desiredDate
          ? format(formState.desiredDate, "yyyy-MM-dd")
          : null,
        don_vi_thuc_hien: canSetRepairUnit ? formState.repairUnit : undefined,
        ten_don_vi_thue: canSetRepairUnit && formState.repairUnit === "thue_ngoai"
          ? formState.externalCompanyName.trim()
          : null,
      },
      { onSuccess: closeAllDialogs }
    )
  }

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
              value={formState.issueDescription}
              onChange={(e) => dispatchForm({
                type: "patch",
                updates: { issueDescription: e.target.value },
              })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-repair-items">Các hạng mục yêu cầu sửa chữa</Label>
            <Textarea
              id="edit-repair-items"
              placeholder="VD: Thay màn hình, sửa nguồn..."
              rows={3}
              value={formState.repairItems}
              onChange={(e) => dispatchForm({
                type: "patch",
                updates: { repairItems: e.target.value },
              })}
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
                    !formState.desiredDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {formState.desiredDate ? format(formState.desiredDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formState.desiredDate}
                  onSelect={(desiredDate) => dispatchForm({
                    type: "patch",
                    updates: { desiredDate },
                  })}
                  initialFocus
                  disabled={(date) => {
                    const requestTimestamp = Date.parse(requestToEdit.ngay_yeu_cau)
                    return Number.isFinite(requestTimestamp)
                      ? date.getTime() < startOfDay(requestTimestamp).getTime()
                      : false
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {canSetRepairUnit && (
            <div className="space-y-2">
              <Label htmlFor="edit-repair-unit">Đơn vị thực hiện</Label>
              <Select
                value={formState.repairUnit}
                onValueChange={(value) => dispatchForm({
                  type: "patch",
                  updates: { repairUnit: value as RepairUnit },
                })}
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

          {canSetRepairUnit && formState.repairUnit === "thue_ngoai" && (
            <div className="space-y-2">
              <Label htmlFor="edit-external-company">Tên đơn vị được thuê</Label>
              <Input
                id="edit-external-company"
                placeholder="Nhập tên đơn vị được thuê sửa chữa..."
                value={formState.externalCompanyName}
                onChange={(e) => dispatchForm({
                  type: "patch",
                  updates: { externalCompanyName: e.target.value },
                })}
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
            {updateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
