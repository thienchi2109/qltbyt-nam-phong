"use client"

import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { type CalendarEvent, type CalendarStats } from "@/hooks/use-calendar-data"
import type { TaskType } from "@/lib/data"

export interface CalendarWidgetProps {
  className?: string
}

export interface CalendarWidgetImplProps extends CalendarWidgetProps {
  currentDate: Date
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
}

export const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const

export const EMPTY_CALENDAR_STATS: CalendarStats = {
  total: 0,
  completed: 0,
  pending: 0,
  byType: {} as Record<TaskType, number>,
}

const CALENDAR_SKELETON_ROW_KEYS = [
  "calendar-skeleton-row-1",
  "calendar-skeleton-row-2",
  "calendar-skeleton-row-3",
  "calendar-skeleton-row-4",
  "calendar-skeleton-row-5",
  "calendar-skeleton-row-6",
] as const

const CALENDAR_SKELETON_COL_KEYS = [
  "calendar-skeleton-col-1",
  "calendar-skeleton-col-2",
  "calendar-skeleton-col-3",
  "calendar-skeleton-col-4",
  "calendar-skeleton-col-5",
  "calendar-skeleton-col-6",
  "calendar-skeleton-col-7",
] as const

export function getEventTypeColor(type: TaskType, isCompleted: boolean) {
  if (isCompleted) {
    return "bg-green-100 text-green-800 border-green-200"
  }

  switch (type) {
    case "Bảo trì":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "Hiệu chuẩn":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "Kiểm định":
      return "bg-purple-100 text-purple-800 border-purple-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

export function getEventTypeIcon(type: TaskType) {
  switch (type) {
    case "Bảo trì":
      return "🔧"
    case "Hiệu chuẩn":
      return "📏"
    case "Kiểm định":
      return "✅"
    default:
      return "📅"
  }
}

export function getEventIndicatorClassName(event: CalendarEvent) {
  if (event.isCompleted) {
    return "bg-green-400"
  }

  switch (event.type) {
    case "Bảo trì":
      return "bg-blue-400"
    case "Hiệu chuẩn":
      return "bg-orange-400"
    default:
      return "bg-purple-400"
  }
}

function getEventCardClassName(event: CalendarEvent, compact: boolean) {
  const stateClassName = event.isCompleted
    ? "border-green-500 bg-green-50/80"
    : event.type === "Bảo trì"
      ? "border-blue-500 bg-blue-50/80"
      : event.type === "Hiệu chuẩn"
        ? "border-orange-500 bg-orange-50/80"
        : "border-purple-500 bg-purple-50/80"

  if (compact) {
    return `p-4 rounded-xl border-l-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] ${stateClassName}`
  }

  return `p-4 rounded-xl border-l-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${stateClassName}`
}

export function CalendarGridSkeleton() {
  return (
    <div className="space-y-2">
      {CALENDAR_SKELETON_ROW_KEYS.map((rowKey) => (
        <div key={rowKey} className="grid grid-cols-7 gap-1">
          {CALENDAR_SKELETON_COL_KEYS.map((colKey) => (
            <Skeleton key={`${rowKey}-${colKey}`} className="h-20 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CalendarWidgetErrorState(): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-12 text-center text-destructive"
    >
      <CalendarIcon className="mb-3 h-8 w-8" />
      <p className="font-semibold">Không thể tải lịch bảo trì</p>
      <p className="mt-1 text-sm text-muted-foreground">Vui lòng thử lại sau.</p>
    </div>
  )
}

export function CalendarSkeleton({ className }: CalendarWidgetProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-4 md:p-8 md:pb-6">
        <CardTitle className="flex items-center gap-2 text-responsive-lg md:text-2xl font-semibold leading-none tracking-tight">
          <CalendarIcon className="h-4 w-4 md:h-5 md:w-5" />
          <span className="line-clamp-2 md:line-clamp-1">Lịch Bảo trì/Hiệu chuẩn/Kiểm định</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="md:p-8 md:pt-0">
        <CalendarGridSkeleton />
      </CardContent>
    </Card>
  )
}

export function CalendarEventCard({
  compact,
  event,
}: {
  compact: boolean
  event: CalendarEvent
}) {
  return (
    <div className={getEventCardClassName(event, compact)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className={compact ? "flex items-center gap-2 mb-2" : "flex items-center gap-2 mb-2"}>
            <span className={compact ? "text-lg" : "text-xl"}>{getEventTypeIcon(event.type)}</span>
            <Badge className={`text-xs font-medium ${getEventTypeColor(event.type, event.isCompleted)}`}>
              {event.type}
            </Badge>
          </div>
          <h4 className={compact ? "font-semibold text-gray-900 mb-1" : "font-semibold text-gray-900 mb-1 text-base"}>
            {event.title}
          </h4>
          <p className="text-sm text-gray-600 mb-2">{event.department}</p>
          {event.equipmentCode ? (
            <p className="text-xs text-gray-500">{event.equipmentCode}</p>
          ) : null}
        </div>
        {event.isCompleted ? (
          <Badge
            variant="secondary"
            className={compact ? "bg-green-100 text-green-800 text-xs ml-2" : "bg-green-100 text-green-800 text-xs ml-2"}
          >
            ✓ Hoàn thành
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

export function CalendarEmptyDayState({ compact }: { compact: boolean }) {
  return compact ? (
    <div className="text-center py-8">
      <div className="p-4 bg-gray-100/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <CalendarIcon className="h-8 w-8 text-gray-400" />
      </div>
      <p className="text-gray-500 text-sm">Không có công việc nào trong ngày này</p>
    </div>
  ) : (
    <div className="text-center py-12">
      <div className="p-4 bg-gray-100/50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
        <CalendarIcon className="h-10 w-10 text-gray-400" />
      </div>
      <p className="text-gray-500">Không có công việc nào trong ngày này</p>
    </div>
  )
}
