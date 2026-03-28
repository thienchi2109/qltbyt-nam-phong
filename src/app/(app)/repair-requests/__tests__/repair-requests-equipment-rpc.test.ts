import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

vi.mock('@/lib/rpc-client', () => ({
  callRpc: mocks.callRpc,
}))

import {
  fetchRepairRequestEquipmentById,
  fetchRepairRequestEquipmentList,
} from '../repair-requests-equipment-rpc'

describe('repair requests equipment rpc helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches a typed equipment list for suggestions and deep-link prefill', async () => {
    mocks.callRpc.mockResolvedValueOnce([
      {
        id: 101,
        ma_thiet_bi: 'TB-101',
        ten_thiet_bi: 'Máy siêu âm A',
        khoa_phong_quan_ly: 'CDHA',
      },
    ])

    await expect(
      fetchRepairRequestEquipmentList('Máy siêu âm')
    ).resolves.toEqual([
      {
        id: 101,
        ma_thiet_bi: 'TB-101',
        ten_thiet_bi: 'Máy siêu âm A',
        khoa_phong_quan_ly: 'CDHA',
      },
    ])

    expect(mocks.callRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: 'equipment_list',
        args: expect.objectContaining({
          p_q: 'Máy siêu âm',
          p_sort: 'ten_thiet_bi.asc',
          p_page: 1,
          p_page_size: 20,
        }),
      }),
    )
  })

  it('fetches a typed equipment detail for deep-link preselect', async () => {
    mocks.callRpc.mockResolvedValueOnce({
      id: 42,
      ma_thiet_bi: 'TB-042',
      ten_thiet_bi: 'Máy X quang',
      khoa_phong_quan_ly: 'CĐHA',
    })

    await expect(fetchRepairRequestEquipmentById(42)).resolves.toEqual({
      id: 42,
      ma_thiet_bi: 'TB-042',
      ten_thiet_bi: 'Máy X quang',
      khoa_phong_quan_ly: 'CĐHA',
    })

    expect(mocks.callRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: 'equipment_get',
        args: { p_id: 42 },
      }),
    )
  })
})
