import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { toast } from '@/hooks/use-toast'

// Query keys for caching
export const maintenanceKeys = {
  all: ['maintenance'] as const,
  lists: () => [...maintenanceKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...maintenanceKeys.lists(), { filters }] as const,
  details: () => [...maintenanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...maintenanceKeys.details(), id] as const,
  schedules: () => [...maintenanceKeys.all, 'schedules'] as const,
  schedule: (filters: Record<string, any>) => [...maintenanceKeys.schedules(), { filters }] as const,
  plans: () => [...maintenanceKeys.all, 'plans'] as const,
  plan: (filters: Record<string, any>) => [...maintenanceKeys.plans(), { filters }] as const,
}

// TypeScript interface for paginated maintenance plan response
export interface MaintenancePlanListResponse {
  data: MaintenancePlan[]
  total: number
  page: number
  pageSize: number
}

// TypeScript interface for individual maintenance plan (with facility_name from server-side JOIN)
export interface MaintenancePlan {
  id: number
  ten_ke_hoach: string
  nam: number
  loai_cong_viec: string
  khoa_phong: string | null
  nguoi_lap_ke_hoach: string | null
  trang_thai: 'Bản nháp' | 'Đã duyệt' | 'Không duyệt'
  ngay_phe_duyet: string | null
  nguoi_duyet: string | null
  ly_do_khong_duyet: string | null
  created_at: string
  don_vi: number | null
  facility_name: string | null  // ✅ NEW: From server-side JOIN (dv.name)
}

// Fetch maintenance plans (ke_hoach_bao_tri) with server-side pagination and facility filtering
export function useMaintenancePlans(filters?: {
  search?: string
  facilityId?: number | null
  page?: number
  pageSize?: number
}) {
  const { search, facilityId, page = 1, pageSize = 50 } = filters || {}

  return useQuery<MaintenancePlanListResponse>({
    // ✅ Query key includes ALL filter params for proper cache invalidation
    queryKey: maintenanceKeys.plan({
      search: search ?? null,
      facilityId: facilityId ?? null,
      page,
      pageSize
    }),
    queryFn: async () => {
      // ✅ Call new RPC with pagination and facility filter parameters
      const result = await callRpc<MaintenancePlanListResponse>({
        fn: 'maintenance_plan_list',
        args: {
          p_q: search ?? null,
          p_don_vi: facilityId ?? null,
          p_page: page,
          p_page_size: pageSize,
        }
      })

      // ✅ Normalize don_vi to number (keep existing logic for consistency)
      const normalizedData = (result.data ?? []).map(plan => ({
        ...plan,
        don_vi: plan.don_vi ? Number(plan.don_vi) : plan.don_vi
      }))

      return {
        data: normalizedData,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      }
    },
    // ✅ Prevent UI flash during pagination/filter changes
    placeholderData: (previousData) => previousData,
    staleTime: 3 * 60 * 1000, // 3 minutes - maintenance plans don't change frequently
    gcTime: 15 * 60 * 1000, // 15 minutes
  })
}

// Fetch maintenance schedules with filters
export function useMaintenanceSchedules(filters?: {
  search?: string
  phong_ban?: string
  trang_thai?: string
  loai_bao_tri?: string
  dateFrom?: string
  dateTo?: string
}) {
  return useQuery({
    queryKey: maintenanceKeys.schedule(filters || {}),
    queryFn: async () => {
      // Use "with equipment" variant to embed equipment fields
      const data = await callRpc<any[]>({
        fn: 'maintenance_tasks_list_with_equipment',
        args: {
          p_ke_hoach_id: null,
          p_thiet_bi_id: null,
          p_loai_cong_viec: filters?.loai_bao_tri ?? null,
          p_don_vi_thuc_hien: null,
        }
      })
      return (data ?? [])
    },
    staleTime: 3 * 60 * 1000, // 3 minutes - maintenance schedules don't change frequently
    gcTime: 15 * 60 * 1000, // 15 minutes
  })
}

// Fetch maintenance history
export function useMaintenanceHistory(filters?: {
  thiet_bi_id?: string
  dateFrom?: string
  dateTo?: string
}) {
  return useQuery({
    queryKey: maintenanceKeys.list(filters || {}),
    queryFn: async () => {
      // Use tasks RPC and filter client-side as an interim implementation
      const data = await callRpc<any[]>({
        fn: 'maintenance_tasks_list_with_equipment',
        args: { p_ke_hoach_id: null, p_thiet_bi_id: null, p_loai_cong_viec: null, p_don_vi_thuc_hien: null }
      })
      let items = (data ?? [])
      if (filters?.thiet_bi_id) {
        items = items.filter((x: any) => String(x.thiet_bi_id) === String(filters.thiet_bi_id))
      }
      // Date range filtering is skipped here due to schema variance; can be added with a dedicated RPC later
      return items
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - history data changes less frequently
    gcTime: 20 * 60 * 1000, // 20 minutes
  })
}

// Fetch single maintenance record details
export function useMaintenanceDetail(id: string | null) {
  return useQuery({
    queryKey: maintenanceKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null
      const data = await callRpc<any[]>({
        fn: 'maintenance_tasks_list_with_equipment',
        args: { p_ke_hoach_id: null, p_thiet_bi_id: null, p_loai_cong_viec: null, p_don_vi_thuc_hien: null }
      })
      const item = (data || []).find((x: any) => String(x.id) === String(id))
      return item ?? null
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Create maintenance plan mutation
export function useCreateMaintenancePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: any) => {
      const id = await callRpc<number>({
        fn: 'maintenance_plan_create',
        args: {
          p_ten_ke_hoach: data?.ten_ke_hoach,
          p_nam: data?.nam,
          p_loai_cong_viec: data?.loai_cong_viec,
          p_khoa_phong: data?.khoa_phong ?? null,
          p_nguoi_lap_ke_hoach: data?.nguoi_lap_ke_hoach ?? null,
        }
      })
      return { id, ...data }
    },
    onSuccess: () => {
      // Invalidate all maintenance plan queries
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.plans() })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Tạo kế hoạch bảo trì thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo kế hoạch bảo trì",
        variant: "destructive",
      })
    },
  })
}

// Update maintenance plan mutation
export function useUpdateMaintenancePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; data: any }) => {
      await callRpc<void>({
        fn: 'maintenance_plan_update',
        args: {
          p_id: Number(params.id),
          p_ten_ke_hoach: params.data?.ten_ke_hoach ?? null,
          p_nam: params.data?.nam ?? null,
          p_loai_cong_viec: params.data?.loai_cong_viec ?? null,
          p_khoa_phong: params.data?.khoa_phong ?? null,
        }
      })
      return { id: Number(params.id), ...params.data }
    },
    onSuccess: () => {
      // Invalidate maintenance plan queries
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.plans() })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Cập nhật kế hoạch bảo trì thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật kế hoạch bảo trì",
        variant: "destructive",
      })
    },
  })
}

// Approve maintenance plan mutation
export function useApproveMaintenancePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: number; nguoi_duyet: string }) => {
      await callRpc<void>({
        fn: 'maintenance_plan_approve',
        args: {
          p_id: params.id,
          p_nguoi_duyet: params.nguoi_duyet
        }
      })
      return params.id
    },
    onSuccess: () => {
      // Invalidate all maintenance plan queries
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.plans() })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Kế hoạch đã được duyệt.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi duyệt kế hoạch",
        description: error.message || "Không thể duyệt kế hoạch",
        variant: "destructive",
      })
    },
  })
}

// Reject maintenance plan mutation
export function useRejectMaintenancePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: number; nguoi_duyet: string; ly_do: string }) => {
      await callRpc<void>({
        fn: 'maintenance_plan_reject',
        args: {
          p_id: params.id,
          p_nguoi_duyet: params.nguoi_duyet,
          p_ly_do: params.ly_do
        }
      })
      return params.id
    },
    onSuccess: () => {
      // Invalidate all maintenance plan queries
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.plans() })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Đã từ chối",
        description: "Kế hoạch đã được từ chối.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi từ chối kế hoạch",
        description: error.message || "Không thể từ chối kế hoạch",
        variant: "destructive",
      })
    },
  })
}

// Delete maintenance plan mutation
export function useDeleteMaintenancePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string | number) => {
      await callRpc<void>({
        fn: 'maintenance_plan_delete',
        args: { p_id: Number(id) }
      })
      return Number(id)
    },
    onSuccess: () => {
      // Invalidate all maintenance plan queries
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.plans() })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Đã xóa",
        description: "Kế hoạch đã được xóa thành công.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi xóa kế hoạch",
        description: error.message || "Không thể xóa kế hoạch bảo trì",
        variant: "destructive",
      })
    },
  })
}

// Create maintenance schedule mutation
export function useCreateMaintenanceSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: any) => {
      await callRpc<void>({ fn: 'maintenance_tasks_bulk_insert', args: { p_tasks: [data] } as any })
      return true
    },
    onSuccess: () => {
      // Invalidate all maintenance queries
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Tạo công việc bảo trì thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo công việc bảo trì",
        variant: "destructive",
      })
    },
  })
}

// Update maintenance schedule mutation
export function useUpdateMaintenanceSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; data: any }) => {
      await callRpc<void>({ fn: 'maintenance_task_update', args: { p_id: Number(params.id), p_task: params.data } as any })
      return { id: Number(params.id), ...params.data }
    },
    onSuccess: (data) => {
      // Invalidate maintenance queries
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.schedules() })
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() })
      // Update specific maintenance detail cache
      queryClient.setQueryData(maintenanceKeys.detail(data.id), data)
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Cập nhật công việc bảo trì thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật công việc bảo trì",
        variant: "destructive",
      })
    },
  })
}

// Complete maintenance mutation
export function useCompleteMaintenance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { 
      id: string
      ket_qua?: string
      ghi_chu?: string
      chi_phi?: number
      nguoi_thuc_hien: string
    }) => {
      // Minimal RPC mapping; adjust when a dedicated completion RPC for schedules is available
      await callRpc<void>({ fn: 'maintenance_task_update', args: { p_id: Number(params.id), p_task: { ghi_chu: params.ghi_chu, ket_qua: params.ket_qua } } as any })
      return { id: Number(params.id) }
    },
    onSuccess: () => {
      // Invalidate all maintenance queries
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Hoàn thành bảo trì thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể hoàn thành bảo trì",
        variant: "destructive",
      })
    },
  })
}

// Delete maintenance schedule mutation
export function useDeleteMaintenanceSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await callRpc<void>({ fn: 'maintenance_tasks_delete', args: { p_ids: [Number(id)] } as any })
    },
    onSuccess: () => {
      // Invalidate all maintenance queries
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Xóa công việc bảo trì thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa công việc bảo trì",
        variant: "destructive",
      })
    },
  })
} 