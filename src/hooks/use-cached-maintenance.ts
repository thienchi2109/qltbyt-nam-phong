import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { normalizeRpcError } from '@/lib/error-utils'
import { toast } from '@/hooks/use-toast'
import {
  type MaintenanceHistoryFilters,
  type MaintenanceKeyFilters,
  type MaintenancePlanListResponse,
  type MaintenancePlanMutationInput,
  type MaintenanceScheduleFilters,
} from './use-cached-maintenance.types'
import {
  defaultMaintenanceTaskListArgs,
  fetchMaintenanceTaskList,
  filterMaintenanceTasksByEquipmentId,
  findMaintenanceTaskById,
} from './use-cached-maintenance.rpc'

export type { MaintenancePlan, MaintenancePlanListResponse } from './use-cached-maintenance.types'

export const maintenanceKeys = {
  all: ['maintenance'] as const,
  lists: () => [...maintenanceKeys.all, 'list'] as const,
  list: (filters: MaintenanceKeyFilters) => [...maintenanceKeys.lists(), { filters }] as const,
  details: () => [...maintenanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...maintenanceKeys.details(), id] as const,
  schedules: () => [...maintenanceKeys.all, 'schedules'] as const,
  schedule: (filters: MaintenanceKeyFilters) => [...maintenanceKeys.schedules(), { filters }] as const,
  plans: () => [...maintenanceKeys.all, 'plans'] as const,
  plan: (filters: MaintenanceKeyFilters) => [...maintenanceKeys.plans(), { filters }] as const,
}

export function useMaintenancePlans(
  filters?: {
    search?: string
    facilityId?: number | null
    page?: number
    pageSize?: number
  },
  options?: {
    enabled?: boolean
  }
) {
  const { search, facilityId, page = 1, pageSize = 50 } = filters || {}

  return useQuery<MaintenancePlanListResponse>({
    queryKey: maintenanceKeys.plan({
      search: search ?? undefined,
      facilityId: facilityId ?? null,
      page,
      pageSize,
    }),
    queryFn: async () => {
      const result = await callRpc<MaintenancePlanListResponse>({
        fn: 'maintenance_plan_list',
        args: {
          p_q: search ?? null,
          p_don_vi: facilityId ?? null,
          p_page: page,
          p_page_size: pageSize,
        },
      })

      const normalizedData = (result.data ?? []).map((plan) => ({
        ...plan,
        don_vi: plan.don_vi ? Number(plan.don_vi) : plan.don_vi,
      }))

      return {
        data: normalizedData,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      }
    },
    placeholderData: (previousData) => previousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

function useMaintenanceSchedules(filters?: MaintenanceScheduleFilters) {
  return useQuery({
    queryKey: maintenanceKeys.schedule(filters || {}),
    queryFn: async () =>
      fetchMaintenanceTaskList(callRpc, {
        ...defaultMaintenanceTaskListArgs,
        p_loai_cong_viec: filters?.loai_bao_tri ?? null,
      }),
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}

function useMaintenanceHistory(filters?: MaintenanceHistoryFilters) {
  return useQuery({
    queryKey: maintenanceKeys.list(filters || {}),
    queryFn: async () => {
      const data = await fetchMaintenanceTaskList(callRpc, defaultMaintenanceTaskListArgs)
      return filterMaintenanceTasksByEquipmentId(data, filters?.thiet_bi_id)
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  })
}

function useMaintenanceDetail(id: string | null) {
  return useQuery({
    queryKey: maintenanceKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) {
        return null
      }

      const data = await fetchMaintenanceTaskList(callRpc, defaultMaintenanceTaskListArgs)
      return findMaintenanceTaskById(data, id)
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateMaintenancePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: MaintenancePlanMutationInput) => {
      const id = await callRpc<number>({
        fn: 'maintenance_plan_create',
        args: {
          p_ten_ke_hoach: data.ten_ke_hoach,
          p_nam: data.nam,
          p_loai_cong_viec: data.loai_cong_viec,
          p_khoa_phong: data.khoa_phong ?? null,
          p_nguoi_lap_ke_hoach: data.nguoi_lap_ke_hoach ?? null,
        },
      })
      return { id, ...data }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.plans() })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: 'Thành công',
        description: 'Tạo kế hoạch bảo trì thành công',
      })
    },
    onError: (error: unknown) => {
      toast({
        title: 'Lỗi',
        description: normalizeRpcError(error, 'Không thể tạo kế hoạch bảo trì'),
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateMaintenancePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; data: MaintenancePlanMutationInput }) => {
      await callRpc<void>({
        fn: 'maintenance_plan_update',
        args: {
          p_id: Number(params.id),
          p_ten_ke_hoach: params.data.ten_ke_hoach,
          p_nam: params.data.nam,
          p_loai_cong_viec: params.data.loai_cong_viec,
          p_khoa_phong: params.data.khoa_phong ?? null,
        },
      })
      return { id: Number(params.id), ...params.data }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.plans() })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: 'Thành công',
        description: 'Cập nhật kế hoạch bảo trì thành công',
      })
    },
    onError: (error: unknown) => {
      toast({
        title: 'Lỗi',
        description: normalizeRpcError(error, 'Không thể cập nhật kế hoạch bảo trì'),
        variant: 'destructive',
      })
    },
  })
}

export function useApproveMaintenancePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: number; nguoi_duyet: string }) => {
      await callRpc<void>({
        fn: 'maintenance_plan_approve',
        args: {
          p_id: params.id,
          p_nguoi_duyet: params.nguoi_duyet,
        },
      })
      return params.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.plans() })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: 'Thành công',
        description: 'Kế hoạch đã được duyệt.',
      })
    },
    onError: (error: unknown) => {
      toast({
        title: 'Lỗi duyệt kế hoạch',
        description: normalizeRpcError(error, 'Không thể duyệt kế hoạch'),
        variant: 'destructive',
      })
    },
  })
}

export function useRejectMaintenancePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: number; nguoi_duyet: string; ly_do: string }) => {
      await callRpc<void>({
        fn: 'maintenance_plan_reject',
        args: {
          p_id: params.id,
          p_nguoi_duyet: params.nguoi_duyet,
          p_ly_do: params.ly_do,
        },
      })
      return params.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.plans() })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: 'Đã từ chối',
        description: 'Kế hoạch đã được từ chối.',
      })
    },
    onError: (error: unknown) => {
      toast({
        title: 'Lỗi từ chối kế hoạch',
        description: normalizeRpcError(error, 'Không thể từ chối kế hoạch'),
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteMaintenancePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string | number) => {
      await callRpc<void>({
        fn: 'maintenance_plan_delete',
        args: { p_id: Number(id) },
      })
      return Number(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.plans() })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: 'Đã xóa',
        description: 'Kế hoạch đã được xóa thành công.',
      })
    },
    onError: (error: unknown) => {
      toast({
        title: 'Lỗi xóa kế hoạch',
        description: normalizeRpcError(error, 'Không thể xóa kế hoạch bảo trì'),
        variant: 'destructive',
      })
    },
  })
}
