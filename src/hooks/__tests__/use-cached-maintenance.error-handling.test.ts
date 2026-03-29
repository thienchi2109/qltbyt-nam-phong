import * as React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCallRpc = vi.fn()
const mockToast = vi.fn()

vi.mock('@/lib/rpc-client', () => ({
  callRpc: (args: unknown) => mockCallRpc(args),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: (args: unknown) => mockToast(args),
}))

vi.mock('../use-cached-maintenance.rpc', async () => {
  return vi.importActual<typeof import('../use-cached-maintenance.rpc')>(
    '../use-cached-maintenance.rpc'
  )
})

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

describe('use-cached-maintenance error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockCallRpc.mockReset()
  })

  it('shows a plain-object message for create-plan errors without the rpc wrapper export', async () => {
    mockCallRpc.mockRejectedValueOnce({ message: 'Không có quyền tạo kế hoạch' })

    const { useCreateMaintenancePlan } = await import('../use-cached-maintenance')
    const queryClient = createQueryClient()

    const { result } = renderHook(() => useCreateMaintenancePlan(), {
      wrapper: createWrapper(queryClient),
    })

    act(() => {
      result.current.mutate({
        ten_ke_hoach: 'Kế hoạch bảo trì quý 2',
        nam: 2026,
        loai_cong_viec: 'Bảo trì',
      })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Lỗi',
      description: 'Không có quyền tạo kế hoạch',
      variant: 'destructive',
    })
  })
})
