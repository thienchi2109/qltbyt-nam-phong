/**
 * Integration tests for the Unified Tenant Selection System.
 *
 * Tests cover:
 * 1. Selection persists across page navigation (sessionStorage)
 * 2. Data fetches only after facility selection for privileged users
 * 3. regional_leader sees only their region's facilities
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'

// =============================================================================
// Mocks
// =============================================================================

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    _store: store,
    _reset: () => { store = {} },
  }
})()

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
})

// Mock next-auth/react
const mockUseSession = vi.fn()
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

// Mock callRpc
const mockCallRpc = vi.fn()
vi.mock('@/lib/rpc-client', () => ({
  callRpc: (params: unknown) => mockCallRpc(params),
}))

// Mock TanStack Query
const mockUseQuery = vi.fn()
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: unknown[]; queryFn: () => Promise<unknown>; enabled?: boolean }) => mockUseQuery(options),
  QueryClient: vi.fn().mockImplementation(() => ({
    invalidateQueries: vi.fn(),
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Import after mocking
import { TenantSelectionProvider, useTenantSelection } from '@/contexts/TenantSelectionContext'
import { isPrivilegedRole, type FacilityOption } from '@/types/tenant'

// =============================================================================
// Test Data
// =============================================================================

const MOCK_FACILITIES_ALL: FacilityOption[] = [
  { id: 1, name: 'Bệnh viện Đa khoa An Giang' },
  { id: 2, name: 'Bệnh viện Đa khoa Cần Thơ' },
  { id: 3, name: 'Trung tâm Y tế Châu Đốc' },
  { id: 4, name: 'Bệnh viện Sản Nhi An Giang' },
]

const MOCK_FACILITIES_REGION_1: FacilityOption[] = [
  { id: 1, name: 'Bệnh viện Đa khoa An Giang' },
  { id: 4, name: 'Bệnh viện Sản Nhi An Giang' },
]

// =============================================================================
// Helpers
// =============================================================================

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <TenantSelectionProvider>{children}</TenantSelectionProvider>
  }
}

function createSessionMock(role: string, diaBanId?: number) {
  return {
    data: {
      user: {
        id: 1,
        name: 'Test User',
        role,
        dia_ban_id: diaBanId,
        don_vi: 1,
      },
    },
    status: 'authenticated' as const,
  }
}

// =============================================================================
// Tests: isPrivilegedRole utility
// =============================================================================

describe('isPrivilegedRole', () => {
  it('should return true for global role', () => {
    expect(isPrivilegedRole('global')).toBe(true)
    expect(isPrivilegedRole('GLOBAL')).toBe(true)
  })

  it('should return true for admin role', () => {
    expect(isPrivilegedRole('admin')).toBe(true)
    expect(isPrivilegedRole('Admin')).toBe(true)
  })

  it('should return true for regional_leader role', () => {
    expect(isPrivilegedRole('regional_leader')).toBe(true)
    expect(isPrivilegedRole('REGIONAL_LEADER')).toBe(true)
  })

  it('should return false for regular roles', () => {
    expect(isPrivilegedRole('user')).toBe(false)
    expect(isPrivilegedRole('to_qltb')).toBe(false)
    expect(isPrivilegedRole('technician')).toBe(false)
  })

  it('should return false for null/undefined', () => {
    expect(isPrivilegedRole(null)).toBe(false)
    expect(isPrivilegedRole(undefined)).toBe(false)
    expect(isPrivilegedRole('')).toBe(false)
  })
})

// =============================================================================
// Tests: Selection persists across page navigation
// =============================================================================

describe('Selection persists across page navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
  })

  afterEach(() => {
    mockSessionStorage.clear()
  })

  it('should persist selected facility ID to sessionStorage', () => {
    mockUseSession.mockReturnValue(createSessionMock('global'))
    mockUseQuery.mockReturnValue({ data: MOCK_FACILITIES_ALL, isLoading: false })

    const { result } = renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    // Initially undefined (not selected)
    expect(result.current.selectedFacilityId).toBe(undefined)

    // Select facility 2
    act(() => {
      result.current.setSelectedFacilityId(2)
    })

    expect(result.current.selectedFacilityId).toBe(2)
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('selectedFacilityId', '2')
  })

  it('should persist "all facilities" selection (null) to sessionStorage', () => {
    mockUseSession.mockReturnValue(createSessionMock('global'))
    mockUseQuery.mockReturnValue({ data: MOCK_FACILITIES_ALL, isLoading: false })

    const { result } = renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    // Select "all facilities" (null)
    act(() => {
      result.current.setSelectedFacilityId(null)
    })

    expect(result.current.selectedFacilityId).toBe(null)
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('selectedFacilityId', 'null')
  })

  it('should restore selection from sessionStorage on mount', () => {
    // Pre-populate sessionStorage
    mockSessionStorage.getItem.mockReturnValue('3')

    mockUseSession.mockReturnValue(createSessionMock('global'))
    mockUseQuery.mockReturnValue({ data: MOCK_FACILITIES_ALL, isLoading: false })

    const { result } = renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    // Should restore facility ID 3 from sessionStorage
    expect(result.current.selectedFacilityId).toBe(3)
  })

  it('should restore "all facilities" selection from sessionStorage', () => {
    // Pre-populate sessionStorage with "null" string
    mockSessionStorage.getItem.mockReturnValue('null')

    mockUseSession.mockReturnValue(createSessionMock('global'))
    mockUseQuery.mockReturnValue({ data: MOCK_FACILITIES_ALL, isLoading: false })

    const { result } = renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    // Should restore null (all facilities) from sessionStorage
    expect(result.current.selectedFacilityId).toBe(null)
  })

  it('should handle invalid sessionStorage value gracefully', () => {
    // Pre-populate sessionStorage with invalid value
    mockSessionStorage.getItem.mockReturnValue('invalid_not_a_number')

    mockUseSession.mockReturnValue(createSessionMock('global'))
    mockUseQuery.mockReturnValue({ data: MOCK_FACILITIES_ALL, isLoading: false })

    const { result } = renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    // Should fall back to undefined
    expect(result.current.selectedFacilityId).toBe(undefined)
  })
})

// =============================================================================
// Tests: Data fetches only after facility selection
// =============================================================================

describe('Data fetches only after facility selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
    mockSessionStorage.getItem.mockReturnValue(null)
  })

  describe('Global user', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue(createSessionMock('global'))
      mockUseQuery.mockReturnValue({ data: MOCK_FACILITIES_ALL, isLoading: false })
    })

    it('should NOT allow data fetch when no facility selected (undefined)', () => {
      const { result } = renderHook(() => useTenantSelection(), {
        wrapper: createWrapper(),
      })

      expect(result.current.selectedFacilityId).toBe(undefined)
      expect(result.current.shouldFetchData).toBe(false)
      expect(result.current.showSelector).toBe(true)
    })

    it('should allow data fetch after selecting specific facility', () => {
      const { result } = renderHook(() => useTenantSelection(), {
        wrapper: createWrapper(),
      })

      // Select facility
      act(() => {
        result.current.setSelectedFacilityId(1)
      })

      expect(result.current.selectedFacilityId).toBe(1)
      expect(result.current.shouldFetchData).toBe(true)
    })

    it('should allow data fetch after selecting "all facilities" (null)', () => {
      const { result } = renderHook(() => useTenantSelection(), {
        wrapper: createWrapper(),
      })

      // Select "all facilities"
      act(() => {
        result.current.setSelectedFacilityId(null)
      })

      expect(result.current.selectedFacilityId).toBe(null)
      expect(result.current.shouldFetchData).toBe(true)
    })
  })

  describe('Regional leader', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue(createSessionMock('regional_leader', 1))
      mockUseQuery.mockReturnValue({ data: MOCK_FACILITIES_REGION_1, isLoading: false })
    })

    it('should NOT allow data fetch when no facility selected (undefined)', () => {
      const { result } = renderHook(() => useTenantSelection(), {
        wrapper: createWrapper(),
      })

      expect(result.current.selectedFacilityId).toBe(undefined)
      expect(result.current.shouldFetchData).toBe(false)
      expect(result.current.showSelector).toBe(true)
    })

    it('should allow data fetch after selecting facility in their region', () => {
      const { result } = renderHook(() => useTenantSelection(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setSelectedFacilityId(1)
      })

      expect(result.current.shouldFetchData).toBe(true)
    })
  })

  describe('Regular user (non-privileged)', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue(createSessionMock('user'))
      mockUseQuery.mockReturnValue({ data: [], isLoading: false })
    })

    it('should always allow data fetch (server enforces their don_vi)', () => {
      const { result } = renderHook(() => useTenantSelection(), {
        wrapper: createWrapper(),
      })

      expect(result.current.showSelector).toBe(false)
      expect(result.current.shouldFetchData).toBe(true)
    })

    it('should not show facility selector for regular users', () => {
      const { result } = renderHook(() => useTenantSelection(), {
        wrapper: createWrapper(),
      })

      expect(result.current.showSelector).toBe(false)
      expect(result.current.facilities).toEqual([])
    })
  })

  describe('to_qltb user (equipment team)', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue(createSessionMock('to_qltb'))
      mockUseQuery.mockReturnValue({ data: [], isLoading: false })
    })

    it('should always allow data fetch without selection', () => {
      const { result } = renderHook(() => useTenantSelection(), {
        wrapper: createWrapper(),
      })

      expect(result.current.showSelector).toBe(false)
      expect(result.current.shouldFetchData).toBe(true)
    })
  })
})

// =============================================================================
// Tests: Regional leader sees only their facilities
// =============================================================================

describe('Regional leader sees only their facilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
    mockSessionStorage.getItem.mockReturnValue(null)
  })

  it('should fetch facilities with role and dia_ban_id in query key', () => {
    mockUseSession.mockReturnValue(createSessionMock('regional_leader', 1))
    mockUseQuery.mockReturnValue({ data: MOCK_FACILITIES_REGION_1, isLoading: false })

    renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    // Verify useQuery was called with correct query key
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['facilities_with_equipment_count', { role: 'regional_leader', diaBan: 1 }],
        enabled: true,
      })
    )
  })

  it('should return only region-specific facilities', () => {
    mockUseSession.mockReturnValue(createSessionMock('regional_leader', 1))
    mockUseQuery.mockReturnValue({ data: MOCK_FACILITIES_REGION_1, isLoading: false })

    const { result } = renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    expect(result.current.facilities).toEqual(MOCK_FACILITIES_REGION_1)
    expect(result.current.facilities.length).toBe(2)
    expect(result.current.facilities.every(f => f.name.includes('An Giang'))).toBe(true)
  })

  it('should have different cache for different regions', () => {
    // Region 1 user
    mockUseSession.mockReturnValue(createSessionMock('regional_leader', 1))
    mockUseQuery.mockReturnValue({ data: MOCK_FACILITIES_REGION_1, isLoading: false })

    const { result: result1 } = renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    const queryKey1 = mockUseQuery.mock.calls[0][0].queryKey

    // Reset and render for region 2 user
    vi.clearAllMocks()
    mockUseSession.mockReturnValue(createSessionMock('regional_leader', 2))
    mockUseQuery.mockReturnValue({ data: [{ id: 2, name: 'Bệnh viện Đa khoa Cần Thơ' }], isLoading: false })

    renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    const queryKey2 = mockUseQuery.mock.calls[0][0].queryKey

    // Query keys should be different for different regions
    expect(queryKey1).not.toEqual(queryKey2)
    expect(queryKey1[1].diaBan).toBe(1)
    expect(queryKey2[1].diaBan).toBe(2)
  })

  it('should show selector for regional_leader', () => {
    mockUseSession.mockReturnValue(createSessionMock('regional_leader', 1))
    mockUseQuery.mockReturnValue({ data: MOCK_FACILITIES_REGION_1, isLoading: false })

    const { result } = renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    expect(result.current.showSelector).toBe(true)
  })
})

// =============================================================================
// Tests: Global user sees all facilities
// =============================================================================

describe('Global user sees all facilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
    mockSessionStorage.getItem.mockReturnValue(null)
    mockUseSession.mockReturnValue(createSessionMock('global'))
    mockUseQuery.mockReturnValue({ data: MOCK_FACILITIES_ALL, isLoading: false })
  })

  it('should fetch facilities with global role in query key', () => {
    renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['facilities_with_equipment_count', { role: 'global', diaBan: undefined }],
        enabled: true,
      })
    )
  })

  it('should return all facilities for global user', () => {
    const { result } = renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    expect(result.current.facilities).toEqual(MOCK_FACILITIES_ALL)
    expect(result.current.facilities.length).toBe(4)
  })

  it('should preserve active-only equipment counts from facility payload', () => {
    const activeOnlyFacilities: FacilityOption[] = [
      { id: 1, name: 'Facility A', count: 3 },
      { id: 2, name: 'Facility B', count: 1 },
    ]
    mockUseQuery.mockReturnValue({ data: activeOnlyFacilities, isLoading: false })

    const { result } = renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    expect(result.current.facilities).toEqual(activeOnlyFacilities)
    expect(result.current.facilities.map((facility) => facility.count)).toEqual([3, 1])
  })

  it('should show selector for global user', () => {
    const { result } = renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    expect(result.current.showSelector).toBe(true)
  })
})

// =============================================================================
// Tests: Context error handling
// =============================================================================

describe('Context error handling', () => {
  it('should throw error when useTenantSelection is used outside provider', () => {
    mockUseSession.mockReturnValue(createSessionMock('global'))

    // Suppress console.error for expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useTenantSelection())
    }).toThrow('useTenantSelection must be used within TenantSelectionProvider')

    consoleSpy.mockRestore()
  })
})

// =============================================================================
// Tests: Loading states
// =============================================================================

describe('Loading states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.clear()
    mockSessionStorage._reset()
    mockSessionStorage.getItem.mockReturnValue(null)
  })

  it('should indicate loading state while fetching facilities', () => {
    mockUseSession.mockReturnValue(createSessionMock('global'))
    mockUseQuery.mockReturnValue({ data: [], isLoading: true })

    const { result } = renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
  })

  it('should not fetch facilities when session is loading', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' })
    mockUseQuery.mockReturnValue({ data: [], isLoading: false })

    renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    // useQuery should be called with enabled: false
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    )
  })

  it('should not fetch facilities when unauthenticated', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    mockUseQuery.mockReturnValue({ data: [], isLoading: false })

    renderHook(() => useTenantSelection(), {
      wrapper: createWrapper(),
    })

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    )
  })
})
