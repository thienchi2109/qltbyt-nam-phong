"use client"

export const MAINTENANCE_TASK_ROW_ID_PREFIX = "task:"

export function toMaintenanceTaskRowId(taskId: number) {
  return `${MAINTENANCE_TASK_ROW_ID_PREFIX}${taskId}`
}

export function parseMaintenanceTaskRowId(rowId: string): number | null {
  if (!rowId.startsWith(MAINTENANCE_TASK_ROW_ID_PREFIX)) {
    return null
  }

  const rawTaskId = rowId.slice(MAINTENANCE_TASK_ROW_ID_PREFIX.length)
  const taskId = Number(rawTaskId)

  if (!Number.isFinite(taskId)) {
    return null
  }

  return taskId
}
