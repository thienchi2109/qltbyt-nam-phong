import type { RowSelectionState } from "@tanstack/react-table"
import type { MaintenancePlan, MaintenancePlanListResponse } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
import type { CompletionStatusEntry } from "./maintenance-context.types"
import { parseMaintenanceTaskRowId } from "./maintenance-task-row-id"

/**
 * Builds a map of completed task-month entries from a list of MaintenanceTasks.
 * An entry is recorded when both the completion flag and date are present.
 * Key format: `${taskId}-${month}`.
 */
export function buildCompletionStatus(
  tasks: MaintenanceTask[]
): Record<string, CompletionStatusEntry> {
  const statusMap: Record<string, CompletionStatusEntry> = {}

  tasks.forEach((task) => {
    for (let month = 1; month <= 12; month += 1) {
      const completed = Boolean((task as Record<string, unknown>)[`thang_${month}_hoan_thanh`])
      const completionDate = (task as Record<string, unknown>)[`ngay_hoan_thanh_${month}`]

      if (completed && completionDate) {
        statusMap[`${task.id}-${month}`] = { historyId: 0 }
      }
    }
  })

  return statusMap
}

/**
 * Extracts numeric task IDs from a TanStack Table RowSelectionState.
 * Only rows with a valid maintenance task row ID prefix are included.
 */
export function getSelectedTaskIds(taskRowSelection: RowSelectionState): number[] {
  return Object.entries(taskRowSelection)
    .filter(([, selected]) => Boolean(selected))
    .map(([rowId]) => parseMaintenanceTaskRowId(rowId))
    .filter((taskId): taskId is number => taskId !== null)
}

/**
 * Searches through paginated plan cache responses to find a plan by ID.
 * Returns null if the plan is not found in any cached page.
 */
export function findPlanInCachedResponses(
  cachedResponses: Array<[readonly unknown[], MaintenancePlanListResponse | undefined]>,
  planId: number
): MaintenancePlan | null {
  for (const [, response] of cachedResponses) {
    const matchedPlan = response?.data.find((plan) => plan.id === planId)
    if (matchedPlan) {
      return matchedPlan
    }
  }

  return null
}

/**
 * Generates the next temporary task ID (always negative) for draft tasks.
 * Uses reduce to avoid stack overflow with large arrays (no spread into Math.min).
 */
export function getNextMaintenanceTempTaskId(
  tasks: Array<Pick<MaintenanceTask, "id">>
): number {
  const smallestExistingTempId = tasks.reduce(
    (minId, task) => (task.id < minId ? task.id : minId),
    -1
  )

  return smallestExistingTempId - 1
}
