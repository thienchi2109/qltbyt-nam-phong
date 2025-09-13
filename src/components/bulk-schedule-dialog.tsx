
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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface BulkScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (months: Record<string, boolean>) => void
}

export function BulkScheduleDialog({ open, onOpenChange, onApply }: BulkScheduleDialogProps) {
  const [selectedMonths, setSelectedMonths] = React.useState<Record<string, boolean>>({});

  const handleMonthChange = (monthIndex: number, checked: boolean) => {
    setSelectedMonths(prev => ({ ...prev, [`thang_${monthIndex}`]: checked }));
  };

  const handleSubmit = () => {
    onApply(selectedMonths);
    setSelectedMonths({});
  };

  React.useEffect(() => {
    if (!open) {
      setSelectedMonths({});
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lên lịch hàng loạt</DialogTitle>
          <DialogDescription>
            Chọn các tháng để áp dụng cho tất cả các mục đã chọn. Lịch trình hiện tại của các mục này sẽ được ghi đè.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 grid grid-cols-4 gap-4">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
            <div key={month} className="flex items-center space-x-2">
              <Checkbox
                id={`month-${month}`}
                checked={!!selectedMonths[`thang_${month}`]}
                onCheckedChange={(checked) => handleMonthChange(month, !!checked)}
              />
              <Label htmlFor={`month-${month}`} className="font-normal cursor-pointer">
                Tháng {month}
              </Label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Áp dụng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
