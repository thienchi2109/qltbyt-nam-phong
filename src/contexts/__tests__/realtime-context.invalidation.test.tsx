import * as React from 'react'
import { act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { repairKeys } from '@/hooks/use-cached-repair'

type RealtimeCallback = (payload: {
  table: string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
}) => void

const mockRealtime = vi.hoisted(() => {
  const postgresCallbacks = new Map<string, RealtimeCallback>()
  const channel = {
    on: vi.fn((event: string, filter: { table?: string }, callback: RealtimeCallback) => {
      if (event === 'postgres_changes' && filter.table) {
        postgresCallbacks.set(filter.table, callback)
      }
      return channel
    }),
    subscribe: vi.fn((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return channel
    }),
  }
  const removeChannel = vi.fn()

  return {
    postgresCallbacks,
    channel,
    removeChannel,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => mockRealtime.channel),
    removeChannel: mockRealtime.removeChannel,
  },
}))

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}))

import { RealtimeProvider } from '../realtime-context'

function renderWithQueryClient(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <div />
      </RealtimeProvider>
    </QueryClientProvider>
  )
}

describe('RealtimeProvider invalidation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockRealtime.postgresCallbacks.clear()
    mockRealtime.channel.on.mockClear()
    mockRealtime.channel.subscribe.mockClear()
    mockRealtime.removeChannel.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('invalidates repair and equipment-list queries when repair requests change', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries')

    const view = renderWithQueryClient(queryClient)

    const callback = mockRealtime.postgresCallbacks.get('yeu_cau_sua_chua')
    expect(callback).toBeDefined()

    act(() => {
      callback?.({
        table: 'yeu_cau_sua_chua',
        eventType: 'UPDATE',
        new: { id: 1 },
        old: { id: 1 },
      })
    })

    await act(async () => {
      vi.advanceTimersByTime(150)
      await Promise.resolve()
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: repairKeys.all,
      refetchType: 'active',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['equipment_list_enhanced'],
      refetchType: 'active',
    })

    expect(refetchSpy).toHaveBeenCalledWith({
      queryKey: ['equipment_list_enhanced'],
      type: 'active',
    })

    view.unmount()
  })
})
