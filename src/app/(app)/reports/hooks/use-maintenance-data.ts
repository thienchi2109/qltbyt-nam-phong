import { useQuery } from '@tanstack/react-query'
import { supabase } from "@/lib/supabase"
import { format, startOfYear, endOfYear } from "date-fns"

// Query keys for maintenance reports caching
export const maintenanceReportKeys = {
  all: ['maintenance-reports'] as const,
  data: (filters: Record<string, any>) => [...maintenanceReportKeys.all, { filters }] as const,
}

interface DateRange {
  from: Date
  to: Date
}

// Default date range is the current year
const defaultDateRange: DateRange = {
  from: startOfYear(new Date()),
  to: endOfYear(new Date()),
}

export function useMaintenanceReportData(
  dateRange: DateRange = defaultDateRange
) {
  const fromDate = format(dateRange.from, 'yyyy-MM-dd')
  const toDate = format(dateRange.to, 'yyyy-MM-dd')

  return useQuery({
    queryKey: maintenanceReportKeys.data({ from: fromDate, to: toDate }),
    queryFn: async () => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      console.log('Fetching maintenance report data for date range:', fromDate, 'to', toDate)

      // --- 1. Fetch ALL Repair Data first to debug ---
      const { data: allRepairData, error: allRepairError } = await supabase
        .from('yeu_cau_sua_chua')
        .select('*')

      if (allRepairError) {
        console.error('Error fetching repair data:', allRepairError)
        throw allRepairError
      }

      console.log('Total repair requests in database:', allRepairData?.length || 0)
      console.log('Sample repair data:', allRepairData?.slice(0, 2))

      // Filter by date range
      const repairData = allRepairData?.filter(r => {
        const requestDate = r.ngay_yeu_cau || r.created_at
        if (!requestDate) return false
        const dateStr = requestDate.split('T')[0] // Get YYYY-MM-DD part
        return dateStr >= fromDate && dateStr <= toDate
      }) || []

      console.log('Repair requests in date range:', repairData.length)

      // --- 2. Fetch ALL Maintenance Plans ---
      const { data: allMaintenancePlansData, error: maintenancePlansError } = await supabase
        .from('ke_hoach_bao_tri')
        .select('*')

      if (maintenancePlansError) {
        console.error('Error fetching maintenance plans:', maintenancePlansError)
        throw maintenancePlansError
      }

      console.log('Total maintenance plans:', allMaintenancePlansData?.length || 0)
      console.log('Sample maintenance plan:', allMaintenancePlansData?.[0])

      // Filter approved plans for current year
      const currentYear = new Date().getFullYear()
      const approvedPlans = allMaintenancePlansData?.filter(plan => 
        plan.nam === currentYear && plan.trang_thai === 'Đã duyệt'
      ) || []

      console.log('Approved plans for year', currentYear, ':', approvedPlans.length)

      // --- 3. Fetch Maintenance Tasks ---
      let maintenanceTasksData: any[] = []
      
      if (approvedPlans.length > 0) {
        const planIds = approvedPlans.map(plan => plan.id)
        
        const { data: tasksData, error: tasksError } = await supabase
          .from('cong_viec_bao_tri')
          .select('*')
          .in('ke_hoach_id', planIds)

        if (tasksError) {
          console.error('Error fetching maintenance tasks:', tasksError)
          throw tasksError
        }

        maintenanceTasksData = tasksData || []
        console.log('Maintenance tasks for approved plans:', maintenanceTasksData.length)
      }
      
      // --- 4. Process Repair Data ---
      const totalRepairs = repairData.length
      const completedRepairs = repairData.filter(r => r.trang_thai === 'Hoàn thành').length
      const notCompletedRepairs = repairData.filter(r => r.trang_thai === 'Không HT').length
      const pendingRepairs = repairData.filter(r => r.trang_thai === 'Chờ xử lý').length
      const approvedRepairs = repairData.filter(r => r.trang_thai === 'Đã duyệt').length
      
      const totalFinishedRepairs = completedRepairs + notCompletedRepairs
      const repairCompletionRate = totalRepairs > 0 ? (completedRepairs / totalRepairs) * 100 : 0
      
      console.log('Repair status breakdown:', {
        total: totalRepairs,
        completed: completedRepairs,
        notCompleted: notCompletedRepairs,
        approved: approvedRepairs,
        pending: pendingRepairs
      })

      const repairStatusDistribution = [
        { name: 'Hoàn thành', value: completedRepairs, color: 'hsl(var(--chart-1))' },
        { name: 'Không HT', value: notCompletedRepairs, color: 'hsl(var(--chart-5))' },
        { name: 'Đã duyệt', value: approvedRepairs, color: 'hsl(var(--chart-2))' },
        { name: 'Chờ xử lý', value: pendingRepairs, color: 'hsl(var(--chart-3))' },
      ].filter(item => item.value > 0)

      // --- 5. Process Maintenance Data ---
      const maintenanceTypes = ['Bảo trì', 'Hiệu chuẩn', 'Kiểm định']
      const maintenancePlanVsActual = maintenanceTypes.map(type => {
        // Count tasks for this type
        const tasksOfType = maintenanceTasksData.filter(task => task.loai_cong_viec === type)
        
        // Count planned months
        let plannedMonths = 0
        let completedMonths = 0
        
        tasksOfType.forEach(task => {
          for (let month = 1; month <= 12; month++) {
            const plannedField = `thang_${month}` as keyof typeof task
            const completedField = `thang_${month}_hoan_thanh` as keyof typeof task
            
            if (task[plannedField]) {
              plannedMonths++
            }
            
            if (task[completedField]) {
              completedMonths++
            }
          }
        })

        return { 
          name: type, 
          planned: plannedMonths, 
          actual: completedMonths 
        }
      })

      // Calculate totals
      const totalMaintenancePlanned = maintenancePlanVsActual.reduce((sum, item) => sum + item.planned, 0)
      const totalMaintenanceCompleted = maintenancePlanVsActual.reduce((sum, item) => sum + item.actual, 0)
      const maintenanceCompletionRate = totalMaintenancePlanned > 0 ? (totalMaintenanceCompleted / totalMaintenancePlanned) * 100 : 0

      console.log('Maintenance breakdown:', {
        totalPlanned: totalMaintenancePlanned,
        totalCompleted: totalMaintenanceCompleted,
        completionRate: maintenanceCompletionRate,
        byType: maintenancePlanVsActual
      })
      
      const result = {
        summary: {
          totalRepairs,
          repairCompletionRate,
          totalMaintenancePlanned,
          maintenanceCompletionRate,
        },
        charts: {
          repairStatusDistribution,
          maintenancePlanVsActual
        }
      }

      console.log('Final result:', result)
      return result
    },
    staleTime: 30 * 1000, // 30 seconds for debugging
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
} 