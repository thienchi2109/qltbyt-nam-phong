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
  toast: (args: unknown) => mockToast(args),
}))

import { useStartUsageSession } from '../use-usage-logs'

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

describe('use-usage-logs error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockReset()
  })

  it('surfaces string errors from start-session mutation in the destructive toast', async () => {
    mockCallRpc.mockRejectedValueOnce('Thiết bị đang được sử dụng')

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useStartUsageSession(), {
      wrapper: createWrapper(queryClient),
    })

    act(() => {
      result.current.mutate({
        thiet_bi_id: 1,
        nguoi_su_dung_id: 2,
      })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: 'Lỗi',
      description: 'Thiết bị đang được sử dụng',
    })
  })
})
