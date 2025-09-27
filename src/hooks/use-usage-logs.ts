import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
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
      const numericId = Number(equipmentId)
      if (!Number.isFinite(numericId)) {
        throw new Error('Invalid equipment identifier')
      }

      const data = await callRpc<UsageLog[]>({
        fn: 'usage_log_list',
        args: {
          p_thiet_bi_id: numericId,
          p_limit: 500,
        },
      })

      return data ?? []
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
      const data = await callRpc<UsageLog[]>({
        fn: 'usage_log_list',
        args: {
          p_active_only: true,
          p_limit: 200,
        },
      })

      return data ?? []
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
      const result = await callRpc<UsageLog>({
        fn: 'usage_session_start',
        args: {
          p_thiet_bi_id: data.thiet_bi_id,
          p_nguoi_su_dung_id: data.nguoi_su_dung_id,
          p_tinh_trang_thiet_bi: data.tinh_trang_thiet_bi ?? null,
          p_ghi_chu: data.ghi_chu ?? null,
        },
      })

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
      const result = await callRpc<UsageLog>({
        fn: 'usage_session_end',
        args: {
          p_usage_log_id: data.id,
          p_tinh_trang_thiet_bi: data.tinh_trang_thiet_bi ?? null,
          p_ghi_chu: data.ghi_chu ?? null,
        },
      })

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
      await callRpc<{ success: boolean }>({
        fn: 'usage_log_delete',
        args: {
          p_usage_log_id: id,
        },
      })
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
