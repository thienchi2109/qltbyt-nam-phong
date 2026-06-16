/**
 * useAddTasksEquipment.test.ts
 *
 * TDD RED phase: tests for the useAddTasksEquipment hook.
 * Verifies server-side pagination, filter buckets, enabled states, and typed Error handling.
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

const MOCK_FILTER_BUCKETS = {
  department: [{ name: 'ICU', count: 5 }],
  user: [{ name: 'User A', count: 3 }],
  location: [{ name: 'Room 101', count: 2 }],
}

const DEFAULT_PARAMS = {
  open: true,
  planDonVi: 17,
  search: '',
  pagination: { pageIndex: 0, pageSize: 10 },
  sort: 'id.asc',
  filters: {
    departments: [] as string[],
    users: [] as string[],
    locations: [] as string[],
  },
}

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
    mockCallRpc.mockImplementation(({ fn }) => {
      if (fn === 'equipment_filter_buckets') {
        return Promise.resolve(MOCK_FILTER_BUCKETS)
      }
      return Promise.resolve({
        data: MOCK_EQUIPMENT,
        total: 1947,
        page: 1,
        pageSize: 10,
      })
    })
  })

  it('fetches equipment with server-side pagination and plan tenant scope', async () => {
    const { result } = renderHook(() => useAddTasksEquipment({
      ...DEFAULT_PARAMS,
      search: 'monitor',
      pagination: { pageIndex: 2, pageSize: 25 },
      sort: 'ma_thiet_bi.desc',
      filters: {
        departments: ['ICU'],
        users: ['User A'],
        locations: ['Room 101'],
      },
    }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.equipment).toEqual(MOCK_EQUIPMENT)
    })

    expect(result.current.total).toBe(1947)
    expect(mockCallRpc).toHaveBeenCalledWith(expect.objectContaining({
      fn: 'equipment_list_enhanced',
      args: {
        p_q: 'monitor',
        p_sort: 'ma_thiet_bi.desc',
        p_page: 3,
        p_page_size: 25,
        p_don_vi: 17,
        p_khoa_phong_array: ['ICU'],
        p_nguoi_su_dung_array: ['User A'],
        p_vi_tri_lap_dat_array: ['Room 101'],
      },
    }))
  })

  it('does not fetch when dialog is closed', () => {
    const { result } = renderHook(() => useAddTasksEquipment({
      ...DEFAULT_PARAMS,
      open: false,
    }), {
      wrapper: createWrapper(),
    })

    expect(result.current.isFetching).toBe(false)
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it('returns typed Error on RPC failure', async () => {
    mockCallRpc.mockImplementation(({ fn }) => {
      if (fn === 'equipment_filter_buckets') {
        return Promise.resolve(MOCK_FILTER_BUCKETS)
      }
      return Promise.reject(new Error('Network error'))
    })

    const { result } = renderHook(() => useAddTasksEquipment(DEFAULT_PARAMS), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Network error')
  })

  it('fetches filter buckets for the entire plan tenant scope', async () => {
    const { result } = renderHook(() => useAddTasksEquipment(DEFAULT_PARAMS), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.filterOptions.departments).toEqual([{ label: 'ICU', value: 'ICU' }])
    })

    expect(result.current.filterOptions.users).toEqual([{ label: 'User A', value: 'User A' }])
    expect(result.current.filterOptions.locations).toEqual([{ label: 'Room 101', value: 'Room 101' }])
    expect(mockCallRpc).toHaveBeenCalledWith(expect.objectContaining({
      fn: 'equipment_filter_buckets',
      args: { p_don_vi: 17 },
    }))
  })

  it('does not fetch when plan tenant is missing', () => {
    const { result } = renderHook(() => useAddTasksEquipment({
      ...DEFAULT_PARAMS,
      planDonVi: null,
    }), {
      wrapper: createWrapper(),
    })

    expect(result.current.equipment).toEqual([])
    expect(result.current.total).toBe(0)
    expect(mockCallRpc).not.toHaveBeenCalled()
  })
})
