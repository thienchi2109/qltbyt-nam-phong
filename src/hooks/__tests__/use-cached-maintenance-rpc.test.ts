import { describe, expect, it, vi } from 'vitest'
import type { MaintenanceTask } from '@/lib/data'
import {
  defaultMaintenanceTaskListArgs,
  fetchMaintenanceTaskList,
  filterMaintenanceTasksByEquipmentId,
  findMaintenanceTaskById,
  getMaintenanceErrorMessage,
} from '../use-cached-maintenance.rpc'

function createTask(overrides: Partial<MaintenanceTask> = {}): MaintenanceTask {
  return {
    id: 1,
    ke_hoach_id: 10,
    thiet_bi_id: 101,
    loai_cong_viec: 'Bảo trì',
    diem_hieu_chuan: null,
    don_vi_thuc_hien: null,
    thang_1: false,
    thang_2: false,
    thang_3: false,
    thang_4: false,
    thang_5: false,
    thang_6: false,
    thang_7: false,
    thang_8: false,
    thang_9: false,
    thang_10: false,
    thang_11: false,
    thang_12: false,
    ghi_chu: null,
    thiet_bi: {
      ma_thiet_bi: 'TB-001',
      ten_thiet_bi: 'Máy A',
      khoa_phong_quan_ly: 'Khoa A',
    },
    ...overrides,
  }
}

describe('use-cached-maintenance.rpc', () => {
  it('normalizes null and empty task list payloads to empty arrays', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])

    await expect(fetchMaintenanceTaskList(rpc, defaultMaintenanceTaskListArgs)).resolves.toEqual([])
    await expect(fetchMaintenanceTaskList(rpc, defaultMaintenanceTaskListArgs)).resolves.toEqual([])
  })

  it('filters malformed maintenance task rows instead of blindly casting them', async () => {
    const rpc = vi.fn().mockResolvedValueOnce([
      createTask({ id: 1 }),
      {
        id: '2',
        ke_hoach_id: 11,
        thiet_bi_id: 22,
        loai_cong_viec: 'Bảo trì',
        diem_hieu_chuan: null,
        don_vi_thuc_hien: null,
        thang_1: 'oops',
        thang_2: false,
        thang_3: false,
        thang_4: false,
        thang_5: false,
        thang_6: false,
        thang_7: false,
        thang_8: false,
        thang_9: false,
        thang_10: false,
        thang_11: false,
        thang_12: false,
        ghi_chu: null,
        thiet_bi: {
          ma_thiet_bi: 'TB-002',
          ten_thiet_bi: 'Máy B',
          khoa_phong_quan_ly: null,
        },
      },
      null,
    ])

    await expect(fetchMaintenanceTaskList(rpc, defaultMaintenanceTaskListArgs)).resolves.toEqual([
      createTask({ id: 1 }),
    ])
  })

  it('filters maintenance history rows by equipment id', () => {
    const tasks = [
      createTask({ id: 1, thiet_bi_id: 10 }),
      createTask({ id: 2, thiet_bi_id: 20 }),
      createTask({ id: 3, thiet_bi_id: null }),
    ]

    expect(filterMaintenanceTasksByEquipmentId(tasks, '20')).toEqual([tasks[1]])
  })

  it('finds maintenance detail rows by id', () => {
    const tasks = [
      createTask({ id: 7 }),
      createTask({ id: 9 }),
    ]

    expect(findMaintenanceTaskById(tasks, '9')).toEqual(tasks[1])
    expect(findMaintenanceTaskById(tasks, '999')).toBeNull()
  })

  it('extracts usable messages from unknown errors', () => {
    expect(getMaintenanceErrorMessage(new Error('RPC failed'), 'fallback')).toBe('RPC failed')
    expect(getMaintenanceErrorMessage({ message: 'Permission denied' }, 'fallback')).toBe('Permission denied')
    expect(getMaintenanceErrorMessage({ detail: 'ignored' }, 'fallback')).toBe('fallback')
  })
})
