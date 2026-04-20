"use client"

import * as React from "react"

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

export function useAppNotificationCounts(
  options: UseAppNotificationCountsOptions = {}
): UseAppNotificationCountsResult {
  const { enabled = true } = options
  const [counts, setCounts] = React.useState<AppNotificationCounts>(EMPTY_APP_NOTIFICATION_COUNTS)
  const [isLoading, setIsLoading] = React.useState<boolean>(enabled)

  React.useEffect(() => {
    if (!enabled) {
      setCounts(EMPTY_APP_NOTIFICATION_COUNTS)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const fetchCounts = async () => {
      setIsLoading(true)

      const [headerSummaryResult, maintenanceCountsResult] = await Promise.allSettled([
        callRpc<HeaderNotificationsSummary, { p_don_vi?: number | null }>({
          fn: "header_notifications_summary",
          args: { p_don_vi: null },
        }),
        callRpc<MaintenancePlanStatusCounts | null, Record<string, never>>({
          fn: "maintenance_plan_status_counts",
          args: {},
        }),
      ])

      if (cancelled) {
        return
      }

      if (headerSummaryResult.status === "rejected") {
        console.error("Header notifications error:", headerSummaryResult.reason)
      }

      if (maintenanceCountsResult.status === "rejected") {
        console.error("Maintenance notification counts error:", maintenanceCountsResult.reason)
      }

      const nextCounts: AppNotificationCounts = {
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

      setCounts(nextCounts)
      setIsLoading(false)
    }

    void fetchCounts()

    return () => {
      cancelled = true
    }
  }, [enabled])

  return {
    counts,
    isLoading,
  }
}
