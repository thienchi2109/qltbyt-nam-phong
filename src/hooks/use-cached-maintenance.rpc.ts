import { taskTypes, type MaintenanceTask, type TaskType } from '@/lib/data'
import { getUnknownErrorMessage } from '@/lib/error-utils'

type RpcCaller = <TResponse>(options: {
  fn: string
  args?: Record<string, unknown>
}) => Promise<TResponse>

export type MaintenanceTaskListArgs = {
  p_ke_hoach_id: number | null
  p_thiet_bi_id: number | null
  p_loai_cong_viec: string | null
  p_don_vi_thuc_hien: string | null
}

export const defaultMaintenanceTaskListArgs: MaintenanceTaskListArgs = {
  p_ke_hoach_id: null,
  p_thiet_bi_id: null,
  p_loai_cong_viec: null,
  p_don_vi_thuc_hien: null,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toNullableNumber(value: unknown): number | null {
  return value == null ? null : toNumber(value)
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function isTaskType(value: unknown): value is TaskType {
  return typeof value === 'string' && taskTypes.includes(value as TaskType)
}

function normalizeMaintenanceTaskEquipment(
  value: unknown
): MaintenanceTask['thiet_bi'] {
  if (value == null) {
    return null
  }

  if (!isRecord(value)) {
    return null
  }

  const maThietBi = toNullableString(value.ma_thiet_bi)
  const tenThietBi = toNullableString(value.ten_thiet_bi)

  if (!maThietBi || !tenThietBi) {
    return null
  }

  return {
    ma_thiet_bi: maThietBi,
    ten_thiet_bi: tenThietBi,
    khoa_phong_quan_ly: toNullableString(value.khoa_phong_quan_ly),
  }
}

function normalizeMaintenanceTask(value: unknown): MaintenanceTask | null {
  if (!isRecord(value)) {
    return null
  }

  const id = toNumber(value.id)
  const keHoachId = toNumber(value.ke_hoach_id)
  const thang_1 = value.thang_1
  const thang_2 = value.thang_2
  const thang_3 = value.thang_3
  const thang_4 = value.thang_4
  const thang_5 = value.thang_5
  const thang_6 = value.thang_6
  const thang_7 = value.thang_7
  const thang_8 = value.thang_8
  const thang_9 = value.thang_9
  const thang_10 = value.thang_10
  const thang_11 = value.thang_11
  const thang_12 = value.thang_12

  if (id === null || keHoachId === null) {
    return null
  }

  if (
    typeof thang_1 !== 'boolean' ||
    typeof thang_2 !== 'boolean' ||
    typeof thang_3 !== 'boolean' ||
    typeof thang_4 !== 'boolean' ||
    typeof thang_5 !== 'boolean' ||
    typeof thang_6 !== 'boolean' ||
    typeof thang_7 !== 'boolean' ||
    typeof thang_8 !== 'boolean' ||
    typeof thang_9 !== 'boolean' ||
    typeof thang_10 !== 'boolean' ||
    typeof thang_11 !== 'boolean' ||
    typeof thang_12 !== 'boolean'
  ) {
    return null
  }

  const rawLoaiCongViec = value.loai_cong_viec
  const loaiCongViec = rawLoaiCongViec == null ? null : isTaskType(rawLoaiCongViec) ? rawLoaiCongViec : null
  const thietBi = normalizeMaintenanceTaskEquipment(value.thiet_bi)

  if (value.thiet_bi != null && thietBi === null) {
    return null
  }

  return {
    id,
    ke_hoach_id: keHoachId,
    thiet_bi_id: toNullableNumber(value.thiet_bi_id),
    loai_cong_viec: loaiCongViec,
    diem_hieu_chuan: toNullableString(value.diem_hieu_chuan),
    don_vi_thuc_hien: toNullableString(value.don_vi_thuc_hien),
    thang_1,
    thang_2,
    thang_3,
    thang_4,
    thang_5,
    thang_6,
    thang_7,
    thang_8,
    thang_9,
    thang_10,
    thang_11,
    thang_12,
    ghi_chu: toNullableString(value.ghi_chu),
    thiet_bi: thietBi,
  }
}

function normalizeMaintenanceTaskList(value: unknown): MaintenanceTask[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.reduce<MaintenanceTask[]>((tasks, row) => {
    const task = normalizeMaintenanceTask(row)
    if (task) {
      tasks.push(task)
    }
    return tasks
  }, [])
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
  return getUnknownErrorMessage(error, fallback)
}
