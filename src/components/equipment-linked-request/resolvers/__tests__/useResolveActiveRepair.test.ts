import * as React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCallRpc = vi.fn()

vi.mock('@/lib/rpc-client', () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

import { useResolveActiveRepair } from '../useResolveActiveRepair'
import { buildActiveRepairRequestQueryKey } from '@/lib/repair-request-deep-link'

function createQueryClient(): QueryClient {
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

describe('useResolveActiveRepair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockReset()
  })

  it('does not fetch when enabled is false', async () => {
    const queryClient = createQueryClient()
    renderHook(
      () => useResolveActiveRepair({ equipmentId: 7, enabled: false }),
      { wrapper: createWrapper(queryClient) },
    )
    // give microtasks a chance to flush
    await act(async () => {})
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it('does not fetch when equipmentId is null even if enabled is true', async () => {
    const queryClient = createQueryClient()
    renderHook(
      () => useResolveActiveRepair({ equipmentId: null, enabled: true }),
      { wrapper: createWrapper(queryClient) },
    )
    await act(async () => {})
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it('fetches via callRpc with the correct fn name and args when enabled', async () => {
    mockCallRpc.mockResolvedValueOnce({ active_count: 0, request: null })
    const queryClient = createQueryClient()
    const { result } = renderHook(
      () => useResolveActiveRepair({ equipmentId: 42, enabled: true }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockCallRpc).toHaveBeenCalledTimes(1)
    const callArg = mockCallRpc.mock.calls[0]![0]
    expect(callArg.fn).toBe('repair_request_active_for_equipment')
    expect(callArg.args).toEqual({ p_thiet_bi_id: 42 })
    expect(callArg.signal).toBeInstanceOf(AbortSignal)
  })

  it('uses the canonical query key from repair-request-deep-link', async () => {
    mockCallRpc.mockResolvedValue({ active_count: 0, request: null })
    const queryClient = createQueryClient()
    renderHook(
      () => useResolveActiveRepair({ equipmentId: 5, enabled: true }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalled()
    })

    const expectedKey = buildActiveRepairRequestQueryKey(5)
    const cached = queryClient.getQueryData(expectedKey)
    expect(cached).toEqual({ active_count: 0, request: null })
  })

  it('isolates caches between two equipmentIds', async () => {
    mockCallRpc
      .mockResolvedValueOnce({ active_count: 1, request: { id: 100 } })
      .mockResolvedValueOnce({ active_count: 2, request: { id: 200 } })

    const queryClient = createQueryClient()
    const { result: r1 } = renderHook(
      () => useResolveActiveRepair({ equipmentId: 1, enabled: true }),
      { wrapper: createWrapper(queryClient) },
    )
    const { result: r2 } = renderHook(
      () => useResolveActiveRepair({ equipmentId: 2, enabled: true }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => {
      expect(r1.current.isSuccess).toBe(true)
      expect(r2.current.isSuccess).toBe(true)
    })

    expect(r1.current.data).toEqual({ active_count: 1, request: { id: 100 } })
    expect(r2.current.data).toEqual({ active_count: 2, request: { id: 200 } })
  })
})
