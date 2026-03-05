/**
 * useAddTasksEquipment.test.ts
 *
 * TDD RED phase: tests for the useAddTasksEquipment hook.
 * Verifies Equipment[] typing, enabled/disabled states, and typed Error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/rpc-client', () => ({
  callRpc: vi.fn(),
}))

import { callRpc } from '@/lib/rpc-client'
import { useAddTasksEquipment } from '../useAddTasksEquipment'
import type { Equipment } from '@/lib/data'

const mockCallRpc = vi.mocked(callRpc)

const MOCK_EQUIPMENT: Equipment[] = [
  {
    id: 1,
    ma_thiet_bi: 'TB-001',
    ten_thiet_bi: 'Máy đo huyết áp',
    model: 'Model-1',
    serial: 'SN-001',
    cau_hinh_thiet_bi: '',
    phu_kien_kem_theo: '',
    hang_san_xuat: 'Omron',
    noi_san_xuat: 'Japan',
    nam_san_xuat: 2020,
    ngay_nhap: '2020-01-01',
    ngay_dua_vao_su_dung: '2020-02-01',
    nguon_kinh_phi: 'NSNN',
    gia_goc: 5000000,
    nam_tinh_hao_mon: 5,
    ty_le_hao_mon: '20%',
    han_bao_hanh: '2022-01-01',
    vi_tri_lap_dat: 'Room 101',
    nguoi_dang_truc_tiep_quan_ly: 'User A',
    khoa_phong_quan_ly: 'ICU',
    tinh_trang_hien_tai: 'Hoạt động',
    ghi_chu: '',
    chu_ky_bt_dinh_ky: 6,
    ngay_bt_tiep_theo: '2026-06-01',
    chu_ky_hc_dinh_ky: 12,
    ngay_hc_tiep_theo: '2026-12-01',
    chu_ky_kd_dinh_ky: 12,
    ngay_kd_tiep_theo: '2026-12-01',
    phan_loai_theo_nd98: 'A',
  },
]

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

function createWrapper() {
  const queryClient = createTestQueryClient()
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useAddTasksEquipment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns Equipment[] data when dialog is open', async () => {
    mockCallRpc.mockResolvedValue(MOCK_EQUIPMENT)

    const { result } = renderHook(() => useAddTasksEquipment(true), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(MOCK_EQUIPMENT)
    expect(result.current.data?.[0].ma_thiet_bi).toBe('TB-001')
  })

  it('does not fetch when dialog is closed', () => {
    const { result } = renderHook(() => useAddTasksEquipment(false), {
      wrapper: createWrapper(),
    })

    expect(result.current.isFetching).toBe(false)
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it('returns typed Error on RPC failure', async () => {
    mockCallRpc.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useAddTasksEquipment(true), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Network error')
  })

  it('warns when returned data count hits the fetch limit', async () => {
    const { EQUIPMENT_FETCH_LIMIT } = await import('../useAddTasksEquipment')
    const atLimitData = Array.from({ length: EQUIPMENT_FETCH_LIMIT }, (_, i) => ({
      ...MOCK_EQUIPMENT[0],
      id: i + 1,
      ma_thiet_bi: `TB-${String(i + 1).padStart(3, '0')}`,
    }))
    mockCallRpc.mockResolvedValue(atLimitData)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() => useAddTasksEquipment(true), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('equipment_list returned'),
    )
    warnSpy.mockRestore()
  })
})
