"use client"

import * as React from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useCalendarData, type CalendarEvent, type CalendarStats } from "@/hooks/use-calendar-data"
import type { TaskType } from "@/lib/data"

import { CalendarWidgetGrid } from "./calendar-widget/CalendarWidgetGrid"
import { CalendarWidgetHeader, CalendarWidgetMonthControls } from "./calendar-widget/CalendarWidgetHeader"
import { CalendarWidgetStats } from "./calendar-widget/CalendarWidgetStats"
import {
  CalendarGridSkeleton,
  CalendarSkeleton,
  CalendarWidgetErrorState,
  EMPTY_CALENDAR_STATS,
  type CalendarWidgetImplProps,
  type CalendarWidgetProps,
} from "./calendar-widget/CalendarWidgetShared"

let initialClientCalendarDate: Date | null = null
const EMPTY_SUBSCRIBE = () => () => {}

function useClientCalendarDate() {
  return React.useSyncExternalStore<Date | null>(
    EMPTY_SUBSCRIBE,
    () => {
      if (initialClientCalendarDate === null) {
        initialClientCalendarDate = new Date()
      }

      return initialClientCalendarDate
    },
    () => null
  )
}

function buildFilteredStats(events: CalendarEvent[]): CalendarStats {
  const total = events.length
  const completed = events.filter((event) => event.isCompleted).length
  const pending = total - completed
  const byType = events.reduce((accumulator, event) => {
    accumulator[event.type] = (accumulator[event.type] || 0) + 1
    return accumulator
  }, {} as Record<TaskType, number>)

  return { total, completed, pending, byType }
}

function useCalendarSwipeNavigation({
  onNextMonth,
  onPrevMonth,
}: {
  onNextMonth: () => void
  onPrevMonth: () => void
}) {
  const [touchStart, setTouchStart] = React.useState<number | null>(null)
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null)

  const minSwipeDistance = 50

  return {
    onTouchEnd: () => {
      if (touchStart === null || touchEnd === null) {
        return
      }

      const distance = touchStart - touchEnd
      const isLeftSwipe = distance > minSwipeDistance
      const isRightSwipe = distance < -minSwipeDistance

      if (isLeftSwipe) {
        onNextMonth()
      } else if (isRightSwipe) {
        onPrevMonth()
      }
    },
    onTouchMove: (event: React.TouchEvent) => {
      setTouchEnd(event.targetTouches[0].clientX)
    },
    onTouchStart: (event: React.TouchEvent) => {
      setTouchEnd(null)
      setTouchStart(event.targetTouches[0].clientX)
    },
  }
}

function CalendarWidgetImpl({
  className,
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarWidgetImplProps) {
  const [selectedDepartment, setSelectedDepartment] = React.useState("all")

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const { data, error, isLoading } = useCalendarData(year, month)

  const events = data?.events ?? []
  const departments = data?.departments ?? []

  const filteredEvents = React.useMemo(() => {
    if (selectedDepartment === "all") {
      return events
    }

    return events.filter((event) => event.department === selectedDepartment)
  }, [events, selectedDepartment])

  const filteredStats = React.useMemo(() => {
    return filteredEvents.length > 0 ? buildFilteredStats(filteredEvents) : EMPTY_CALENDAR_STATS
  }, [filteredEvents])

  const getEventsForDate = React.useCallback(
    (date: Date) => filteredEvents.filter((event) => isSameDay(event.date, date)),
    [filteredEvents]
  )

  const swipeHandlers = useCalendarSwipeNavigation({ onNextMonth, onPrevMonth })

  return (
    <Card className={className}>
      <CardHeader className="pb-4 md:p-8 md:pb-6">
        <CalendarWidgetHeader
          currentDate={currentDate}
          departments={departments}
          selectedDepartment={selectedDepartment}
          onNextMonth={onNextMonth}
          onPrevMonth={onPrevMonth}
          onSelectedDepartmentChange={setSelectedDepartment}
        />
        <CalendarWidgetStats stats={filteredStats} />
      </CardHeader>

      <CardContent className="md:p-8 md:pt-0" {...swipeHandlers}>
        <CalendarWidgetMonthControls
          currentDate={currentDate}
          onNextMonth={onNextMonth}
          onPrevMonth={onPrevMonth}
          onToday={onToday}
        />

        {isLoading ? (
          <CalendarGridSkeleton />
        ) : error ? (
          <CalendarWidgetErrorState />
        ) : (
          <CalendarWidgetGrid
            calendarDays={calendarDays}
            currentDate={currentDate}
            getEventsForDate={getEventsForDate}
          />
        )}
      </CardContent>
    </Card>
  )
}

export function CalendarWidget({ className }: CalendarWidgetProps) {
  const clientDate = useClientCalendarDate()
  const [overrideDate, setOverrideDate] = React.useState<Date | null>(null)

  const currentDate = overrideDate ?? clientDate

  const handlePrevMonth = () => {
    if (currentDate) {
      setOverrideDate(subMonths(currentDate, 1))
    }
  }

  const handleNextMonth = () => {
    if (currentDate) {
      setOverrideDate(addMonths(currentDate, 1))
    }
  }

  const handleToday = () => {
    setOverrideDate(new Date())
  }

  if (!currentDate) {
    return <CalendarSkeleton className={className} />
  }

  return (
    <CalendarWidgetImpl
      className={className}
      currentDate={currentDate}
      onPrevMonth={handlePrevMonth}
      onNextMonth={handleNextMonth}
      onToday={handleToday}
    />
  )
}
