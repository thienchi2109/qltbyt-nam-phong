import * as React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockToast = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => mockSingle(),
        }),
      }),
    }),
  },
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
    mockSingle.mockReset()
  })

  it('surfaces string errors from create mutation in the destructive toast', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: 'Không có quyền tạo yêu cầu sửa chữa',
    })

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useCreateRepairRequest(), {
      wrapper: createWrapper(queryClient),
    })

    act(() => {
      result.current.mutate({
        mo_ta_su_co: 'Màn hình tối',
      })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Lỗi',
      description: 'Không có quyền tạo yêu cầu sửa chữa',
      variant: 'destructive',
    })
  })
})
