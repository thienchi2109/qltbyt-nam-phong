import * as React from "react"
import type { RowSelectionState } from "@tanstack/react-table"
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
 * Syncs side-effects when the selected plan changes.
 *
 * Uses a ref guard (`lastFetchedPlanIdRef`) to only call
 * `fetchPlanDetails` when `selectedPlan.id` actually changes,
 * preventing redundant fetches when the plan object reference
 * changes but the ID is the same.
 */
export function useSelectedPlanSync({
  selectedPlan,
  fetchPlanDetails,
  clearTaskRowSelection,
}: UseSelectedPlanSyncOptions) {
  const lastFetchedPlanIdRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!selectedPlan) {
      lastFetchedPlanIdRef.current = null
      clearTaskRowSelection()
      return
    }

    if (lastFetchedPlanIdRef.current === selectedPlan.id) {
      return
    }

    lastFetchedPlanIdRef.current = selectedPlan.id
    void fetchPlanDetails(selectedPlan)
    clearTaskRowSelection()
  }, [selectedPlan, fetchPlanDetails, clearTaskRowSelection])
}
