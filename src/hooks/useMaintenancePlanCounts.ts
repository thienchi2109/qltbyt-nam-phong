import { useQuery } from "@tanstack/react-query"
import type { MaintenanceStatus } from "@/components/kpi/configs/maintenance"
import { callRpc } from "@/lib/rpc-client"
import { maintenanceKeys } from "@/hooks/use-cached-maintenance"

export type MaintenancePlanStatusCounts = Record<MaintenanceStatus, number>

export interface UseMaintenancePlanCountsOptions {
  facilityId?: number | null
  search?: string
  enabled?: boolean
}

export interface UseMaintenancePlanCountsResult {
  counts?: MaintenancePlanStatusCounts
  isLoading: boolean
  isError: boolean
}

export function useMaintenancePlanCounts(
  options: UseMaintenancePlanCountsOptions = {},
): UseMaintenancePlanCountsResult {
  const { facilityId, search, enabled = true } = options

  const { data, isLoading, isError } = useQuery<MaintenancePlanStatusCounts | null>({
    queryKey: maintenanceKeys.planStatusCounts({
      facilityId: facilityId ?? null,
      search: search ?? undefined,
    }),
    queryFn: async () => {
      const args: Record<string, number | string> = {}

      if (facilityId != null) {
        args.p_don_vi = facilityId
      }

      if (search) {
        args.p_q = search
      }

      const result = await callRpc<Record<string, number> | null>({
        fn: "maintenance_plan_status_counts",
        args,
      })

      if (!result) {
        return null
      }

      return result as MaintenancePlanStatusCounts
    },
    enabled,
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    counts: data ?? undefined,
    isLoading,
    isError,
  }
}
