"use client"

import * as React from "react"
import { CalendarIcon, Download, FileText } from "lucide-react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { cn } from "@/lib/utils"
import type { DateRange } from "../hooks/use-report-filters"

const MIN_REPORT_DATE = new Date("1900-01-01")
let maxReportDateSnapshot = new Date()

function getMaxReportDateSnapshot(): Date {
  return maxReportDateSnapshot
}

function subscribeToMaxReportDate(onStoreChange: () => void) {
  let refreshTimer: ReturnType<typeof setTimeout>

  const scheduleNextReportDateRefresh = () => {
    const now = new Date()
    const nextLocalMidnight = new Date(now)
    nextLocalMidnight.setHours(24, 0, 0, 0)

    refreshTimer = setTimeout(
      () => {
        maxReportDateSnapshot = new Date()
        onStoreChange()
        scheduleNextReportDateRefresh()
      },
      Math.max(nextLocalMidnight.getTime() - now.getTime(), 1000)
    )
  }

  scheduleNextReportDateRefresh()

  return () => clearTimeout(refreshTimer)
}

interface InventoryReportFilterSectionProps {
  readonly dateRange: DateRange
  readonly onDateRangeChange: (dateRange: DateRange) => void
  readonly selectedDepartment: string
  readonly onSelectedDepartmentChange: (department: string) => void
  readonly searchTerm: string
  readonly onSearchTermChange: (searchTerm: string) => void
  readonly departments: string[]
  readonly isGlobalOrRegionalLeader?: boolean
  readonly isLoading: boolean
  readonly onRefresh: () => void
  readonly onExport: () => void
}

/** Renders inventory report filters, refresh, and export controls. */
export function InventoryReportFilterSection({
  dateRange,
  onDateRangeChange,
  selectedDepartment,
  onSelectedDepartmentChange,
  searchTerm,
  onSearchTermChange,
  departments,
  isGlobalOrRegionalLeader,
  isLoading,
  onRefresh,
  onExport,
}: InventoryReportFilterSectionProps) {
  const maxReportDate = React.useSyncExternalStore(
    subscribeToMaxReportDate,
    getMaxReportDateSnapshot,
    getMaxReportDateSnapshot,
  )

  const filterControls = (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Khoảng thời gian</legend>
        <div className="flex flex-wrap gap-2">
          <InventoryReportDateButton
            label="Từ ngày"
            value={dateRange.from}
            onSelect={(date) => onDateRangeChange({ ...dateRange, from: date })}
            isDateDisabled={(date) => date > maxReportDate || date < MIN_REPORT_DATE}
          />
          <InventoryReportDateButton
            label="Đến ngày"
            value={dateRange.to}
            onSelect={(date) => onDateRangeChange({ ...dateRange, to: date })}
            isDateDisabled={(date) => date > maxReportDate || date < dateRange.from}
          />
        </div>
      </fieldset>

      {!isGlobalOrRegionalLeader ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Khoa/Phòng</legend>
          <Select value={selectedDepartment} onValueChange={onSelectedDepartmentChange}>
            <SelectTrigger className="h-9 w-full min-w-[200px] md:w-[200px]">
              <SelectValue placeholder="Chọn khoa/phòng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department} value={department}>
                  {department || "Chưa phân loại"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>
      ) : null}
    </>
  )

  const actions = (
    <>
      <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
        Làm mới
      </Button>
      <Button onClick={onExport}>
        <Download className="mr-2 size-4" />
        Xuất báo cáo
      </Button>
    </>
  )

  return (
    <ListFilterSearchCard
      title={(
        <span className="flex items-center gap-2">
          <FileText className="size-5" />
          Báo cáo Xuất-Nhập-Tồn thiết bị
        </span>
      )}
      description="Theo dõi tình hình xuất, nhập và tồn kho thiết bị theo thời gian"
      searchValue={searchTerm}
      onSearchChange={onSearchTermChange}
      searchPlaceholder="Tên hoặc mã thiết bị..."
      showSearchIcon={false}
      searchClassName="md:min-w-[220px] md:max-w-[320px]"
      filterControls={filterControls}
      actions={actions}
    />
  )
}

interface InventoryReportDateButtonProps {
  readonly label: string
  readonly value: Date
  readonly onSelect: (date: Date) => void
  readonly isDateDisabled: (date: Date) => boolean
}

function InventoryReportDateButton({
  label,
  value,
  onSelect,
  isDateDisabled,
}: InventoryReportDateButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 w-[140px] justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value ? format(value, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => date && onSelect(date)}
          disabled={isDateDisabled}
          initialFocus
          locale={vi}
        />
      </PopoverContent>
    </Popover>
  )
}
