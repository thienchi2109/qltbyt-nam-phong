import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import { type UsageLog } from '@/types/database'

// Query keys for caching
export const usageLogKeys = {
  all: ['usage-logs'] as const,
  lists: () => [...usageLogKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...usageLogKeys.lists(), { filters }] as const,
  details: () => [...usageLogKeys.all, 'detail'] as const,
  detail: (id: string) => [...usageLogKeys.details(), id] as const,
  equipment: (equipmentId: string) => [...usageLogKeys.all, 'equipment', equipmentId] as const,
  active: () => [...usageLogKeys.all, 'active'] as const,
}

// Fetch usage logs for specific equipment
export function useEquipmentUsageLogs(equipmentId: string | null) {
  return useQuery({
    queryKey: usageLogKeys.equipment(equipmentId || ''),
    queryFn: async () => {
      if (!equipmentId) return []
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('nhat_ky_su_dung')
        .select(`
          *,
          nguoi_su_dung:nhan_vien(id, full_name, khoa_phong)
        `)
        .eq('thiet_bi_id', equipmentId)
        .order('thoi_gian_bat_dau', { ascending: false })

      if (error) throw error
      return data as UsageLog[]
    },
    enabled: !!equipmentId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Fetch active usage sessions
export function useActiveUsageLogs() {
  return useQuery({
    queryKey: usageLogKeys.active(),
    queryFn: async () => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('nhat_ky_su_dung')
        .select(`
          *,
          thiet_bi:thiet_bi(id, ma_thiet_bi, ten_thiet_bi),
          nguoi_su_dung:nhan_vien(id, full_name, khoa_phong)
        `)
        .eq('trang_thai', 'dang_su_dung')
        .order('thoi_gian_bat_dau', { ascending: false })

      if (error) throw error
      return data as UsageLog[]
    },
    staleTime: 10 * 1000, // 10 seconds for active sessions
  })
}

// Start usage session mutation
export function useStartUsageSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      thiet_bi_id: number
      nguoi_su_dung_id: number
      tinh_trang_thiet_bi?: string
      ghi_chu?: string
    }) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      // Check if there's already an active session for this equipment
      const { data: existingSession, error: checkError } = await supabase
        .from('nhat_ky_su_dung')
        .select('id')
        .eq('thiet_bi_id', data.thiet_bi_id)
        .eq('trang_thai', 'dang_su_dung')
        .maybeSingle()

      if (checkError) throw checkError

      if (existingSession) {
        throw new Error('Thiết bị này đang được sử dụng bởi người khác')
      }

      const { data: result, error } = await supabase
        .from('nhat_ky_su_dung')
        .insert({
          thiet_bi_id: data.thiet_bi_id,
          nguoi_su_dung_id: data.nguoi_su_dung_id,
          thoi_gian_bat_dau: new Date().toISOString(),
          tinh_trang_thiet_bi: data.tinh_trang_thiet_bi,
          ghi_chu: data.ghi_chu,
          trang_thai: 'dang_su_dung'
        })
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: usageLogKeys.active() })
      queryClient.invalidateQueries({ queryKey: usageLogKeys.equipment(data.thiet_bi_id.toString()) })
      
      toast({
        title: "Thành công",
        description: "Đã bắt đầu phiên sử dụng thiết bị."
      })
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Không thể bắt đầu phiên sử dụng."
      })
    }
  })
}

// End usage session mutation
export function useEndUsageSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      id: number
      tinh_trang_thiet_bi?: string
      ghi_chu?: string
    }) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data: result, error } = await supabase
        .from('nhat_ky_su_dung')
        .update({
          thoi_gian_ket_thuc: new Date().toISOString(),
          tinh_trang_thiet_bi: data.tinh_trang_thiet_bi,
          ghi_chu: data.ghi_chu,
          trang_thai: 'hoan_thanh',
          updated_at: new Date().toISOString()
        })
        .eq('id', data.id)
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: usageLogKeys.active() })
      queryClient.invalidateQueries({ queryKey: usageLogKeys.equipment(data.thiet_bi_id.toString()) })
      
      toast({
        title: "Thành công",
        description: "Đã kết thúc phiên sử dụng thiết bị."
      })
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Không thể kết thúc phiên sử dụng."
      })
    }
  })
}

// Delete usage log mutation
export function useDeleteUsageLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { error } = await supabase
        .from('nhat_ky_su_dung')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      // Invalidate all usage log queries
      queryClient.invalidateQueries({ queryKey: usageLogKeys.all })
      
      toast({
        title: "Thành công",
        description: "Đã xóa bản ghi sử dụng."
      })
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Không thể xóa bản ghi sử dụng."
      })
    }
  })
}
