"use client"

import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { parseLocalDate } from '@/lib/date-utils'
import { type TaskType } from '@/lib/data'

export interface CalendarEvent {
  id: number
  title: string
  type: TaskType
  date: Date
  equipmentCode: string
  equipmentName: string
  department: string | null
  isCompleted: boolean
  planName: string
  planId: number
  taskId: number
}

export interface CalendarStats {
  total: number
  completed: number
  pending: number
  byType: Record<TaskType, number>
}

interface CalendarDataResponse {
  events: Array<{
    id: number
    title: string
    type: TaskType
    date: string
    equipmentCode: string
    equipmentName: string
    department: string
    isCompleted: boolean
    planName: string
    planId: number
    taskId: number
  }>
  departments: string[]
  stats: CalendarStats
}

export function useCalendarData(year: number, month: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['calendar-events', year, month],
    queryFn: async (): Promise<{ events: CalendarEvent[], departments: string[], stats: CalendarStats }> => {
      // Call RPC with proper JWT claims and regional leader support
      const data = await callRpc<CalendarDataResponse, { p_year: number; p_month: number }>({
        fn: 'maintenance_calendar_events',
        args: { p_year: year, p_month: month },
      })

      if (!data || !data.events) {
        return {
          events: [],
          departments: [],
          stats: { total: 0, completed: 0, pending: 0, byType: {} as Record<TaskType, number> }
        }
      }

      // Transform events: convert date strings to Date objects
      const calendarEvents: CalendarEvent[] = data.events.map(event => ({
        ...event,
        date: parseLocalDate(event.date) ?? new Date()
      }))

      return {
        events: calendarEvents,
        departments: data.departments || [],
        stats: data.stats || { total: 0, completed: 0, pending: 0, byType: {} as Record<TaskType, number> }
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: options?.enabled ?? true,
  })
}
