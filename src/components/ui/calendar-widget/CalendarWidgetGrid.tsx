"use client"

import * as React from "react"
import { format, isSameDay, isSameMonth } from "date-fns"

import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { type CalendarEvent } from "@/hooks/use-calendar-data"

import { CalendarWidgetDayDialog } from "./CalendarWidgetDayDialog"
import { DAY_LABELS, getEventIndicatorClassName } from "./CalendarWidgetShared"

interface CalendarWidgetGridProps {
  calendarDays: Date[]
  currentDate: Date
  getEventsForDate: (date: Date) => CalendarEvent[]
}

interface CalendarWidgetGridSectionProps extends CalendarWidgetGridProps {
  compact: boolean
}

interface CalendarWidgetDayCellProps {
  compact: boolean
  currentDate: Date
  day: Date
  dayEvents: CalendarEvent[]
  today: Date
}

function CalendarWidgetDayCell({
  compact,
  currentDate,
  day,
  dayEvents,
  today,
}: CalendarWidgetDayCellProps) {
  const isCurrentMonth = isSameMonth(day, currentDate)
  const isToday = isSameDay(day, today)
  const maxIndicators = compact ? 3 : 4

  const buttonClassName = compact
    ? `h-12 p-1 flex flex-col items-center justify-center relative rounded-xl transition-all duration-200 ${
        !isCurrentMonth ? "text-gray-400" : "text-gray-900"
      } ${isToday ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg scale-105" : "hover:bg-gray-100"}`
    : `h-16 p-1.5 flex flex-col items-center justify-center relative rounded-xl transition-all duration-200 ${
        !isCurrentMonth ? "text-gray-400" : "text-gray-900"
      } ${isToday ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg scale-105" : "hover:bg-gray-100 hover:shadow-md"}`

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className={buttonClassName}>
          <span className={compact ? "text-sm font-medium" : "text-base font-semibold mb-1"}>
            {format(day, "d")}
          </span>

          {dayEvents.length > 0 ? (
            <div className={compact ? "flex gap-1 mt-1" : "flex gap-1.5 flex-wrap justify-center"}>
              {dayEvents.slice(0, maxIndicators).map((event, index) => (
                <div
                  key={event.id}
                  className={`${compact ? "w-1.5 h-1.5" : "w-2 h-2"} rounded-full animate-pulse ${getEventIndicatorClassName(event)}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                  title={compact ? undefined : `${event.type}: ${event.title}`}
                />
              ))}
              {!compact && dayEvents.length > maxIndicators ? (
                <span className={`text-xs font-medium ${isToday ? "text-white" : "text-gray-600"}`}>
                  +{dayEvents.length - maxIndicators}
                </span>
              ) : null}
            </div>
          ) : null}
        </Button>
      </DialogTrigger>

      <CalendarWidgetDayDialog compact={compact} day={day} dayEvents={dayEvents} />
    </Dialog>
  )
}

function CalendarWidgetGridSection({
  calendarDays,
  compact,
  currentDate,
  getEventsForDate,
}: CalendarWidgetGridSectionProps) {
  const today = new Date()

  return (
    <div className={compact ? "xl:hidden" : "hidden xl:block"}>
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50/80 backdrop-blur-sm border-b border-gray-200/50">
          {DAY_LABELS.map((dayLabel) => (
            <div key={dayLabel} className={compact ? "p-3 text-center" : "p-4 text-center"}>
              <span className={compact ? "text-xs font-semibold text-gray-600 uppercase tracking-wide" : "text-sm font-semibold text-gray-600 uppercase tracking-wide"}>
                {dayLabel}
              </span>
            </div>
          ))}
        </div>

        <div className={compact ? "grid grid-cols-7 gap-1 p-2" : "grid grid-cols-7 gap-2 p-3"}>
          {calendarDays.map((day) => (
            <CalendarWidgetDayCell
              key={day.toISOString()}
              compact={compact}
              currentDate={currentDate}
              day={day}
              dayEvents={getEventsForDate(day)}
              today={today}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function CalendarWidgetGrid({
  calendarDays,
  currentDate,
  getEventsForDate,
}: CalendarWidgetGridProps) {
  return (
    <div className="xl:space-y-1">
      <CalendarWidgetGridSection compact calendarDays={calendarDays} currentDate={currentDate} getEventsForDate={getEventsForDate} />
      <CalendarWidgetGridSection compact={false} calendarDays={calendarDays} currentDate={currentDate} getEventsForDate={getEventsForDate} />
    </div>
  )
}
