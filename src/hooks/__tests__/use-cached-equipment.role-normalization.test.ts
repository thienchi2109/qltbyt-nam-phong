import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetUserCacheScope, mockUseQuery, mockUseSession } = vi.hoisted(() => ({
  mockGetUserCacheScope: vi.fn(() => ({ scope: 'department' as const, department: 'Khoa Noi' })),
  mockUseQuery: vi.fn(() => ({ data: [], isLoading: false })),
  mockUseSession: vi.fn(),
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useQuery: (options: unknown) => mockUseQuery(options),
    useMutation: () => ({ mutate: vi.fn() }),
    useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
  }
})

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

vi.mock('@/lib/advanced-cache-manager', async () => {
  const actual = await vi.importActual<typeof import('@/lib/advanced-cache-manager')>('@/lib/advanced-cache-manager')
  return {
    ...actual,
    DepartmentCacheUtils: {
      ...actual.DepartmentCacheUtils,
      getUserCacheScope: mockGetUserCacheScope,
    },
  }
})

import { useEquipment } from '@/hooks/use-cached-equipment'

describe('use-cached-equipment role normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSession.mockReturnValue({
      data: {
        user: {
          role: '  TO_QLTB  ',
          khoa_phong: 'Khoa Noi',
        },
      },
    })
  })

  it('normalizes session role before passing it to the cache-scope adapter', () => {
    renderHook(() => useEquipment())

    expect(mockGetUserCacheScope).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'to_qltb',
      })
    )
  })

  it('rejects prototype-property role names instead of casting them as valid user roles', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          role: 'constructor',
          khoa_phong: 'Khoa Noi',
        },
      },
    })

    renderHook(() => useEquipment())

    expect(mockGetUserCacheScope).toHaveBeenCalledWith(null)
  })
})
