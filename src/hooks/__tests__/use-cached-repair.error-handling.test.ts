import * as React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockToast = vi.fn()
const mockCallRpc = vi.fn()

vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}))

vi.mock('@/lib/rpc-client', () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

import { useCreateRepairRequest } from '../use-cached-repair'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('use-cached-repair error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockReset()
  })

  it('routes create mutation through callRpc and surfaces string errors in the destructive toast', async () => {
    mockCallRpc.mockRejectedValueOnce('Không có quyền tạo yêu cầu sửa chữa')

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useCreateRepairRequest(), {
      wrapper: createWrapper(queryClient),
    })

    act(() => {
      result.current.mutate({
        thiet_bi_id: 42,
        mo_ta_su_co: 'Màn hình tối',
      })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: 'repair_request_create',
      args: {
        p_thiet_bi_id: 42,
        p_mo_ta_su_co: 'Màn hình tối',
        p_hang_muc_sua_chua: null,
        p_ngay_mong_muon_hoan_thanh: null,
        p_nguoi_yeu_cau: null,
        p_don_vi_thuc_hien: null,
        p_ten_don_vi_thue: null,
      },
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Lỗi',
      description: 'Không có quyền tạo yêu cầu sửa chữa',
      variant: 'destructive',
    })
  })
})
