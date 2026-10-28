import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"
import { toast } from "@/hooks/use-toast"
import { normalizeRpcError } from "@/lib/error-utils"
import { type UsageLog } from "@/types/database"
import type { EquipmentDataset } from "@/app/(app)/equipment/_hooks/equipmentDataset"

type UsageLogListFilters = Record<string, unknown>
type UsageLogEquipmentKeyOptions = {
  limit?: number
  daysBack?: number
  includeActive?: boolean
  offset?: number
  equipmentDataset?: EquipmentDataset
}

// Query keys for caching
const usageLogKeys = {
  all: ["usage-logs"] as const,
  lists: () => [...usageLogKeys.all, "list"] as const,
  list: (filters: UsageLogListFilters) => [...usageLogKeys.lists(), { filters }] as const,
  details: () => [...usageLogKeys.all, "detail"] as const,
  detail: (id: string) => [...usageLogKeys.details(), id] as const,
  equipment: (equipmentId: string, options?: UsageLogEquipmentKeyOptions) =>
    [...usageLogKeys.all, "equipment", equipmentId, options] as const,
  active: (tenantKey?: string | number, equipmentDataset: EquipmentDataset = "regular") =>
    [...usageLogKeys.all, "active", tenantKey, equipmentDataset] as const,
}

// Fetch usage logs for specific equipment with optimized parameters
/** Loads recent usage history for one equipment record. */
export function useEquipmentUsageLogs(
  equipmentId: string | null,
  options: {
    limit?: number
    daysBack?: number
    includeActive?: boolean
    equipmentDataset?: EquipmentDataset
  } = {}
) {
  const {
    limit = 50, // Reduced from 500 to 50
    daysBack = 90, // Default to last 3 months
    includeActive = true,
    equipmentDataset = "regular",
  } = options

  // Calculate date range
  const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  return useQuery({
    queryKey: usageLogKeys.equipment(equipmentId || "", {
      limit,
      daysBack,
      includeActive,
      equipmentDataset,
    }),
    queryFn: async () => {
      if (!equipmentId) return []
      const numericId = Number(equipmentId)
      if (!Number.isFinite(numericId)) {
        throw new Error("Invalid equipment identifier")
      }

      const data = await callRpc<UsageLog[]>({
        fn: "usage_log_list",
        args: {
          p_thiet_bi_id: numericId,
          p_trang_thai: null,
          p_active_only: false,
          p_limit: limit,
          p_started_from: dateFrom + "T00:00:00Z", // Only fetch recent usage
          p_started_to: null,
          p_offset: 0,
          p_don_vi: null,
          p_equipment_dataset: equipmentDataset,
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
/** Loads a later page of historical usage records for one equipment record. */
export function useEquipmentUsageLogsMore(
  equipmentId: string | null,
  offset: number,
  options: {
    limit?: number
    daysBack?: number
    equipmentDataset?: EquipmentDataset
  } = {}
) {
  const {
    limit = 50,
    daysBack = 365, // Full year for "load more"
    equipmentDataset = "regular",
  } = options

  const dateFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  return useQuery({
    queryKey: usageLogKeys.equipment(equipmentId || "", {
      limit,
      offset,
      daysBack,
      equipmentDataset,
    }),
    queryFn: async () => {
      if (!equipmentId || offset === 0) return [] // Don't fetch if offset is 0 (handled by main hook)
      const numericId = Number(equipmentId)
      if (!Number.isFinite(numericId)) {
        throw new Error("Invalid equipment identifier")
      }

      const data = await callRpc<UsageLog[]>({
        fn: "usage_log_list",
        args: {
          p_thiet_bi_id: numericId,
          p_trang_thai: null,
          p_active_only: false,
          p_limit: limit,
          p_offset: offset,
          p_started_from: dateFrom + "T00:00:00Z",
          p_started_to: null,
          p_don_vi: null,
          p_equipment_dataset: equipmentDataset,
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
/** Loads active usage sessions scoped to a tenant and equipment dataset. */
export function useActiveUsageLogs(
  options: {
    tenantId?: number | null
    enabled?: boolean
    refetchInterval?: number
    equipmentDataset?: EquipmentDataset
  } = {}
) {
  const {
    tenantId,
    enabled = true,
    refetchInterval = 5_000,
    equipmentDataset = "regular",
  } = options

  const tenantKey = tenantId ?? "all"

  return useQuery({
    queryKey: usageLogKeys.active(tenantKey, equipmentDataset),
    queryFn: async () => {
      const logs: UsageLog[] = []
      for (let offset = 0; ; offset += 200) {
        const data = await callRpc<UsageLog[]>({
          fn: "usage_log_list",
          args: {
            p_thiet_bi_id: null,
            p_trang_thai: null,
            p_active_only: true,
            p_started_from: null,
            p_started_to: null,
            p_limit: 200,
            p_offset: offset,
            p_don_vi: tenantId ?? null, // Filter by tenant if specified
            p_equipment_dataset: equipmentDataset,
          },
        })
        if (
          !Array.isArray(data) ||
          data.some(
            (log) =>
              !log ||
              !Number.isFinite(log.id) ||
              !Number.isFinite(log.thiet_bi_id) ||
              log.trang_thai !== "dang_su_dung"
          )
        )
          throw new Error("Không thể xác định trạng thái sử dụng thiết bị.")
        logs.push(...data)
        if (data.length < 200) return logs
      }
    },
    enabled,
    staleTime: 0,
    refetchInterval,
    refetchIntervalInBackground: false, // Don't poll when tab is not active
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

// Start usage session mutation
/** Starts an equipment usage session. */
export function useStartUsageSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      thiet_bi_id: number
      nguoi_su_dung_id: number
      tinh_trang_thiet_bi?: string
      tinh_trang_ban_dau?: string
      ghi_chu?: string
    }) => {
      const result = await callRpc<UsageLog>({
        fn: "usage_session_start",
        args: {
          p_thiet_bi_id: data.thiet_bi_id,
          p_nguoi_su_dung_id: data.nguoi_su_dung_id,
          p_tinh_trang_thiet_bi: data.tinh_trang_thiet_bi ?? null,
          p_ghi_chu: data.ghi_chu ?? null,
          p_tinh_trang_ban_dau: data.tinh_trang_ban_dau ?? null,
        },
      })

      return result
    },
    onSuccess: async (data) => {
      // Invalidate relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["usage-logs", "active"] }),
        queryClient.invalidateQueries({
          queryKey: ["usage-logs", "equipment", data.thiet_bi_id.toString()],
        }),
      ]) // refetch server-confirmed state without writing into unrelated scopes

      toast({
        title: "Thành công",
        description: "Đã bắt đầu phiên sử dụng thiết bị.",
      })
    },
    onError: async (error: unknown) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: normalizeRpcError(error, "Không thể bắt đầu phiên sử dụng."),
      })
      await queryClient.invalidateQueries({ queryKey: ["usage-logs", "active"] })
    },
  })
}

// End usage session mutation
/** Ends an equipment usage session. */
export function useEndUsageSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      id: number
      tinh_trang_thiet_bi?: string
      tinh_trang_ket_thuc?: string
      ghi_chu?: string
    }) => {
      const result = await callRpc<UsageLog>({
        fn: "usage_session_end",
        args: {
          p_usage_log_id: data.id,
          p_tinh_trang_thiet_bi: data.tinh_trang_thiet_bi ?? null,
          p_ghi_chu: data.ghi_chu ?? null,
          p_tinh_trang_ket_thuc: data.tinh_trang_ket_thuc ?? null,
        },
      })

      return result
    },
    onSuccess: async (data) => {
      // Invalidate relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["usage-logs", "active"] }),
        queryClient.invalidateQueries({
          queryKey: ["usage-logs", "equipment", data.thiet_bi_id.toString()],
        }),
      ])

      toast({
        title: "Thành công",
        description: "Đã kết thúc phiên sử dụng thiết bị.",
      })
    },
    onError: (error: unknown) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: normalizeRpcError(error, "Không thể kết thúc phiên sử dụng."),
      })
    },
  })
}

// Delete usage log mutation
/** Deletes a usage log for authorized administrators. */
export function useDeleteUsageLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await callRpc<{ success: boolean }>({
        fn: "usage_log_delete",
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
        description: "Đã xóa bản ghi sử dụng.",
      })
    },
    onError: (error: unknown) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: normalizeRpcError(error, "Không thể xóa bản ghi sử dụng."),
      })
    },
  })
}
