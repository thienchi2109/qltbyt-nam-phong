"use client"

import * as React from "react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import type { DateRange } from "../hooks/use-maintenance-data.types"

interface MaintenanceReportDateFilterRange {
  from?: Date
  to?: Date
}

interface MaintenanceReportDateFilterProps {
  dateRange: MaintenanceReportDateFilterRange
  onDateRangeChange: (dateRange: DateRange) => void
}

function getDateRangeLabel(dateRange: MaintenanceReportDateFilterRange): React.ReactNode {
  if (!dateRange.from) {
    return <span>Chọn khoảng ngày</span>
  }

  if (!dateRange.to) {
    return format(dateRange.from, "LLL dd, y", { locale: vi })
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
  const filterControls = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="date"
          variant="outline"
          className="h-9 w-full justify-start text-left font-normal sm:w-[300px]"
        >
          <CalendarIcon className="mr-2 size-4" />
          {getDateRangeLabel(dateRange)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={dateRange.from}
          selected={{ from: dateRange.from, to: dateRange.to }}
          onSelect={(range) =>
            range?.from &&
            onDateRangeChange({
              from: range.from,
              to: range.to ?? range.from,
            })
          }
          numberOfMonths={2}
          locale={vi}
        />
      </PopoverContent>
    </Popover>
  )

  return (
    <ListFilterSearchCard
      title="Bộ lọc báo cáo"
      description="Chọn khoảng thời gian để xem báo cáo."
      filterControls={filterControls}
    />
  )
}
