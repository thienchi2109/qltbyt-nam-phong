"use client"

import * as React from "react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CalendarWidgetHeaderProps {
  currentDate: Date
  departments: string[]
  selectedDepartment: string
  onNextMonth: () => void
  onPrevMonth: () => void
  onSelectedDepartmentChange: (value: string) => void
}

interface CalendarWidgetMonthControlsProps {
  currentDate: Date
  onNextMonth: () => void
  onPrevMonth: () => void
  onToday: () => void
}

function DepartmentFilterSelect({
  departments,
  selectedDepartment,
  onSelectedDepartmentChange,
  triggerClassName,
}: {
  departments: string[]
  selectedDepartment: string
  onSelectedDepartmentChange: (value: string) => void
  triggerClassName: string
}) {
  return (
    <Select value={selectedDepartment} onValueChange={onSelectedDepartmentChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder="Chọn khoa/phòng" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tất cả khoa/phòng</SelectItem>
        {departments.map((department) => (
          <SelectItem key={department} value={department}>
            {department}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CalendarWidgetHeader({
  currentDate,
  departments,
  selectedDepartment,
  onNextMonth,
  onPrevMonth,
  onSelectedDepartmentChange,
}: CalendarWidgetHeaderProps) {
  return (
    <>
      <div className="xl:hidden sticky top-0 z-10 -mx-4 -mt-4 bg-white/80 backdrop-blur-md border-b border-gray-200/50 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <CalendarIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Lịch công việc</h2>
              <p className="text-sm text-gray-500">{format(currentDate, "MMMM yyyy", { locale: vi })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-9 w-9 rounded-lg" onClick={onPrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-9 w-9 rounded-lg" onClick={onNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden xl:block">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <CalendarIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">Lịch công việc</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Bảo trì, Hiệu chuẩn và Kiểm định thiết bị</p>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/50 p-1">
            <DepartmentFilterSelect
              departments={departments}
              selectedDepartment={selectedDepartment}
              onSelectedDepartmentChange={onSelectedDepartmentChange}
              triggerClassName="w-[200px] border-0 bg-transparent"
            />
          </div>
        </div>
      </div>

      <div className="xl:hidden mb-3">
        <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/50 p-1">
          <DepartmentFilterSelect
            departments={departments}
            selectedDepartment={selectedDepartment}
            onSelectedDepartmentChange={onSelectedDepartmentChange}
            triggerClassName="w-full border-0 bg-transparent"
          />
        </div>
      </div>
    </>
  )
}

export function CalendarWidgetMonthControls({
  currentDate,
  onNextMonth,
  onPrevMonth,
  onToday,
}: CalendarWidgetMonthControlsProps) {
  return (
    <>
      <div className="hidden xl:flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="default" onClick={onPrevMonth} className="rounded-xl hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="default" onClick={onToday} className="rounded-xl hover:bg-gray-100 font-medium">
            Hôm nay
          </Button>
          <Button variant="outline" size="default" onClick={onNextMonth} className="rounded-xl hover:bg-gray-100">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <h3 className="text-xl font-bold text-gray-700">
          {format(currentDate, "MMMM yyyy", { locale: vi })}
        </h3>
      </div>

      <div className="xl:hidden flex justify-center mb-3">
        <Button variant="outline" size="sm" onClick={onToday} className="rounded-lg">
          Hôm nay
        </Button>
      </div>
    </>
  )
}
