import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'

export interface MaintenanceStats {
  repair_summary: {
    total_requests: number
    completed: number
    pending: number
    in_progress: number
  }
  maintenance_summary: {
    total_plans: number
    total_tasks: number
    completed_tasks: number
  }
}

export interface DateRange { from: Date; to: Date }

export function useMaintenanceStats(
  dateRange: DateRange,
  selectedDepartment: string,
  selectedDonVi: number | null | undefined,
  effectiveTenantKey?: string
) {
  return useQuery({
    queryKey: ['reports', 'maintenance-stats', {
      from: dateRange.from.toISOString().slice(0,10),
      to: dateRange.to.toISOString().slice(0,10),
      dept: selectedDepartment,
      tenant: effectiveTenantKey || 'auto'
    }],
    queryFn: async (): Promise<MaintenanceStats> => {
      try {
        const res = await callRpc<MaintenanceStats>({
          fn: 'maintenance_stats_for_reports',
          args: {
            p_date_from: dateRange.from.toISOString().slice(0,10),
            p_date_to: dateRange.to.toISOString().slice(0,10),
            p_don_vi: selectedDonVi ?? null,
            p_khoa_phong: selectedDepartment !== 'all' ? selectedDepartment : null,
          }
        })
        return res
      } catch (e) {
        // Graceful fallback to zeros to keep UI/export stable if RPC fails
        return {
          repair_summary: { total_requests: 0, completed: 0, pending: 0, in_progress: 0 },
          maintenance_summary: { total_plans: 0, total_tasks: 0, completed_tasks: 0 },
        }
      }
    },
    enabled: (effectiveTenantKey ?? 'auto') !== 'unset',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
  })
}
