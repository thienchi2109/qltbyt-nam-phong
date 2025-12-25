"use client"

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader as SheetHeaderUI,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Check, Loader2 } from "lucide-react"
import type { EquipmentSelectItem, RepairUnit } from "../types"

interface CreateRequestSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Equipment search
  selectedEquipment: EquipmentSelectItem | null
  searchQuery: string
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSelectEquipment: (eq: EquipmentSelectItem) => void
  filteredEquipment: EquipmentSelectItem[]
  shouldShowNoResults: boolean
  // Form fields
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
  // Submit
  isSubmitting: boolean
  onSubmit: (e: React.FormEvent) => void
  canSetRepairUnit: boolean
  isSheetMobile: boolean
}

export function CreateRequestSheet({
  open,
  onOpenChange,
  selectedEquipment,
  searchQuery,
  onSearchChange,
  onSelectEquipment,
  filteredEquipment,
  shouldShowNoResults,
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
  isSheetMobile,
}: CreateRequestSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isSheetMobile ? "bottom" : "right"}
        className={cn(isSheetMobile ? "h-[90vh] p-0" : "sm:max-w-lg")}
      >
        <SheetHeaderUI className={cn(isSheetMobile ? "p-4 border-b" : "")}>
          <SheetTitle>Tạo yêu cầu sửa chữa</SheetTitle>
          <SheetDescription>Điền thông tin bên dưới để gửi yêu cầu mới.</SheetDescription>
        </SheetHeaderUI>
        <div className={cn("mt-4", isSheetMobile ? "px-4 overflow-y-auto h-[calc(90vh-80px)]" : "")}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search-equipment">Thiết bị</Label>
              <div className="relative">
                <Input
                  id="search-equipment"
                  placeholder={"Nhập tên hoặc mã để tìm kiếm..."}
                  value={searchQuery}
                  onChange={onSearchChange}
                  autoComplete="off"
                  required
                />
                {filteredEquipment.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-1">
                      {filteredEquipment.map((equipment) => (
                        <div
                          key={equipment.id}
                          className="text-sm mobile-interactive hover:bg-accent rounded-sm cursor-pointer touch-target-sm"
                          onClick={() => onSelectEquipment(equipment)}
                        >
                          <div className="font-medium">{equipment.ten_thiet_bi}</div>
                          <div className="text-xs text-muted-foreground">
                            {equipment.ma_thiet_bi}
                            {equipment.khoa_phong_quan_ly && (
                              <span className="ml-2 text-blue-600">• {equipment.khoa_phong_quan_ly}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {shouldShowNoResults && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg p-3">
                    <div className="text-sm text-muted-foreground text-center">
                      Không tìm thấy kết quả phù hợp
                    </div>
                  </div>
                )}
              </div>
              {selectedEquipment && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  <span>Đã chọn: {selectedEquipment.ten_thiet_bi} ({selectedEquipment.ma_thiet_bi})</span>
                </p>
              )}
            </div>
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

            {canSetRepairUnit && repairUnit === 'thue_ngoai' && (
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

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1 touch-target" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit" className="flex-1 touch-target" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
