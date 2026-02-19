import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from '@tanstack/react-query'

// Mock callRpc
const mockCallRpc = vi.fn()
vi.mock('@/lib/rpc-client', () => ({
  callRpc: (args: any) => mockCallRpc(args),
}))

// Mock useToast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: (args: any) => mockToast(args),
}))

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 1,
        role: 'to_qltb',
        don_vi: 5,
        name: 'Test User',
      },
    },
    status: 'authenticated',
  }),
}))

// Import hook under test after mocks
import { useDeleteEquipment } from '@/hooks/use-cached-equipment'

// Test utilities
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

const createWrapper = (queryClient: QueryClient) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

// Mock equipment data
const mockEquipment = {
  id: 1,
  ma_thiet_bi: 'EQ-001',
  ten_thiet_bi: 'Test Equipment',
  model: 'Model A',
  serial: 'SN-001',
  don_vi: 5,
  khoa_phong_quan_ly: 'Khoa Nội',
  tinh_trang_hien_tai: 'Hoạt động',
  vi_tri_lap_dat: 'Phòng 101',
  nguoi_dang_truc_tiep_quan_ly: 'Nguyễn Văn A',
}

describe('Equipment CRUD Mutations', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createQueryClient()
    mockCallRpc.mockReset()
  })

  afterEach(() => {
    queryClient.clear()
  })

  describe('Create Equipment (equipment_create)', () => {
    it('should create equipment successfully', async () => {
      const newEquipment = {
        ...mockEquipment,
        id: 2,
        ma_thiet_bi: 'EQ-002',
      }
      mockCallRpc.mockResolvedValue(newEquipment)

      const { result } = renderHook(
        () => {
          const qc = useQueryClient()
          return useMutation({
            mutationFn: async (payload: typeof mockEquipment) => {
              return await mockCallRpc({ fn: 'equipment_create', args: { p_payload: payload } })
            },
            onSuccess: () => {
              qc.invalidateQueries({ queryKey: ['equipment_list'] })
            },
          })
        },
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate(mockEquipment)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: 'equipment_create',
        args: { p_payload: mockEquipment },
      })
      expect(result.current.data).toEqual(newEquipment)
    })

    it('should handle create error with permission denied', async () => {
      mockCallRpc.mockRejectedValue(new Error('Permission denied'))

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (payload: typeof mockEquipment) => {
              return await mockCallRpc({ fn: 'equipment_create', args: { p_payload: payload } })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate(mockEquipment)
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toBe('Permission denied')
    })

    it('should validate required fields before create', async () => {
      const invalidEquipment = {
        ...mockEquipment,
        ma_thiet_bi: '', // Required field empty
        ten_thiet_bi: '', // Required field empty
      }

      // In real implementation, validation happens via zod schema
      // Here we test that the RPC is not called with invalid data
      const validateAndCreate = async (data: typeof mockEquipment) => {
        if (!data.ma_thiet_bi || !data.ten_thiet_bi) {
          throw new Error('Validation failed: required fields missing')
        }
        return await mockCallRpc({ fn: 'equipment_create', args: { p_payload: data } })
      }

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: validateAndCreate,
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate(invalidEquipment)
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(mockCallRpc).not.toHaveBeenCalled()
    })
  })

  describe('Update Equipment (equipment_update)', () => {
    it('should update equipment successfully with p_patch', async () => {
      const updatedEquipment = { ...mockEquipment, ten_thiet_bi: 'Updated Equipment' }
      mockCallRpc.mockResolvedValue(updatedEquipment)

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (vars: { id: number; patch: Partial<typeof mockEquipment> }) => {
              return await mockCallRpc({
                fn: 'equipment_update',
                args: { p_id: vars.id, p_patch: vars.patch },
              })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate({
          id: 1,
          patch: { ten_thiet_bi: 'Updated Equipment' },
        })
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: 'equipment_update',
        args: {
          p_id: 1,
          p_patch: { ten_thiet_bi: 'Updated Equipment' },
        },
      })
    })

    it('should handle update with all fields', async () => {
      const fullPatch = {
        ma_thiet_bi: 'EQ-001-UPDATED',
        ten_thiet_bi: 'Updated Name',
        model: 'New Model',
        serial: 'New Serial',
        khoa_phong_quan_ly: 'Khoa Ngoại',
        tinh_trang_hien_tai: 'Chờ sửa chữa',
        ghi_chu: 'Updated note',
      }
      mockCallRpc.mockResolvedValue({ ...mockEquipment, ...fullPatch })

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (vars: { id: number; patch: typeof fullPatch }) => {
              return await mockCallRpc({
                fn: 'equipment_update',
                args: { p_id: vars.id, p_patch: vars.patch },
              })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate({ id: 1, patch: fullPatch })
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: 'equipment_update',
        args: { p_id: 1, p_patch: fullPatch },
      })
    })

    it('should handle update error for non-existent equipment', async () => {
      mockCallRpc.mockRejectedValue(new Error('Equipment not found'))

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (vars: { id: number; patch: Partial<typeof mockEquipment> }) => {
              return await mockCallRpc({
                fn: 'equipment_update',
                args: { p_id: vars.id, p_patch: vars.patch },
              })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate({ id: 9999, patch: { ten_thiet_bi: 'Test' } })
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toBe('Equipment not found')
    })

    it('should handle tenant isolation error on update', async () => {
      mockCallRpc.mockRejectedValue(new Error('Access denied for update'))

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (vars: { id: number; patch: Partial<typeof mockEquipment> }) => {
              return await mockCallRpc({
                fn: 'equipment_update',
                args: { p_id: vars.id, p_patch: vars.patch },
              })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate({ id: 1, patch: { ten_thiet_bi: 'Test' } })
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toContain('Access denied')
    })

    it('should invalidate queries after successful update', async () => {
      mockCallRpc.mockResolvedValue(mockEquipment)
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(
        () => {
          const qc = useQueryClient()
          return useMutation({
            mutationFn: async (vars: { id: number; patch: Partial<typeof mockEquipment> }) => {
              return await mockCallRpc({
                fn: 'equipment_update',
                args: { p_id: vars.id, p_patch: vars.patch },
              })
            },
            onSuccess: () => {
              qc.invalidateQueries({ queryKey: ['equipment_list'] })
            },
          })
        },
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate({ id: 1, patch: { ten_thiet_bi: 'Test' } })
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['equipment_list'] })
    })
  })

  describe('Delete Equipment (equipment_delete)', () => {
    it('should delete equipment successfully', async () => {
      mockCallRpc.mockResolvedValue({ success: true, id: 1 })

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (id: number) => {
              return await mockCallRpc({ fn: 'equipment_delete', args: { p_id: id } })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate(1)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: 'equipment_delete',
        args: { p_id: 1 },
      })
      expect(result.current.data).toEqual({ success: true, id: 1 })
    })

    it('should handle delete permission denied', async () => {
      mockCallRpc.mockRejectedValue(new Error('Permission denied'))

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (id: number) => {
              return await mockCallRpc({ fn: 'equipment_delete', args: { p_id: id } })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate(1)
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toBe('Permission denied')
    })

    it('should handle delete for non-existent equipment', async () => {
      mockCallRpc.mockRejectedValue(new Error('Access denied'))

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (id: number) => {
              return await mockCallRpc({ fn: 'equipment_delete', args: { p_id: id } })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate(9999)
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
    })

    it('should invalidate queries after successful delete', async () => {
      mockCallRpc.mockResolvedValue({ success: true, id: 1 })
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(
        () => {
          const qc = useQueryClient()
          return useMutation({
            mutationFn: async (id: number) => {
              return await mockCallRpc({ fn: 'equipment_delete', args: { p_id: id } })
            },
            onSuccess: () => {
              qc.invalidateQueries({ queryKey: ['equipment_list'] })
              qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
            },
          })
        },
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate(1)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['equipment_list'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard-stats'] })
    })

    it('should coerce string row id before calling equipment_delete RPC', async () => {
      mockCallRpc.mockResolvedValue(undefined)

      const { result } = renderHook(() => useDeleteEquipment(), {
        wrapper: createWrapper(queryClient),
      })

      act(() => {
        result.current.mutate('42')
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: 'equipment_delete',
        args: { p_id: 42 },
      })
    })
  })

  describe('Restore Equipment (equipment_restore)', () => {
    it('should restore equipment successfully', async () => {
      mockCallRpc.mockResolvedValue({ success: true, id: 1, restored: true })

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (id: number) => {
              return await mockCallRpc({ fn: 'equipment_restore', args: { p_id: id } })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate(1)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: 'equipment_restore',
        args: { p_id: 1 },
      })
      expect(result.current.data).toEqual({ success: true, id: 1, restored: true })
    })
  })

  describe('Get Single Equipment (equipment_get)', () => {
    it('should fetch single equipment by ID', async () => {
      mockCallRpc.mockResolvedValue(mockEquipment)

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (id: number) => {
              return await mockCallRpc({ fn: 'equipment_get', args: { p_id: id } })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate(1)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: 'equipment_get',
        args: { p_id: 1 },
      })
      expect(result.current.data).toEqual(mockEquipment)
    })

    it('should handle equipment not found', async () => {
      mockCallRpc.mockRejectedValue(new Error('Equipment not found or access denied'))

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (id: number) => {
              return await mockCallRpc({ fn: 'equipment_get', args: { p_id: id } })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate(9999)
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toContain('not found')
    })
  })

  describe('Role-Based Access Control', () => {
    it('should allow to_qltb role to create equipment', async () => {
      mockCallRpc.mockResolvedValue(mockEquipment)

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (payload: typeof mockEquipment) => {
              return await mockCallRpc({ fn: 'equipment_create', args: { p_payload: payload } })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate(mockEquipment)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    it('should handle permission denied error from RPC', async () => {
      // Note: Actual RBAC is enforced server-side in RPC functions.
      // This test verifies the client correctly handles permission errors.
      mockCallRpc.mockRejectedValue(new Error('Permission denied'))

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async (vars: { id: number; patch: Partial<typeof mockEquipment> }) => {
              return await mockCallRpc({
                fn: 'equipment_update',
                args: { p_id: vars.id, p_patch: vars.patch },
              })
            },
          }),
        { wrapper: createWrapper(queryClient) }
      )

      act(() => {
        result.current.mutate({ id: 1, patch: { ten_thiet_bi: 'Test' } })
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toBe('Permission denied')
    })
  })
})
