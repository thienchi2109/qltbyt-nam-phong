"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type FilterModalValue = {
  status: string[]
  facilityId?: number | null
  dateRange?: { from: Date | null; to: Date | null } | null
}

const STATUS_OPTIONS = ['Chờ xử lý', 'Đã duyệt', 'Hoàn thành', 'Không HT'] as const

type Variant = "dialog" | "sheet"

export function FilterModal({
  open,
  onOpenChange,
  value,
  onChange,
  showFacility,
  facilities,
  variant = "dialog",
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  value: FilterModalValue
  onChange: (v: FilterModalValue) => void
  showFacility?: boolean
  facilities: { id: number; name: string }[]
  variant?: Variant
}) {
  const toggleStatus = (s: string) => {
    const set = new Set(value.status)
    if (set.has(s)) set.delete(s)
    else set.add(s)
    onChange({ ...value, status: Array.from(set) })
  }

  const Inner = (
    <div className="space-y-4">
      {/* Status multi-select (as simple check-list) */}
      <div className="space-y-2">
        <Label>Trạng thái</Label>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <Button
              key={s}
              variant={value.status.includes(s) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Facility (optional) */}
      {showFacility && (
        <div className="space-y-2">
          <Label>Cơ sở</Label>
          <Select
            value={value.facilityId != null ? String(value.facilityId) : "all"}
            onValueChange={(val) =>
              onChange({ ...value, facilityId: val === "all" ? null : Number(val) })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Chọn cơ sở" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {facilities.map((f) => (
                <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Date range */}
      <div className="space-y-2">
        <Label>Khoảng ngày</Label>
        <div className="grid grid-cols-2 gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("justify-start text-left font-normal", !value.dateRange?.from && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value.dateRange?.from ? value.dateRange.from.toLocaleDateString("vi-VN") : "Từ ngày"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.dateRange?.from || undefined}
                onSelect={(d) => onChange({ ...value, dateRange: { ...(value.dateRange ?? { from: null, to: null }), from: d ?? null } })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("justify-start text-left font-normal", !value.dateRange?.to && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value.dateRange?.to ? value.dateRange.to.toLocaleDateString("vi-VN") : "Đến ngày"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.dateRange?.to || undefined}
                onSelect={(d) => onChange({ ...value, dateRange: { ...(value.dateRange ?? { from: null, to: null }), to: d ?? null } })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={() => onChange({ status: [], facilityId: showFacility ? null : undefined, dateRange: null })}>Xóa</Button>
        <Button onClick={() => onOpenChange(false)}>Đóng</Button>
      </div>
    </div>
  )

  if (variant === "sheet") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Bộ lọc nâng cao</SheetTitle>
            <SheetDescription>Chọn tiêu chí để lọc danh sách yêu cầu.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {Inner}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bộ lọc nâng cao</DialogTitle>
          <DialogDescription>Chọn tiêu chí để lọc danh sách yêu cầu.</DialogDescription>
        </DialogHeader>
        {Inner}
      </DialogContent>
    </Dialog>
  )
}
