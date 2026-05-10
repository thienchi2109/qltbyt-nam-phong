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

interface InventoryReportFilterSectionProps {
  dateRange: DateRange
  onDateRangeChange: (dateRange: DateRange) => void
  selectedDepartment: string
  onSelectedDepartmentChange: (department: string) => void
  searchTerm: string
  onSearchTermChange: (searchTerm: string) => void
  departments: string[]
  isGlobalOrRegionalLeader?: boolean
  isLoading: boolean
  onRefresh: () => void
  onExport: () => void
}

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
  const filterControls = (
    <>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Khoảng thời gian</label>
        <div className="flex flex-wrap gap-2">
          <InventoryReportDateButton
            label="Từ ngày"
            value={dateRange.from}
            onSelect={(date) => onDateRangeChange({ ...dateRange, from: date })}
            isDateDisabled={(date) => date > new Date() || date < new Date("1900-01-01")}
          />
          <InventoryReportDateButton
            label="Đến ngày"
            value={dateRange.to}
            onSelect={(date) => onDateRangeChange({ ...dateRange, to: date })}
            isDateDisabled={(date) => date > new Date() || date < dateRange.from}
          />
        </div>
      </div>

      {!isGlobalOrRegionalLeader ? (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Khoa/Phòng</label>
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
        </div>
      ) : null}
    </>
  )

  const actions = (
    <>
      <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
        Làm mới
      </Button>
      <Button onClick={onExport}>
        <Download className="mr-2 h-4 w-4" />
        Xuất báo cáo
      </Button>
    </>
  )

  return (
    <ListFilterSearchCard
      title={(
        <span className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
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
  label: string
  value: Date
  onSelect: (date: Date) => void
  isDateDisabled: (date: Date) => boolean
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
          <CalendarIcon className="mr-2 h-4 w-4" />
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
