import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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

// Fetch maintenance plans (ke_hoach_bao_tri)
export function useMaintenancePlans(filters?: {
  search?: string
}) {
  return useQuery({
    queryKey: maintenanceKeys.plan(filters || {}),
    queryFn: async () => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      let query = supabase
        .from('ke_hoach_bao_tri')
        .select(`
          id,
          created_at,
          ten_ke_hoach,
          nam,
          khoa_phong,
          trang_thai,
          ngay_phe_duyet,
          nguoi_duyet,
          nguoi_lap_ke_hoach,
          loai_cong_viec,
          ly_do_khong_duyet
        `)
        .order('nam', { ascending: false })
        .order('created_at', { ascending: false })

      // Apply search filter
      if (filters?.search) {
        query = query.or(`ten_ke_hoach.ilike.%${filters.search}%,khoa_phong.ilike.%${filters.search}%,nguoi_lap_ke_hoach.ilike.%${filters.search}%`)
      }

      const { data, error } = await query

      if (error) throw error
      return data
    },
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
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      let query = supabase
        .from('cong_viec_bao_tri')
        .select(`
          *,
          thiet_bi:thiet_bi(ma_thiet_bi, ten_thiet_bi, phong_ban:phong_ban(ten_phong_ban)),
          nguoi_thuc_hien:profiles(ho_ten)
        `)

      // Apply filters
      if (filters?.search) {
        query = query.or(`mo_ta.ilike.%${filters.search}%,ghi_chu.ilike.%${filters.search}%`)
      }
      if (filters?.trang_thai) {
        query = query.eq('trang_thai', filters.trang_thai)
      }
      if (filters?.loai_bao_tri) {
        query = query.eq('loai_cong_viec', filters.loai_bao_tri)
      }
      if (filters?.dateFrom) {
        query = query.gte('ngay_bao_tri', filters.dateFrom)
      }
      if (filters?.dateTo) {
        query = query.lte('ngay_bao_tri', filters.dateTo)
      }

      const { data, error } = await query.order('ngay_bao_tri', { ascending: false })

      if (error) throw error
      return data
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
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      let query = supabase
        .from('cong_viec_bao_tri')
        .select(`
          *,
          thiet_bi:thiet_bi(ma_thiet_bi, ten_thiet_bi),
          nguoi_thuc_hien:profiles(ho_ten)
        `)
        .eq('trang_thai', 'hoan_thanh')

      if (filters?.thiet_bi_id) {
        query = query.eq('thiet_bi_id', filters.thiet_bi_id)
      }
      if (filters?.dateFrom) {
        query = query.gte('ngay_bao_tri', filters.dateFrom)
      }
      if (filters?.dateTo) {
        query = query.lte('ngay_bao_tri', filters.dateTo)
      }

      const { data, error } = await query.order('ngay_bao_tri', { ascending: false })

      if (error) throw error
      return data
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
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }
      
      const { data, error } = await supabase
        .from('cong_viec_bao_tri')
        .select(`
          *,
          thiet_bi:thiet_bi(*),
          nguoi_thuc_hien:profiles(*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
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
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data: newPlan, error } = await supabase
        .from('ke_hoach_bao_tri')
        .insert(data)
        .select()
        .single()

      if (error) throw error
      return newPlan
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
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('ke_hoach_bao_tri')
        .update(params.data)
        .eq('id', params.id)
        .select()
        .single()

      if (error) throw error
      return data
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

// Delete maintenance plan mutation
export function useDeleteMaintenancePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { error } = await supabase
        .from('ke_hoach_bao_tri')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      // Invalidate all maintenance plan queries
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.plans() })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Xóa kế hoạch bảo trì thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
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
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data: newSchedule, error } = await supabase
        .from('cong_viec_bao_tri')
        .insert(data)
        .select()
        .single()

      if (error) throw error
      return newSchedule
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
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('cong_viec_bao_tri')
        .update(params.data)
        .eq('id', params.id)
        .select()
        .single()

      if (error) throw error
      return data
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
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('cong_viec_bao_tri')
        .update({
          trang_thai: 'hoan_thanh',
          ngay_hoan_thanh: new Date().toISOString(),
          ket_qua: params.ket_qua,
          ghi_chu: params.ghi_chu,
          chi_phi: params.chi_phi,
          nguoi_thuc_hien: params.nguoi_thuc_hien
        })
        .eq('id', params.id)
        .select()
        .single()

      if (error) throw error
      return data
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
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { error } = await supabase
        .from('cong_viec_bao_tri')
        .delete()
        .eq('id', id)

      if (error) throw error
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