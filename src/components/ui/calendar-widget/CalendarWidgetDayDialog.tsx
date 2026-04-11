"use client"

import * as React from "react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"

import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type CalendarEvent } from "@/hooks/use-calendar-data"

import { CalendarEmptyDayState, CalendarEventCard } from "./CalendarWidgetShared"

interface CalendarWidgetDayDialogProps {
  compact: boolean
  day: Date
  dayEvents: CalendarEvent[]
}

export function CalendarWidgetDayDialog({
  compact,
  day,
  dayEvents,
}: CalendarWidgetDayDialogProps) {
  return (
    <DialogContent
      className={
        compact
          ? "xl:hidden max-w-sm mx-4 bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-2xl"
          : "hidden xl:block max-w-lg bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-2xl"
      }
    >
      <DialogHeader className={compact ? "pb-4 border-b border-gray-200/50" : "pb-4 border-b border-gray-200/50"}>
        <DialogTitle className={compact ? "text-lg font-bold text-gray-900" : "text-xl font-bold text-gray-900"}>
          {format(day, "EEEE, dd MMMM yyyy", { locale: vi })}
        </DialogTitle>
      </DialogHeader>

      <div className="py-4">
        {dayEvents.length > 0 ? (
          compact ? (
            <div className="space-y-3">
              {dayEvents.map((event) => (
                <CalendarEventCard key={event.id} compact event={event} />
              ))}
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-3 pr-4">
                {dayEvents.map((event) => (
                  <CalendarEventCard key={event.id} compact={false} event={event} />
                ))}
              </div>
            </ScrollArea>
          )
        ) : (
          <CalendarEmptyDayState compact={compact} />
        )}
      </div>
    </DialogContent>
  )
}
