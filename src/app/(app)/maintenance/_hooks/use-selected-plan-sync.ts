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
 * both identity and status. When the plan is edited or approved
 * in-place (same id, different trang_thai), this key changes and
 * triggers a task refetch.
 */
function getPlanSyncKey(plan: MaintenancePlan): string {
  return `${plan.id}|${plan.trang_thai}`
}

/**
 * Syncs side-effects when the selected plan changes.
 *
 * Uses a compound key guard (`id|trang_thai`) to call
 * `fetchPlanDetails` when the plan identity OR approval status
 * changes, while still skipping redundant fetches when only the
 * object reference changes.
 */
export function useSelectedPlanSync({
  selectedPlan,
  fetchPlanDetails,
  clearTaskRowSelection,
}: UseSelectedPlanSyncOptions) {
  const lastFetchedKeyRef = React.useRef<string | null>(null)

  React.useEffect(() => {
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
    void fetchPlanDetails(selectedPlan)
    clearTaskRowSelection()
  }, [selectedPlan, fetchPlanDetails, clearTaskRowSelection])
}
