import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'

// Mock next-auth
const mockUseSession = vi.fn()
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

// Import after mocking
import { useEquipmentAuth } from '../_hooks/useEquipmentAuth'

describe('useEquipmentAuth', () => {
  const mockLocalStorage: Record<string, string> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockLocalStorage[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete mockLocalStorage[key]
        }),
        clear: vi.fn(() => {
          Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key])
        }),
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key])
  })

  describe('Loading State', () => {
    it('should return loading status when session is loading', () => {
      mockUseSession.mockReturnValue({ data: null, status: 'loading' })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.status).toBe('loading')
      expect(result.current.user).toBeUndefined()
    })
  })

  describe('Unauthenticated State', () => {
    it('should return unauthenticated status when no session', () => {
      mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.status).toBe('unauthenticated')
      expect(result.current.user).toBeUndefined()
      expect(result.current.isGlobal).toBe(false)
      expect(result.current.isRegionalLeader).toBe(false)
    })
  })

  describe('Regular User', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: 1,
            role: 'user',
            don_vi: 5,
            name: 'Test User',
          },
        },
        status: 'authenticated',
      })
    })

    it('should identify as non-global user', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.isGlobal).toBe(false)
      expect(result.current.isRegionalLeader).toBe(false)
    })

    it('should use user don_vi as tenantKey', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.tenantKey).toBe('5')
    })

    it('should always fetch equipment for regular users', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.shouldFetchEquipment).toBe(true)
    })

    it('should set currentTenantId to user don_vi', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.currentTenantId).toBe(5)
    })

    it('should have null selectedDonVi for non-global users', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.selectedDonVi).toBeNull()
    })
  })

  describe('Global User', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: 1,
            role: 'global',
            don_vi: null,
            name: 'Global Admin',
          },
        },
        status: 'authenticated',
      })
    })

    it('should identify as global user', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.isGlobal).toBe(true)
      expect(result.current.isRegionalLeader).toBe(false)
    })

    it('should default tenantFilter to "unset"', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.tenantFilter).toBe('unset')
    })

    it('should not fetch equipment when tenantFilter is "unset"', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.shouldFetchEquipment).toBe(false)
    })

    it('should fetch equipment when tenantFilter is "all"', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      act(() => {
        result.current.setTenantFilter('all')
      })

      expect(result.current.shouldFetchEquipment).toBe(true)
    })

    it('should fetch equipment when tenantFilter is a numeric ID', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      act(() => {
        result.current.setTenantFilter('123')
      })

      expect(result.current.shouldFetchEquipment).toBe(true)
    })

    it('should persist tenantFilter to localStorage', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      act(() => {
        result.current.setTenantFilter('42')
      })

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'equipment_tenant_filter',
        '42'
      )
    })

    it('should set selectedDonVi when filtering by specific tenant', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      act(() => {
        result.current.setTenantFilter('99')
      })

      expect(result.current.selectedDonVi).toBe(99)
    })

    it('should have null selectedDonVi when filtering by "all"', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      act(() => {
        result.current.setTenantFilter('all')
      })

      expect(result.current.selectedDonVi).toBeNull()
    })

    it('should set currentTenantId when filtering by specific tenant', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      act(() => {
        result.current.setTenantFilter('77')
      })

      expect(result.current.currentTenantId).toBe(77)
    })

    it('should have null currentTenantId when filtering by "all"', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      act(() => {
        result.current.setTenantFilter('all')
      })

      expect(result.current.currentTenantId).toBeNull()
    })
  })

  describe('Admin User', () => {
    it('should identify admin as global user', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: 1,
            role: 'admin',
            don_vi: null,
            name: 'Admin',
          },
        },
        status: 'authenticated',
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.isGlobal).toBe(true)
    })
  })

  describe('Regional Leader', () => {
    it('should identify regional_leader correctly', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: 1,
            role: 'regional_leader',
            don_vi: 10,
            dia_ban_id: 2,
            name: 'Regional Leader',
          },
        },
        status: 'authenticated',
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.isGlobal).toBe(false)
      expect(result.current.isRegionalLeader).toBe(true)
    })
  })

  describe('effectiveTenantKey', () => {
    it('should return tenantKey for non-global users', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: 1, role: 'user', don_vi: 42 },
        },
        status: 'authenticated',
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.effectiveTenantKey).toBe('42')
    })

    it('should return "unset" for global users before selection', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: 1, role: 'global', don_vi: null },
        },
        status: 'authenticated',
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.effectiveTenantKey).toBe('unset')
    })

    it('should return tenantFilter for global users after selection', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: 1, role: 'global', don_vi: null },
        },
        status: 'authenticated',
      })

      const { result } = renderHook(() => useEquipmentAuth())

      act(() => {
        result.current.setTenantFilter('55')
      })

      expect(result.current.effectiveTenantKey).toBe('55')
    })
  })
})
