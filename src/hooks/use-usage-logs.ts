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
  equipment: (equipmentId: string, options?: Record<string, any>) => 
    [...usageLogKeys.all, 'equipment', equipmentId, options] as const,
  active: (tenantKey?: string | number) => [...usageLogKeys.all, 'active', tenantKey] as const,
}

// Fetch usage logs for specific equipment with optimized parameters
export function useEquipmentUsageLogs(
  equipmentId: string | null,
  options: {
    limit?: number
    daysBack?: number
    includeActive?: boolean
  } = {}
) {
  const {
    limit = 50, // Reduced from 500 to 50
    daysBack = 90, // Default to last 3 months
    includeActive = true
  } = options

  // Calculate date range
  const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  return useQuery({
    queryKey: usageLogKeys.equipment(equipmentId || '', { limit, daysBack, includeActive }),
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
          p_limit: limit,
          p_started_from: dateFrom + 'T00:00:00Z', // Only fetch recent usage
        },
      })

      return data ?? []
    },
    enabled: !!equipmentId,
    staleTime: 5 * 60 * 1000, // 5 minutes for historical data (changes infrequently)
    gcTime: 30 * 60 * 1000, // Keep in cache longer
  })
}

// Separate hook for loading more historical data
export function useEquipmentUsageLogsMore(
  equipmentId: string | null,
  offset: number,
  options: {
    limit?: number
    daysBack?: number
  } = {}
) {
  const {
    limit = 50,
    daysBack = 365, // Full year for "load more"
  } = options

  const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  return useQuery({
    queryKey: usageLogKeys.equipment(equipmentId || '', { limit, offset, daysBack }),
    queryFn: async () => {
      if (!equipmentId || offset === 0) return [] // Don't fetch if offset is 0 (handled by main hook)
      const numericId = Number(equipmentId)
      if (!Number.isFinite(numericId)) {
        throw new Error('Invalid equipment identifier')
      }

      const data = await callRpc<UsageLog[]>({
        fn: 'usage_log_list',
        args: {
          p_thiet_bi_id: numericId,
          p_limit: limit,
          p_offset: offset,
          p_started_from: dateFrom + 'T00:00:00Z',
        },
      })

      return data ?? []
    },
    enabled: !!equipmentId && offset > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes for older data
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
  })
}

// Fetch active usage sessions with optional tenant filtering
export function useActiveUsageLogs(options: {
  tenantId?: number | null
  enabled?: boolean
  refetchInterval?: number
} = {}) {
  const {
    tenantId,
    enabled = true,
    refetchInterval, // Allow caller to specify polling interval
  } = options

  const tenantKey = tenantId ?? 'all'
  
  return useQuery({
    queryKey: usageLogKeys.active(tenantKey),
    queryFn: async () => {
      const data = await callRpc<UsageLog[]>({
        fn: 'usage_log_list',
        args: {
          p_active_only: true,
          p_limit: 200,
          p_don_vi: tenantId ?? null, // Filter by tenant if specified
        },
      })

      return data ?? []
    },
    enabled,
    staleTime: 30 * 1000, // Increased to 30 seconds (active sessions don't change that frequently)
    refetchInterval: refetchInterval || 2 * 60 * 1000, // Default to 2 minutes instead of 10 seconds
    refetchIntervalInBackground: false, // Don't poll when tab is not active
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
