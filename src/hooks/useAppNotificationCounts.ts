"use client"

import { useQuery } from "@tanstack/react-query"

import { callRpc } from "@/lib/rpc-client"
import {
  EMPTY_APP_NOTIFICATION_COUNTS,
  normalizeNotificationCount,
  type AppNotificationCounts,
} from "@/lib/app-notification-counts"

interface HeaderNotificationsSummary {
  pending_repairs?: number
  pending_transfers?: number
}

interface MaintenancePlanStatusCounts {
  "Bản nháp"?: number
  "Đã duyệt"?: number
  "Không duyệt"?: number
}

interface UseAppNotificationCountsOptions {
  enabled?: boolean
}

interface UseAppNotificationCountsResult {
  counts: AppNotificationCounts
  isLoading: boolean
}

const APP_NOTIFICATION_COUNTS_QUERY_KEY = ["app-notification-counts"] as const

export function useAppNotificationCounts(
  options: UseAppNotificationCountsOptions = {}
): UseAppNotificationCountsResult {
  const { enabled = true } = options
  const { data, isLoading } = useQuery<AppNotificationCounts>({
    queryKey: APP_NOTIFICATION_COUNTS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const [headerSummaryResult, maintenanceCountsResult] = await Promise.allSettled([
        callRpc<HeaderNotificationsSummary>({
          fn: "header_notifications_summary",
          signal,
        }),
        callRpc<MaintenancePlanStatusCounts | null, Record<string, never>>({
          fn: "maintenance_plan_status_counts",
          args: {},
          signal,
        }),
      ])

      if (headerSummaryResult.status === "rejected") {
        console.error("Header notifications error:", headerSummaryResult.reason)
      }

      if (maintenanceCountsResult.status === "rejected") {
        console.error("Maintenance notification counts error:", maintenanceCountsResult.reason)
      }

      return {
        repair:
          headerSummaryResult.status === "fulfilled"
            ? normalizeNotificationCount(headerSummaryResult.value?.pending_repairs)
            : 0,
        transfer:
          headerSummaryResult.status === "fulfilled"
            ? normalizeNotificationCount(headerSummaryResult.value?.pending_transfers)
            : 0,
        maintenance:
          maintenanceCountsResult.status === "fulfilled"
            ? normalizeNotificationCount(maintenanceCountsResult.value?.["Đã duyệt"])
            : 0,
      }
    },
    enabled,
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    counts: enabled ? (data ?? EMPTY_APP_NOTIFICATION_COUNTS) : EMPTY_APP_NOTIFICATION_COUNTS,
    isLoading: enabled ? isLoading : false,
  }
}
