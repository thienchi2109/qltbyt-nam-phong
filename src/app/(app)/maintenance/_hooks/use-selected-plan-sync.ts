import * as React from "react"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"

interface UseSelectedPlanSyncOptions {
  /** Currently selected plan from context */
  selectedPlan: MaintenancePlan | null
  /** Fetch tasks + reset completion status for a plan */
  fetchPlanDetails: (plan: MaintenancePlan) => Promise<void>
  /** Clear task row selection (no-op safe) */
  clearTaskRowSelection: () => void
}

/**
 * Derives a compound key from the selected plan that captures
 * identity and every field whose change should trigger a task
 * refetch: status (trang_thai) and work type (loai_cong_viec).
 */
function getPlanSyncKey(plan: MaintenancePlan): string {
  return `${plan.id}|${plan.trang_thai}|${plan.loai_cong_viec}`
}

/**
 * Syncs side-effects when the selected plan changes.
 *
 * Uses a compound key guard (`id|trang_thai|loai_cong_viec`) to call
 * `fetchPlanDetails` when the plan identity, approval status, or
 * work type changes, while still skipping redundant fetches when
 * only the object reference changes.
 *
 * Includes a stale-response guard: if the user rapidly switches
 * plans, only the latest fetch's result is applied.
 */
export function useSelectedPlanSync({
  selectedPlan,
  fetchPlanDetails,
  clearTaskRowSelection,
}: UseSelectedPlanSyncOptions) {
  const lastFetchedKeyRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    let isCancelled = false

    if (!selectedPlan) {
      lastFetchedKeyRef.current = null
      clearTaskRowSelection()
      return
    }

    const syncKey = getPlanSyncKey(selectedPlan)
    if (lastFetchedKeyRef.current === syncKey) {
      return
    }

    lastFetchedKeyRef.current = syncKey
    const planToFetch = selectedPlan

    void fetchPlanDetails(planToFetch).then(() => {
      if (isCancelled) return
      clearTaskRowSelection()
    })

    return () => {
      isCancelled = true
    }
  }, [selectedPlan, fetchPlanDetails, clearTaskRowSelection])
}
