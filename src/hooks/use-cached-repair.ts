import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'

// Query keys for caching
export const repairKeys = {
  all: ['repair'] as const,
  lists: () => [...repairKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...repairKeys.lists(), { filters }] as const,
  details: () => [...repairKeys.all, 'detail'] as const,
  detail: (id: string) => [...repairKeys.details(), id] as const,
}

// Fetch repair requests with filters
export function useRepairRequests(filters?: {
  search?: string
  trang_thai?: string
  phong_ban?: string
  muc_do_uu_tien?: string
  dateFrom?: string
  dateTo?: string
}) {
  return useQuery({
    queryKey: repairKeys.list(filters || {}),
    queryFn: async () => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      let query = supabase
        .from('yeu_cau_sua_chua')
        .select(`
          *,
          thiet_bi:thiet_bi(ma_thiet_bi, ten_thiet_bi, phong_ban:phong_ban(ten_phong_ban)),
          nguoi_yeu_cau:profiles!yeu_cau_sua_chua_nguoi_yeu_cau_fkey(ho_ten),
          nguoi_xu_ly:profiles!yeu_cau_sua_chua_nguoi_xu_ly_fkey(ho_ten)
        `)

      // Apply filters
      if (filters?.search) {
        query = query.or(`mo_ta_su_co.ilike.%${filters.search}%,ghi_chu.ilike.%${filters.search}%`)
      }
      if (filters?.trang_thai) {
        query = query.eq('trang_thai', filters.trang_thai)
      }
      if (filters?.muc_do_uu_tien) {
        query = query.eq('muc_do_uu_tien', filters.muc_do_uu_tien)
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom)
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Fetch single repair request details
export function useRepairRequestDetail(id: string | null) {
  return useQuery({
    queryKey: repairKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }
      
      const { data, error } = await supabase
        .from('yeu_cau_sua_chua')
        .select(`
          *,
          thiet_bi:thiet_bi(*),
          nguoi_yeu_cau:profiles!yeu_cau_sua_chua_nguoi_yeu_cau_fkey(*),
          nguoi_xu_ly:profiles!yeu_cau_sua_chua_nguoi_xu_ly_fkey(*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Create repair request mutation
export function useCreateRepairRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: any) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data: newRepair, error } = await supabase
        .from('yeu_cau_sua_chua')
        .insert(data)
        .select()
        .single()

      if (error) throw error
      return newRepair
    },
    onSuccess: () => {
      // Invalidate all repair queries
      queryClient.invalidateQueries({ queryKey: repairKeys.all })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Tạo yêu cầu sửa chữa thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo yêu cầu sửa chữa",
        variant: "destructive",
      })
    },
  })
}

// Update repair request mutation
export function useUpdateRepairRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; data: any }) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('yeu_cau_sua_chua')
        .update(params.data)
        .eq('id', params.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      // Invalidate repair queries
      queryClient.invalidateQueries({ queryKey: repairKeys.lists() })
      // Update specific repair detail cache
      queryClient.setQueryData(repairKeys.detail(data.id), data)
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Cập nhật yêu cầu sửa chữa thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật yêu cầu sửa chữa",
        variant: "destructive",
      })
    },
  })
}

// Assign repair request mutation
export function useAssignRepairRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; nguoi_xu_ly: string }) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('yeu_cau_sua_chua')
        .update({
          trang_thai: 'dang_xu_ly',
          nguoi_xu_ly: params.nguoi_xu_ly,
          ngay_bat_dau_xu_ly: new Date().toISOString()
        })
        .eq('id', params.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      // Invalidate repair queries
      queryClient.invalidateQueries({ queryKey: repairKeys.all })
      
      toast({
        title: "Thành công",
        description: "Phân công sửa chữa thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể phân công sửa chữa",
        variant: "destructive",
      })
    },
  })
}

// Complete repair request mutation
export function useCompleteRepairRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { 
      id: string
      ket_qua?: string
      ghi_chu?: string
      chi_phi?: number
      nguoi_xu_ly: string
    }) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('yeu_cau_sua_chua')
        .update({
          trang_thai: 'hoan_thanh',
          ngay_hoan_thanh: new Date().toISOString(),
          ket_qua: params.ket_qua,
          ghi_chu: params.ghi_chu,
          chi_phi: params.chi_phi,
          nguoi_xu_ly: params.nguoi_xu_ly
        })
        .eq('id', params.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      // Invalidate repair queries
      queryClient.invalidateQueries({ queryKey: repairKeys.all })
      
      toast({
        title: "Thành công",
        description: "Hoàn thành sửa chữa thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể hoàn thành sửa chữa",
        variant: "destructive",
      })
    },
  })
}

// Delete repair request mutation
export function useDeleteRepairRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { error } = await supabase
        .from('yeu_cau_sua_chua')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      // Invalidate all repair queries
      queryClient.invalidateQueries({ queryKey: repairKeys.all })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Xóa yêu cầu sửa chữa thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa yêu cầu sửa chữa",
        variant: "destructive",
      })
    },
  })
} 