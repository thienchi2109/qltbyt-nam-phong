"use client"

import { useQuery } from "@tanstack/react-query"

import type { TemperatureNotifications } from "@/types/temperature-monitoring"
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
  facilityId?: number | null | undefined
  identityScope?: string
}

interface UseAppNotificationCountsResult {
  counts: AppNotificationCounts
  temperature: TemperatureNotifications | null
  isLoading: boolean
}

const APP_NOTIFICATION_COUNTS_QUERY_KEY = ["app-notification-counts"] as const

/** Share identity-scoped notification counts across layout consumers. */
export function useAppNotificationCounts(
  options: UseAppNotificationCountsOptions = {}
): UseAppNotificationCountsResult {
  const { enabled = true, facilityId, identityScope } = options
  const facilityScopeKey = typeof facilityId === "number" ? facilityId : null
  const { data, isLoading } = useQuery<
    AppNotificationCounts & { temperatureSummary: TemperatureNotifications | null }
  >({
    queryKey: [
      ...APP_NOTIFICATION_COUNTS_QUERY_KEY,
      { facilityScope: facilityScopeKey, identityScope },
    ],
    queryFn: async ({ signal }) => {
      const scopedArgs = typeof facilityId === "number" ? { p_don_vi: facilityId } : undefined
      const maintenanceArgs = scopedArgs ?? {}
      const [headerSummaryResult, maintenanceCountsResult, temperatureResult] =
        await Promise.allSettled([
          callRpc<HeaderNotificationsSummary>({
            fn: "header_notifications_summary",
            ...(scopedArgs ? { args: scopedArgs } : {}),
            signal,
          }),
          callRpc<MaintenancePlanStatusCounts | null, Record<string, number>>({
            fn: "maintenance_plan_status_counts",
            args: maintenanceArgs,
            signal,
          }),
          callRpc<TemperatureNotifications>({
            fn: "temperature_monitoring_notification_summary",
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
        temperatureSummary:
          temperatureResult.status === "fulfilled" ? temperatureResult.value : null,
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
    counts:
      enabled && data
        ? { repair: data.repair, transfer: data.transfer, maintenance: data.maintenance }
        : EMPTY_APP_NOTIFICATION_COUNTS,
    temperature: enabled ? (data?.temperatureSummary ?? null) : null,
    isLoading: enabled ? isLoading : false,
  }
}
