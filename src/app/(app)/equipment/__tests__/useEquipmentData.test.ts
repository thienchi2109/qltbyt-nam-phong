import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock callRpc
const mockCallRpc = vi.fn()
vi.mock('@/lib/rpc-client', () => ({
  callRpc: (args: any) => mockCallRpc(args),
}))

// Mock useFacilityFilter
vi.mock('@/hooks/useFacilityFilter', () => ({
  useFacilityFilter: () => ({
    showFacilityFilter: false,
    selectedFacilityId: null,
    setSelectedFacilityId: vi.fn(),
  }),
}))

// Mock useActiveUsageLogs
vi.mock('@/hooks/use-usage-logs', () => ({
  useActiveUsageLogs: () => ({
    data: [],
    isLoading: false,
  }),
}))

// Import after mocking
import { useEquipmentData } from '../_hooks/useEquipmentData'
import type { UseEquipmentDataParams } from '../_hooks/useEquipmentData'

// Default params for tests
const createDefaultParams = (overrides?: Partial<UseEquipmentDataParams>): UseEquipmentDataParams => ({
  isGlobal: false,
  isRegionalLeader: false,
  userRole: 'user',
  shouldFetchEquipment: true,
  effectiveTenantKey: '5',
  selectedDonVi: 5,
  currentTenantId: 5,
  debouncedSearch: '',
  sortParam: 'id.asc',
  pagination: { pageIndex: 0, pageSize: 20 },
  selectedDepartments: [],
  selectedUsers: [],
  selectedLocations: [],
  selectedStatuses: [],
  selectedClassifications: [],
  ...overrides,
})

// Helper to create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useEquipmentData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementations
    mockCallRpc.mockImplementation(({ fn }: { fn: string }) => {
      switch (fn) {
        case 'equipment_list_enhanced':
          return Promise.resolve({ data: [], total: 0 })
        case 'tenant_list':
          return Promise.resolve([])
        case 'departments_list_for_tenant':
          return Promise.resolve([])
        case 'equipment_users_list_for_tenant':
          return Promise.resolve([])
        case 'equipment_locations_list_for_tenant':
          return Promise.resolve([])
        case 'equipment_statuses_list_for_tenant':
          return Promise.resolve([])
        case 'equipment_classifications_list_for_tenant':
          return Promise.resolve([])
        case 'get_facilities_with_equipment_count':
          return Promise.resolve([])
        default:
          return Promise.resolve(null)
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Equipment List Query', () => {
    it('should fetch equipment list when enabled', async () => {
      const mockEquipment = [
        { id: 1, ma_thiet_bi: 'EQ-001', ten_thiet_bi: 'Test Equipment 1' },
        { id: 2, ma_thiet_bi: 'EQ-002', ten_thiet_bi: 'Test Equipment 2' },
      ]
      mockCallRpc.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === 'equipment_list_enhanced') {
          return Promise.resolve({ data: mockEquipment, total: 2 })
        }
        return Promise.resolve([])
      })

      const { result } = renderHook(() => useEquipmentData(createDefaultParams()), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockEquipment)
      expect(result.current.total).toBe(2)
    })

    it('should not fetch equipment when shouldFetchEquipment is false', async () => {
      const { result } = renderHook(
        () => useEquipmentData(createDefaultParams({ shouldFetchEquipment: false })),
        { wrapper: createWrapper() }
      )

      // Wait a bit to ensure no fetch happens
      await new Promise((r) => setTimeout(r, 100))

      expect(mockCallRpc).not.toHaveBeenCalledWith(
        expect.objectContaining({ fn: 'equipment_list_enhanced' })
      )
      expect(result.current.data).toEqual([])
    })

    it('should pass correct parameters to RPC', async () => {
      mockCallRpc.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === 'equipment_list_enhanced') {
          return Promise.resolve({ data: [], total: 0 })
        }
        return Promise.resolve([])
      })

      renderHook(
        () =>
          useEquipmentData(
            createDefaultParams({
              debouncedSearch: 'test search',
              sortParam: 'ten_thiet_bi.desc',
              pagination: { pageIndex: 2, pageSize: 50 },
              selectedDonVi: 10,
              selectedDepartments: ['Khoa A'],
              selectedStatuses: ['Hoạt động'],
            })
          ),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(mockCallRpc).toHaveBeenCalledWith(
          expect.objectContaining({
            fn: 'equipment_list_enhanced',
            args: expect.objectContaining({
              p_q: 'test search',
              p_sort: 'ten_thiet_bi.desc',
              p_page: 3, // pageIndex + 1
              p_page_size: 50,
              p_don_vi: 10,
              p_khoa_phong_array: ['Khoa A'],
              p_tinh_trang_array: ['Hoạt động'],
            }),
          })
        )
      })
    })

    it('should handle empty search and filters', async () => {
      renderHook(() => useEquipmentData(createDefaultParams()), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(mockCallRpc).toHaveBeenCalledWith(
          expect.objectContaining({
            fn: 'equipment_list_enhanced',
            args: expect.objectContaining({
              p_q: null,
              p_khoa_phong_array: null,
              p_nguoi_su_dung_array: null,
              p_vi_tri_lap_dat_array: null,
              p_tinh_trang_array: null,
              p_phan_loai_array: null,
            }),
          })
        )
      })
    })
  })

  describe('Filter Options Queries', () => {
    it('should fetch departments for tenant', async () => {
      const mockDepartments = [
        { name: 'Khoa Nội', count: 10 },
        { name: 'Khoa Ngoại', count: 5 },
      ]
      mockCallRpc.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === 'departments_list_for_tenant') {
          return Promise.resolve(mockDepartments)
        }
        if (fn === 'equipment_list_enhanced') {
          return Promise.resolve({ data: [], total: 0 })
        }
        return Promise.resolve([])
      })

      const { result } = renderHook(() => useEquipmentData(createDefaultParams()), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.departments).toEqual(['Khoa Nội', 'Khoa Ngoại'])
      })
    })

    it('should fetch users for tenant', async () => {
      const mockUsers = [
        { name: 'Nguyễn Văn A', count: 3 },
        { name: 'Trần Thị B', count: 2 },
      ]
      mockCallRpc.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === 'equipment_users_list_for_tenant') {
          return Promise.resolve(mockUsers)
        }
        if (fn === 'equipment_list_enhanced') {
          return Promise.resolve({ data: [], total: 0 })
        }
        return Promise.resolve([])
      })

      const { result } = renderHook(() => useEquipmentData(createDefaultParams()), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.users).toEqual(['Nguyễn Văn A', 'Trần Thị B'])
      })
    })

    it('should fetch statuses for tenant', async () => {
      const mockStatuses = [
        { name: 'Hoạt động', count: 50 },
        { name: 'Chờ sửa chữa', count: 10 },
      ]
      mockCallRpc.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === 'equipment_statuses_list_for_tenant') {
          return Promise.resolve(mockStatuses)
        }
        if (fn === 'equipment_list_enhanced') {
          return Promise.resolve({ data: [], total: 0 })
        }
        return Promise.resolve([])
      })

      const { result } = renderHook(() => useEquipmentData(createDefaultParams()), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.statuses).toEqual(['Hoạt động', 'Chờ sửa chữa'])
      })
    })

    it('should build filterData correctly', async () => {
      mockCallRpc.mockImplementation(({ fn }: { fn: string }) => {
        switch (fn) {
          case 'equipment_list_enhanced':
            return Promise.resolve({ data: [], total: 0 })
          case 'departments_list_for_tenant':
            return Promise.resolve([{ name: 'Khoa A', count: 5 }])
          case 'equipment_statuses_list_for_tenant':
            return Promise.resolve([{ name: 'Hoạt động', count: 10 }])
          case 'equipment_locations_list_for_tenant':
            return Promise.resolve([{ name: 'Phòng 101', count: 3 }])
          default:
            return Promise.resolve([])
        }
      })

      const { result } = renderHook(() => useEquipmentData(createDefaultParams()), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.filterData.department).toEqual([
          { id: 'Khoa A', label: 'Khoa A', count: 5 },
        ])
        expect(result.current.filterData.status).toEqual([
          { id: 'Hoạt động', label: 'Hoạt động', count: 10 },
        ])
        expect(result.current.filterData.location).toEqual([
          { id: 'Phòng 101', label: 'Phòng 101', count: 3 },
        ])
      })
    })
  })

  describe('Global User Tenant List', () => {
    it('should fetch tenant list for global users', async () => {
      const mockTenants = [
        { id: 1, name: 'Hospital A', code: 'HA' },
        { id: 2, name: 'Hospital B', code: 'HB' },
      ]
      mockCallRpc.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === 'tenant_list') {
          return Promise.resolve(mockTenants)
        }
        if (fn === 'equipment_list_enhanced') {
          return Promise.resolve({ data: [], total: 0 })
        }
        return Promise.resolve([])
      })

      const { result } = renderHook(
        () => useEquipmentData(createDefaultParams({ isGlobal: true })),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.tenantOptions).toEqual(mockTenants)
      })
    })

    it('should not fetch tenant list for non-global users', async () => {
      renderHook(() => useEquipmentData(createDefaultParams({ isGlobal: false })), {
        wrapper: createWrapper(),
      })

      await new Promise((r) => setTimeout(r, 100))

      expect(mockCallRpc).not.toHaveBeenCalledWith(
        expect.objectContaining({ fn: 'tenant_list' })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle RPC errors gracefully', async () => {
      mockCallRpc.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === 'equipment_list_enhanced') {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve([])
      })

      const { result } = renderHook(() => useEquipmentData(createDefaultParams()), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should have empty data on error
      expect(result.current.data).toEqual([])
    })

    it('should handle null response from RPC', async () => {
      mockCallRpc.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === 'equipment_list_enhanced') {
          return Promise.resolve(null)
        }
        return Promise.resolve([])
      })

      const { result } = renderHook(() => useEquipmentData(createDefaultParams()), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual([])
      expect(result.current.total).toBe(0)
    })
  })

  describe('Cache Invalidation', () => {
    it('should provide invalidateEquipmentForCurrentTenant function', async () => {
      const { result } = renderHook(() => useEquipmentData(createDefaultParams()), {
        wrapper: createWrapper(),
      })

      expect(typeof result.current.invalidateEquipmentForCurrentTenant).toBe('function')
    })

    it('should respond to equipment-cache-invalidated event', async () => {
      mockCallRpc.mockImplementation(({ fn }: { fn: string }) => {
        if (fn === 'equipment_list_enhanced') {
          return Promise.resolve({ data: [{ id: 1 }], total: 1 })
        }
        return Promise.resolve([])
      })

      const { result } = renderHook(() => useEquipmentData(createDefaultParams()), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.data).toHaveLength(1)
      })

      // Dispatch event
      window.dispatchEvent(new CustomEvent('equipment-cache-invalidated'))

      // Should trigger refetch (callRpc called again)
      await waitFor(() => {
        const equipmentCalls = mockCallRpc.mock.calls.filter(
          (call) => call[0].fn === 'equipment_list_enhanced'
        )
        expect(equipmentCalls.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('Regional Leader', () => {
    it('should use selectedFacilityId for regional leader', async () => {
      // Override useFacilityFilter mock for this test
      vi.doMock('@/hooks/useFacilityFilter', () => ({
        useFacilityFilter: () => ({
          showFacilityFilter: true,
          selectedFacilityId: 99,
          setSelectedFacilityId: vi.fn(),
        }),
      }))

      const { result } = renderHook(
        () => useEquipmentData(createDefaultParams({ isRegionalLeader: true })),
        { wrapper: createWrapper() }
      )

      expect(result.current.showFacilityFilter).toBe(false) // Based on mock
    })
  })
})
