"use client"

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { type MaintenanceTask, type MaintenancePlan, TaskType } from '@/lib/data'

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

export function useCalendarData(year: number, month: number) {
  return useQuery({
    queryKey: ['calendar-events', year, month],
    queryFn: async (): Promise<{ events: CalendarEvent[], departments: string[], stats: CalendarStats }> => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      // Fetch approved maintenance plans for current year
      const { data: plans, error: plansError } = await supabase
        .from('ke_hoach_bao_tri')
        .select(`
          id,
          ten_ke_hoach,
          nam,
          khoa_phong,
          loai_cong_viec,
          trang_thai
        `)
        .eq('nam', year)
        .eq('trang_thai', 'Đã duyệt')

      if (plansError) throw plansError

      if (!plans || plans.length === 0) {
        return {
          events: [],
          departments: [],
          stats: { total: 0, completed: 0, pending: 0, byType: {} as Record<TaskType, number> }
        }
      }

      // Fetch tasks for these plans that are scheduled for current month
      const planIds = plans.map(p => p.id)
      const monthField = `thang_${month}` as keyof MaintenanceTask
      const completionField = `thang_${month}_hoan_thanh` as keyof MaintenanceTask

      const { data: tasks, error: tasksError } = await supabase
        .from('cong_viec_bao_tri')
        .select(`
          id,
          ke_hoach_id,
          thiet_bi_id,
          loai_cong_viec,
          ${monthField},
          ${completionField},
          thiet_bi (
            ma_thiet_bi,
            ten_thiet_bi,
            khoa_phong_quan_ly
          )
        `)
        .in('ke_hoach_id', planIds)
        .eq(monthField, true)

      if (tasksError) throw tasksError

      // Transform tasks into calendar events
      const calendarEvents: CalendarEvent[] = []
      const deptSet = new Set<string>()

      if (tasks) {
        tasks.forEach((task: any) => {
          const plan = plans.find(p => p.id === task.ke_hoach_id)
          if (!plan || !task.thiet_bi) return

          const dept = task.thiet_bi.khoa_phong_quan_ly || plan.khoa_phong || "Không xác định"
          deptSet.add(dept)

          // Set event date to middle of month (day 15) for now
          // In future versions, you might want to have specific scheduled dates
          const eventDate = new Date(year, month - 1, 15)
          
          calendarEvents.push({
            id: task.id,
            title: task.thiet_bi.ten_thiet_bi,
            type: task.loai_cong_viec || plan.loai_cong_viec,
            date: eventDate,
            equipmentCode: task.thiet_bi.ma_thiet_bi,
            equipmentName: task.thiet_bi.ten_thiet_bi,
            department: dept,
            isCompleted: !!task[completionField],
            planName: plan.ten_ke_hoach,
            planId: plan.id,
            taskId: task.id
          })
        })
      }

      // Calculate statistics
      const total = calendarEvents.length
      const completed = calendarEvents.filter(e => e.isCompleted).length
      const pending = total - completed
      const byType = calendarEvents.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1
        return acc
      }, {} as Record<TaskType, number>)

      const stats: CalendarStats = { total, completed, pending, byType }

      return {
        events: calendarEvents,
        departments: Array.from(deptSet).sort(),
        stats
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  })
}

// Hook to mark a maintenance task as completed
export function useMarkTaskCompleted() {
  return async (taskId: number, month: number, planName: string) => {
    if (!supabase) {
      throw new Error('Supabase client not initialized')
    }

    const completionDate = new Date().toISOString()
    const completionFieldName = `thang_${month}_hoan_thanh`
    const completionDateFieldName = `ngay_hoan_thanh_${month}`

    // Update completion status
    const { error: taskUpdateError } = await supabase
      .from('cong_viec_bao_tri')
      .update({
        [completionFieldName]: true,
        [completionDateFieldName]: completionDate,
        updated_at: completionDate
      })
      .eq('id', taskId)

    if (taskUpdateError) throw taskUpdateError

    return { success: true }
  }
} 