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

import type { EquipmentSelectItem, RepairUnit } from "../types"
import { RepairRequestsCreateSheetActions } from "./RepairRequestsCreateSheetActions"
import { RepairRequestsEquipmentSearchField } from "./RepairRequestsEquipmentSearchField"

interface RepairRequestsCreateSheetFormProps {
  canSetRepairUnit: boolean
  desiredDate: Date | undefined
  externalCompanyName: string
  filteredEquipment: EquipmentSelectItem[]
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent) => void
  handleSelectEquipment: (equipment: EquipmentSelectItem) => void
  isSubmitting: boolean
  issueDescription: string
  onCancel: () => void
  repairItems: string
  repairUnit: RepairUnit
  searchQuery: string
  selectedEquipment: EquipmentSelectItem | null
  setDesiredDate: React.Dispatch<React.SetStateAction<Date | undefined>>
  setExternalCompanyName: React.Dispatch<React.SetStateAction<string>>
  setIssueDescription: React.Dispatch<React.SetStateAction<string>>
  setRepairItems: React.Dispatch<React.SetStateAction<string>>
  setRepairUnit: React.Dispatch<React.SetStateAction<RepairUnit>>
  shouldShowNoResults: boolean
}

export function RepairRequestsCreateSheetForm({
  canSetRepairUnit,
  desiredDate,
  externalCompanyName,
  filteredEquipment,
  handleSearchChange,
  handleSubmit,
  handleSelectEquipment,
  isSubmitting,
  issueDescription,
  onCancel,
  repairItems,
  repairUnit,
  searchQuery,
  selectedEquipment,
  setDesiredDate,
  setExternalCompanyName,
  setIssueDescription,
  setRepairItems,
  setRepairUnit,
  shouldShowNoResults,
}: RepairRequestsCreateSheetFormProps) {
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <RepairRequestsEquipmentSearchField
        searchQuery={searchQuery}
        selectedEquipment={selectedEquipment}
        filteredEquipment={filteredEquipment}
        shouldShowNoResults={shouldShowNoResults}
        onSearchChange={handleSearchChange}
        onSelectEquipment={handleSelectEquipment}
      />
      <div className="space-y-2">
        <Label htmlFor="issue">Mô tả sự cố</Label>
        <Textarea
          id="issue"
          placeholder="Mô tả chi tiết vấn đề gặp phải..."
          rows={4}
          value={issueDescription}
          onChange={(e) => setIssueDescription(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="repair-items">Các hạng mục yêu cầu sửa chữa</Label>
        <Textarea
          id="repair-items"
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
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal touch-target",
                !desiredDate && "text-muted-foreground",
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
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </PopoverContent>
        </Popover>
      </div>

      {canSetRepairUnit && (
        <div className="space-y-2">
          <Label htmlFor="repair-unit">Đơn vị thực hiện</Label>
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

      {canSetRepairUnit && repairUnit === "thue_ngoai" && (
        <div className="space-y-2">
          <Label htmlFor="external-company">Tên đơn vị được thuê</Label>
          <Input
            id="external-company"
            placeholder="Nhập tên đơn vị được thuê sửa chữa..."
            value={externalCompanyName}
            onChange={(e) => setExternalCompanyName(e.target.value)}
            required
            className="touch-target"
          />
        </div>
      )}

      <RepairRequestsCreateSheetActions
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  )
}
