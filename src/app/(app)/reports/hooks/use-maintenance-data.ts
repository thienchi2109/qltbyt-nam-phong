import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { format, startOfYear, endOfYear } from 'date-fns'
import {
  defaultMaintenanceReportData,
  type DateRange,
  mergeMaintenanceReportData,
  type MaintenanceReportData,
} from './use-maintenance-data.types'

export { defaultMaintenanceReportData } from './use-maintenance-data.types'

// Query keys for maintenance reports caching
export const maintenanceReportKeys = {
  all: ['maintenance-reports'] as const,
  data: (filters: Record<string, unknown>) => [...maintenanceReportKeys.all, { filters }] as const,
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

      return mergeMaintenanceReportData(result)
    },
    enabled: (effectiveTenantKey ?? 'auto') !== 'unset',  // ✅ Gate for global users
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: 2,
  })
} 
