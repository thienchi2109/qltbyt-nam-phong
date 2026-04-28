import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCallRpc = vi.fn()

vi.mock('@/lib/rpc-client', () => ({
  callRpc: (...args: unknown[]) => mockCallRpc(...args),
}))

import { repairKeys, useRepairRequestDetail } from '@/hooks/use-cached-repair'
import {
  createReactQueryWrapper,
  createTestQueryClient,
} from '@/test-utils/react-query'

describe('useRepairRequestDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallRpc.mockReset()
  })

  it('does not fetch when id is null', async () => {
    const queryClient = createTestQueryClient()

    renderHook(() => useRepairRequestDetail(null), {
      wrapper: createReactQueryWrapper(queryClient),
    })

    await act(async () => {})
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it('fetches repair_request_get with an integer id', async () => {
    mockCallRpc.mockResolvedValueOnce({ id: 7, mo_ta_su_co: 'Mất nguồn' })
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useRepairRequestDetail('7'), {
      wrapper: createReactQueryWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockCallRpc).toHaveBeenCalledTimes(1)
    expect(mockCallRpc.mock.calls[0]?.[0]).toMatchObject({
      fn: 'repair_request_get',
      args: { p_id: 7 },
    })
    expect(result.current.data).toEqual({ id: 7, mo_ta_su_co: 'Mất nguồn' })
  })

  it('stores the result under the canonical repair detail key', async () => {
    mockCallRpc.mockResolvedValueOnce({ id: 15, mo_ta_su_co: 'Lỗi cảm biến' })
    const queryClient = createTestQueryClient()

    renderHook(() => useRepairRequestDetail('15'), {
      wrapper: createReactQueryWrapper(queryClient),
    })

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledTimes(1)
    })

    expect(queryClient.getQueryData(repairKeys.detail('15'))).toEqual({
      id: 15,
      mo_ta_su_co: 'Lỗi cảm biến',
    })
  })
})
