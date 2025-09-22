import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'

export interface UsageOverview {
  total_sessions: number
  active_sessions: number
  total_usage_time: number // minutes
}

export interface DailyUsageItem {
  date: string // ISO date
  session_count: number
  total_usage_time: number // minutes
  unique_users: number
  unique_equipment: number
}

export function useUsageAnalytics(
  days: number,
  selectedDonVi: number | null | undefined,
  effectiveTenantKey?: string
) {
  return useQuery({
    queryKey: ['reports', 'usage-analytics', { days, tenant: effectiveTenantKey || 'auto' }],
    queryFn: async (): Promise<{ overview: UsageOverview; daily: DailyUsageItem[] }> => {
      const [overview, daily] = await Promise.all([
        callRpc<UsageOverview>({ fn: 'usage_analytics_overview', args: { p_don_vi: selectedDonVi ?? null } }),
        callRpc<DailyUsageItem[]>({ fn: 'usage_analytics_daily', args: { p_days: days, p_don_vi: selectedDonVi ?? null } }),
      ])
      return { overview, daily: daily || [] }
    },
    enabled: (effectiveTenantKey ?? 'auto') !== 'unset',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
  })
}

