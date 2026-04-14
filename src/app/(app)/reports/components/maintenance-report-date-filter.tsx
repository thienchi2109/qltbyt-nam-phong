"use client"

import * as React from "react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { DateRange } from "../hooks/use-maintenance-data.types"

interface MaintenanceReportDateFilterProps {
  dateRange: DateRange
  onDateRangeChange: (dateRange: DateRange) => void
}

function getDateRangeLabel(dateRange: DateRange): React.ReactNode {
  if (!dateRange.from) {
    return <span>Chọn khoảng ngày</span>
  }

  if (!dateRange.to) {
    return format(dateRange.from, "LLL dd, y")
  }

  return (
    <>
      {format(dateRange.from, "LLL dd, y", { locale: vi })} -{" "}
      {format(dateRange.to, "LLL dd, y", { locale: vi })}
    </>
  )
}

export function MaintenanceReportDateFilter({
  dateRange,
  onDateRangeChange,
}: MaintenanceReportDateFilterProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bộ lọc báo cáo</CardTitle>
        <CardDescription>Chọn khoảng thời gian để xem báo cáo.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant="outline"
              className="w-[300px] justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {getDateRangeLabel(dateRange)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={dateRange}
              onSelect={(range) =>
                range &&
                onDateRangeChange({
                  from: range.from || new Date(),
                  to: range.to || new Date(),
                })
              }
              numberOfMonths={2}
              locale={vi}
            />
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  )
}
