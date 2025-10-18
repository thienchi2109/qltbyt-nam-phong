import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { format, startOfYear, endOfYear } from 'date-fns'

interface DateRange {
  from: Date
  to: Date
}

interface RepairFrequencyPoint {
  period: string
  total: number
  completed: number
}

interface TopEquipmentRepairEntry {
  equipmentId: number
  equipmentName: string
  totalRequests: number
  latestStatus: string
  latestCompletedDate?: string | null
}

interface RecentRepairHistoryEntry {
  id: number
  equipmentName: string
  issue: string
  status: string
  requestedDate: string
  completedDate?: string | null
}

interface MaintenanceReportData {
  summary: {
    totalRepairs: number
    repairCompletionRate: number
    totalMaintenancePlanned: number
    maintenanceCompletionRate: number
  }
  charts: {
    repairStatusDistribution: Array<{
      name: string
      value: number
      color: string
    }>
    maintenancePlanVsActual: Array<{
      name: string
      planned: number
      actual: number
    }>
    repairFrequencyByMonth?: RepairFrequencyPoint[]
  }
  topEquipmentRepairs?: TopEquipmentRepairEntry[]
  recentRepairHistory?: RecentRepairHistoryEntry[]
}

// Query keys for maintenance reports caching
export const maintenanceReportKeys = {
  all: ['maintenance-reports'] as const,
  data: (filters: Record<string, any>) => [...maintenanceReportKeys.all, { filters }] as const,
}

// Default date range is the current year
const defaultDateRange: DateRange = {
  from: startOfYear(new Date()),
  to: endOfYear(new Date()),
}

export function useMaintenanceReportData(
  dateRange: DateRange = defaultDateRange,
  selectedDonVi?: number | null,
  effectiveTenantKey?: string
) {
  const fromDate = format(dateRange.from, 'yyyy-MM-dd')
  const toDate = format(dateRange.to, 'yyyy-MM-dd')

  return useQuery({
    queryKey: maintenanceReportKeys.data({ 
      from: fromDate, 
      to: toDate,
      tenant: effectiveTenantKey || 'auto'
    }),
    queryFn: async (): Promise<MaintenanceReportData> => {
      // ✅ Use RPC with proper security - replaces direct Supabase queries
      const result = await callRpc<MaintenanceReportData>({
        fn: 'get_maintenance_report_data',
        args: {
          p_date_from: fromDate,
          p_date_to: toDate,
          p_don_vi: selectedDonVi ?? null
        }
      })

      return result || {
        summary: {
          totalRepairs: 0,
          repairCompletionRate: 0,
          totalMaintenancePlanned: 0,
          maintenanceCompletionRate: 0,
        },
        charts: {
          repairStatusDistribution: [],
          maintenancePlanVsActual: [],
          repairFrequencyByMonth: []
        },
        topEquipmentRepairs: [],
        recentRepairHistory: []
      }
    },
    enabled: (effectiveTenantKey ?? 'auto') !== 'unset',  // ✅ Gate for global users
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: 2,
  })
} 