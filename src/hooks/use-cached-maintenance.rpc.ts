import type { MaintenanceTask } from '@/lib/data'

type RpcCaller = <TResponse>(options: {
  fn: string
  args: Record<string, unknown>
}) => Promise<TResponse>

export type MaintenanceTaskListArgs = {
  p_ke_hoach_id: number | null
  p_thiet_bi_id: number | null
  p_loai_cong_viec: string | null
  p_don_vi_thuc_hien: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeMaintenanceTaskList(value: unknown): MaintenanceTask[] {
  return Array.isArray(value) ? (value as MaintenanceTask[]) : []
}

export async function fetchMaintenanceTaskList(
  rpc: RpcCaller,
  args: MaintenanceTaskListArgs
): Promise<MaintenanceTask[]> {
  const data = await rpc<unknown>({
    fn: 'maintenance_tasks_list_with_equipment',
    args,
  })

  return normalizeMaintenanceTaskList(data)
}

export function filterMaintenanceTasksByEquipmentId(
  tasks: readonly MaintenanceTask[] | null | undefined,
  equipmentId?: string | null
): MaintenanceTask[] {
  const list = tasks ?? []
  if (!equipmentId) {
    return [...list]
  }

  return list.filter((task) => String(task.thiet_bi_id) === String(equipmentId))
}

export function findMaintenanceTaskById(
  tasks: readonly MaintenanceTask[] | null | undefined,
  id?: string | null
): MaintenanceTask | null {
  if (!id) {
    return null
  }

  return (tasks ?? []).find((task) => String(task.id) === String(id)) ?? null
}

export function getMaintenanceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (isRecord(error)) {
    const message = error.message
    if (typeof message === 'string' && message) {
      return message
    }
  }

  return fallback
}
