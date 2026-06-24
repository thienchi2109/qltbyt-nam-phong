import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockInvalidateQueries, mockUseMutation } = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn(),
  mockUseMutation: vi.fn((options: unknown) => options),
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useMutation: (options: unknown) => mockUseMutation(options),
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  }
})

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}))

vi.mock('@/lib/rpc-client', () => ({
  callRpc: vi.fn(),
}))

type MutationWithSuccess = {
  onSuccess: (data?: { deleted_count?: number }, ids?: number[]) => void
}

import {
  useBulkDeleteEquipment,
  useDeleteEquipment,
  useRestoreEquipment,
  useUpdateEquipment,
} from '@/hooks/use-cached-equipment'

describe('use-cached-equipment mutation invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['update', useUpdateEquipment, undefined, { id: '1' }],
    ['delete', useDeleteEquipment, undefined, undefined],
    ['restore', useRestoreEquipment, undefined, undefined],
    ['bulk delete', useBulkDeleteEquipment, { deleted_count: 2 }, [1, 2]],
  ] as const)('invalidates department distribution after %s mutation', (_label, useHook, data, ids) => {
    const { result } = renderHook(() => useHook())

    act(() => {
      ;(result.current as MutationWithSuccess).onSuccess(data, ids)
    })

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['equipment_department_distribution'],
      refetchType: 'active',
    })
  })
})
