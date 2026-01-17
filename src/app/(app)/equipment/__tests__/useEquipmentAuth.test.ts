import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'

// Mock next-auth
const mockUseSession = vi.fn()
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

// Mock TenantSelectionContext
const mockUseTenantSelection = vi.fn()
vi.mock('@/contexts/TenantSelectionContext', () => ({
  useTenantSelection: () => mockUseTenantSelection(),
}))

// Import after mocking
import { useEquipmentAuth } from '../_hooks/useEquipmentAuth'

describe('useEquipmentAuth', () => {
  const defaultContextMock = {
    selectedFacilityId: undefined as number | null | undefined,
    setSelectedFacilityId: vi.fn(),
    facilities: [],
    showSelector: false,
    isLoading: false,
    shouldFetchData: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTenantSelection.mockReturnValue(defaultContextMock)
  })

  describe('Loading State', () => {
    it('should return loading status when session is loading', () => {
      mockUseSession.mockReturnValue({ data: null, status: 'loading' })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.status).toBe('loading')
      expect(result.current.user).toBeNull()
    })

    it('should not fetch equipment during loading state', () => {
      mockUseSession.mockReturnValue({ data: null, status: 'loading' })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.shouldFetchEquipment).toBe(false)
    })
  })

  describe('Unauthenticated State', () => {
    it('should return unauthenticated status when no session', () => {
      mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.status).toBe('unauthenticated')
      expect(result.current.user).toBeNull()
      expect(result.current.isGlobal).toBe(false)
      expect(result.current.isRegionalLeader).toBe(false)
    })

    it('should not fetch equipment when unauthenticated', () => {
      mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.shouldFetchEquipment).toBe(false)
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
      // Non-privileged users don't see selector
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: false,
        shouldFetchData: true,
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
      // Global users see selector
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
        selectedFacilityId: undefined,
        shouldFetchData: false, // Not selected yet
      })
    })

    it('should identify as global user', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.isGlobal).toBe(true)
      expect(result.current.isRegionalLeader).toBe(false)
    })

    it('should not fetch equipment when no facility selected (undefined)', () => {
      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.shouldFetchEquipment).toBe(false)
    })

    it('should fetch equipment when "all" facilities selected (null)', () => {
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
        selectedFacilityId: null,
        shouldFetchData: true,
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.shouldFetchEquipment).toBe(true)
    })

    it('should fetch equipment when specific facility selected', () => {
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
        selectedFacilityId: 123,
        shouldFetchData: true,
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.shouldFetchEquipment).toBe(true)
    })

    it('should set selectedDonVi when filtering by specific facility', () => {
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
        selectedFacilityId: 99,
        shouldFetchData: true,
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.selectedDonVi).toBe(99)
    })

    it('should have null selectedDonVi when filtering by "all" (null)', () => {
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
        selectedFacilityId: null,
        shouldFetchData: true,
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.selectedDonVi).toBeNull()
    })

    it('should set currentTenantId when filtering by specific facility', () => {
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
        selectedFacilityId: 77,
        shouldFetchData: true,
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.currentTenantId).toBe(77)
    })

    it('should have null currentTenantId when filtering by "all"', () => {
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
        selectedFacilityId: null,
        shouldFetchData: true,
      })

      const { result } = renderHook(() => useEquipmentAuth())

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
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
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
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.isGlobal).toBe(false)
      expect(result.current.isRegionalLeader).toBe(true)
    })
  })

  describe('effectiveTenantKey', () => {
    it('should return tenantKey for non-privileged users', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: 1, role: 'user', don_vi: 42 },
        },
        status: 'authenticated',
      })
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: false,
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.effectiveTenantKey).toBe('42')
    })

    it('should return "unset" for global users before selection (undefined)', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: 1, role: 'global', don_vi: null },
        },
        status: 'authenticated',
      })
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
        selectedFacilityId: undefined,
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.effectiveTenantKey).toBe('unset')
    })

    it('should return "all" for global users when all facilities selected (null)', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: 1, role: 'global', don_vi: null },
        },
        status: 'authenticated',
      })
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
        selectedFacilityId: null,
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.effectiveTenantKey).toBe('all')
    })

    it('should return facility ID for global users after selection', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: 1, role: 'global', don_vi: null },
        },
        status: 'authenticated',
      })
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
        selectedFacilityId: 55,
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.effectiveTenantKey).toBe('55')
    })
  })

  describe('Context values passthrough', () => {
    it('should expose setSelectedFacilityId from context', () => {
      const mockSetSelectedFacilityId = vi.fn()
      mockUseSession.mockReturnValue({
        data: {
          user: { id: 1, role: 'global', don_vi: null },
        },
        status: 'authenticated',
      })
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
        setSelectedFacilityId: mockSetSelectedFacilityId,
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.setSelectedFacilityId).toBe(mockSetSelectedFacilityId)
    })

    it('should expose facilities from context', () => {
      const mockFacilities = [
        { id: 1, name: 'Facility 1' },
        { id: 2, name: 'Facility 2' },
      ]
      mockUseSession.mockReturnValue({
        data: {
          user: { id: 1, role: 'global', don_vi: null },
        },
        status: 'authenticated',
      })
      mockUseTenantSelection.mockReturnValue({
        ...defaultContextMock,
        showSelector: true,
        facilities: mockFacilities,
      })

      const { result } = renderHook(() => useEquipmentAuth())

      expect(result.current.facilities).toBe(mockFacilities)
    })
  })
})
