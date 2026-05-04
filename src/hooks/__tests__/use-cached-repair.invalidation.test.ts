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

import {
  repairKeys,
  useAssignRepairRequest,
  useCompleteRepairRequest,
  useCreateRepairRequest,
  useDeleteRepairRequest,
  useUpdateRepairRequest,
} from '../use-cached-repair'

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

/**
 * Phase 1 of #207 introduces `repairKeys.active(equipmentId)` as a new sub-key
 * under `repairKeys.all`. All repair-request mutations must invalidate the
 * `repairKeys.all` prefix on success so that a side-sheet open elsewhere
 * picks up fresh data without manual refetch wiring.
 *
 * `useCreateRepairRequest`, `useAssignRepairRequest`, `useCompleteRepairRequest`,
 * and `useDeleteRepairRequest` already do this. This test pins the contract for
 * all of them and confirms the alignment of `useUpdateRepairRequest`, which
 * historically only invalidated `repairKeys.lists()` + `repairKeys.detail(id)`.
 */
describe('use-cached-repair :: cache-invalidation contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockReset()
  })

  it('useUpdateRepairRequest invalidates the full repairKeys.all family on success', async () => {
    mockCallRpc.mockResolvedValueOnce(undefined)

    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateRepairRequest(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({
        id: '7',
        data: {
          mo_ta_su_co: 'Cập nhật mô tả sự cố',
        },
      })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const allInvalidations = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)

    // The fix: useUpdateRepairRequest must invalidate the family prefix so any
    // sub-key (e.g. repairKeys.active(equipmentId)) is refetched.
    expect(allInvalidations).toContainEqual(repairKeys.all)
    // Dashboard KPI invalidation is also part of the contract.
    expect(allInvalidations).toContainEqual(['dashboard-stats'])
  })

  it('useCreateRepairRequest invalidates the repairKeys.all family on success', async () => {
    mockCallRpc.mockResolvedValueOnce(123)

    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateRepairRequest(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({
        thiet_bi_id: 5,
        mo_ta_su_co: 'Lỗi nguồn',
      })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const allInvalidations = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)
    expect(allInvalidations).toContainEqual(repairKeys.all)
  })

  it('useAssignRepairRequest invalidates the repairKeys.all family on success', async () => {
    mockCallRpc.mockResolvedValueOnce(undefined)

    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAssignRepairRequest(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({ id: '4', nguoi_xu_ly: 'Nhân viên A' })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const allInvalidations = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)
    expect(allInvalidations).toContainEqual(repairKeys.all)
  })

  it('useCompleteRepairRequest invalidates the repairKeys.all family on success', async () => {
    mockCallRpc.mockResolvedValueOnce(undefined)

    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCompleteRepairRequest(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({ id: '9', ket_qua: 'Đã sửa xong' })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const allInvalidations = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)
    expect(allInvalidations).toContainEqual(repairKeys.all)
  })

  it('useDeleteRepairRequest invalidates the repairKeys.all family on success', async () => {
    mockCallRpc.mockResolvedValueOnce(undefined)

    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteRepairRequest(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync('11')
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const allInvalidations = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)
    expect(allInvalidations).toContainEqual(repairKeys.all)
  })
})
