import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { callRpc } from '@/lib/rpc-client'

/** Shape returned by the dashboard_recent_activities RPC */
export interface RecentActivity {
  activity_id: number
  action_type: string
  action_label: string
  entity_type: string | null
  entity_label: string | null
  actor_name: string
  facility_name: string | null
  occurred_at: string
}

/**
 * Fetches recent notable activities for the dashboard feed.
 * Tenant-isolated server-side via JWT claims.
 */
export function useRecentActivities(limit = 15) {
  const { data: session } = useSession()
  const userId = session?.user?.id ? String(session.user.id) : 'anonymous'

  return useQuery<RecentActivity[]>({
    queryKey: ['dashboard-recent-activities', userId, limit],
    queryFn: () =>
      callRpc<RecentActivity[]>({
        fn: 'dashboard_recent_activities',
        args: { p_limit: limit },
      }),
    enabled: !!session,
    staleTime: 60_000,        // 1 minute
    gcTime: 5 * 60_000,       // 5 minutes
    refetchInterval: 120_000, // auto-refresh every 2 minutes
  })
}
