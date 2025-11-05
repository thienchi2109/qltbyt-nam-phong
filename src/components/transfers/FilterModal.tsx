"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TransferStatus } from "@/types/transfers-data-grid"

export type FilterModalValue = {
  statuses: TransferStatus[]
  dateRange?: { from: Date | null; to: Date | null } | null
}

const STATUS_OPTIONS: { value: TransferStatus; label: string }[] = [
  { value: "cho_duyet", label: "Chờ duyệt" },
  { value: "da_duyet", label: "Đã duyệt" },
  { value: "dang_luan_chuyen", label: "Đang luân chuyển" },
  { value: "da_ban_giao", label: "Đã bàn giao" },
  { value: "hoan_thanh", label: "Hoàn thành" },
]

type Variant = "dialog" | "sheet"

export function FilterModal({
  open,
  onOpenChange,
  value,
  onChange,
  variant = "dialog",
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  value: FilterModalValue
  onChange: (v: FilterModalValue) => void
  variant?: Variant
}) {
  const toggleStatus = (status: TransferStatus) => {
    const set = new Set(value.statuses)
    if (set.has(status)) {
      set.delete(status)
    } else {
      set.add(status)
    }
    onChange({ ...value, statuses: Array.from(set) })
  }

  const handleClear = () => {
    onChange({ statuses: [], dateRange: null })
  }

  const Inner = (
    <div className="space-y-4">
      {/* Status multi-select */}
      <div className="space-y-2">
        <Label>Trạng thái</Label>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={value.statuses.includes(option.value) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleStatus(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Date range */}
      <div className="space-y-2">
        <Label>Khoảng thời gian</Label>
        <div className="grid grid-cols-2 gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !value.dateRange?.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value.dateRange?.from
                  ? value.dateRange.from.toLocaleDateString("vi-VN")
                  : "Từ ngày"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[1100]" align="start">
              <Calendar
                mode="single"
                selected={value.dateRange?.from || undefined}
                onSelect={(d) =>
                  onChange({
                    ...value,
                    dateRange: {
                      ...(value.dateRange ?? { from: null, to: null }),
                      from: d ?? null,
                    },
                  })
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !value.dateRange?.to && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value.dateRange?.to
                  ? value.dateRange.to.toLocaleDateString("vi-VN")
                  : "Đến ngày"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[1100]" align="start">
              <Calendar
                mode="single"
                selected={value.dateRange?.to || undefined}
                onSelect={(d) =>
                  onChange({
                    ...value,
                    dateRange: {
                      ...(value.dateRange ?? { from: null, to: null }),
                      to: d ?? null,
                    },
                  })
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={handleClear}>
          Xóa
        </Button>
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
            <SheetDescription>
              Chọn tiêu chí để lọc danh sách yêu cầu luân chuyển.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">{Inner}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bộ lọc nâng cao</DialogTitle>
          <DialogDescription>
            Chọn tiêu chí để lọc danh sách yêu cầu luân chuyển.
          </DialogDescription>
        </DialogHeader>
        {Inner}
      </DialogContent>
    </Dialog>
  )
}
