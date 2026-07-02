"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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

import type { RepairUnit } from "../types"

interface RepairRequestsFormFieldsProps {
  readonly canSetRepairUnit: boolean
  readonly desiredDate: Date | undefined
  readonly externalCompanyName: string
  readonly fieldIdPrefix: string
  readonly isDateDisabled: (date: Date) => boolean
  readonly issueDescription: string
  readonly onDesiredDateChange: (value: Date | undefined) => void
  readonly onExternalCompanyNameChange: (value: string) => void
  readonly onIssueDescriptionChange: (value: string) => void
  readonly onRepairItemsChange: (value: string) => void
  readonly onRepairUnitChange: (value: RepairUnit) => void
  readonly repairItems: string
  readonly repairItemsLabel: string
  readonly repairItemsRequired?: boolean
  readonly repairUnit: RepairUnit
}

/** Renders the repair-request fields shared by create and edit sheets. */
export function RepairRequestsFormFields({
  canSetRepairUnit,
  desiredDate,
  externalCompanyName,
  fieldIdPrefix,
  isDateDisabled,
  issueDescription,
  onDesiredDateChange,
  onExternalCompanyNameChange,
  onIssueDescriptionChange,
  onRepairItemsChange,
  onRepairUnitChange,
  repairItems,
  repairItemsLabel,
  repairItemsRequired = false,
  repairUnit,
}: RepairRequestsFormFieldsProps) {
  const issueId = `${fieldIdPrefix}-issue`
  const repairItemsId = `${fieldIdPrefix}-repair-items`
  const repairUnitId = `${fieldIdPrefix}-repair-unit`
  const externalCompanyId = `${fieldIdPrefix}-external-company`

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={issueId}>Mô tả sự cố</Label>
        <Textarea
          id={issueId}
          placeholder="Mô tả chi tiết vấn đề gặp phải…"
          rows={4}
          value={issueDescription}
          onChange={(event) => onIssueDescriptionChange(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={repairItemsId}>{repairItemsLabel}</Label>
        <Textarea
          id={repairItemsId}
          placeholder="VD: Thay màn hình, sửa nguồn…"
          rows={3}
          value={repairItems}
          onChange={(event) => onRepairItemsChange(event.target.value)}
          required={repairItemsRequired}
        />
      </div>
      <div className="space-y-2">
        <Label>Ngày mong muốn hoàn thành (nếu có)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal touch-target",
                !desiredDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 size-4" />
              {desiredDate ? format(desiredDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={desiredDate}
              onSelect={onDesiredDateChange}
              initialFocus
              disabled={isDateDisabled}
            />
          </PopoverContent>
        </Popover>
      </div>

      {canSetRepairUnit && (
        <div className="space-y-2">
          <Label htmlFor={repairUnitId}>Đơn vị thực hiện</Label>
          <Select
            value={repairUnit}
            onValueChange={(value) => onRepairUnitChange(value as RepairUnit)}
          >
            <SelectTrigger id={repairUnitId} className="touch-target">
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
          <Label htmlFor={externalCompanyId}>Tên đơn vị được thuê</Label>
          <Input
            id={externalCompanyId}
            placeholder="Nhập tên đơn vị được thuê sửa chữa…"
            value={externalCompanyName}
            onChange={(event) => onExternalCompanyNameChange(event.target.value)}
            required
            className="touch-target"
          />
        </div>
      )}
    </>
  )
}
