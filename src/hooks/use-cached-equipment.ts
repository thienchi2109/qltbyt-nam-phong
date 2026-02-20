import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { toast } from '@/hooks/use-toast'
import { useSession } from 'next-auth/react'
import { CacheKeys, CACHE_CONFIG, DepartmentCacheUtils } from '@/lib/advanced-cache-manager'

// Phase 3: Use advanced cache keys from cache manager
export const equipmentKeys = CacheKeys.equipment

// Phase 3: Enhanced equipment fetching with advanced caching
export function useEquipment(filters?: {
  search?: string
  phong_ban?: string
  trang_thai?: string
  loai_thiet_bi?: string
}) {
  const { data: session } = useSession()
  const user = session?.user

  // Get user's cache scope using advanced cache manager (cast NextAuth user to our User type)
  const cacheScope = DepartmentCacheUtils.getUserCacheScope(user as any)
  const userDepartment = cacheScope.scope === 'department' ? cacheScope.department : undefined

  // Performance monitoring
  const startTime = performance.now()

  return useQuery({
    queryKey: equipmentKeys.list(filters || {}, userDepartment),
    queryFn: async () => {
      console.log('[useEquipment] Fetching equipment data with filters:', filters)
      console.log('[useEquipment] Cache scope:', cacheScope)
      console.log('[useEquipment] Department filter:', userDepartment)

      // Map filters to search query; advanced filtering to be implemented in SQL as needed
      const search = filters?.search ?? null
      const data = await callRpc<any[]>({
        fn: 'equipment_list',
        args: { p_q: search, p_sort: 'id.desc', p_page: 1, p_page_size: 200 },
      })

      // Log performance metrics
      const endTime = performance.now()
      console.log(`[useEquipment] Query completed in ${endTime - startTime}ms, returned ${data?.length || 0} items`)

      return data
    },
    // Phase 3: Advanced caching configuration
    staleTime: CACHE_CONFIG.EQUIPMENT_STALE_TIME,
    gcTime: CACHE_CONFIG.EQUIPMENT_GC_TIME,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    // Enable background refetching for better UX
    refetchInterval: cacheScope.scope === 'department' ? 10 * 60 * 1000 : false, // 10 min for department users
  })
}

// Fetch single equipment details
export function useEquipmentDetail(id: string | null) {
  return useQuery({
    queryKey: equipmentKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null
      const data = await callRpc<any>({ fn: 'equipment_get', args: { p_id: Number(id) } })
      return data
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Update equipment mutation with cache invalidation
export function useUpdateEquipment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; data: any }) => {
      const data = await callRpc<any>({ fn: 'equipment_update', args: { p_id: Number(params.id), p_patch: params.data } })
      return data
    },
    onSuccess: (data) => {
      // Invalidate and refetch equipment lists
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      // Update specific equipment detail cache
      queryClient.setQueryData(equipmentKeys.detail(data.id), data)
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Cập nhật thiết bị thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật thiết bị",
        variant: "destructive",
      })
    },
  })
}

// Create equipment mutation
export function useCreateEquipment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: any) => {
      const newEquipment = await callRpc<any>({ fn: 'equipment_create', args: { p_payload: data } })
      return newEquipment
    },
    onSuccess: () => {
      // Invalidate all equipment queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Thêm thiết bị thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể thêm thiết bị",
        variant: "destructive",
      })
    },
  })
}

// Delete equipment mutation
export function useDeleteEquipment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await callRpc({ fn: 'equipment_delete', args: { p_id: Number(id) } })
    },
    onSuccess: () => {
      // Invalidate main equipment table queries and refetch active pages immediately
      queryClient.invalidateQueries({ queryKey: ['equipment_list_enhanced'], refetchType: 'active' })
      // Keep legacy cache family invalidation for older screens
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      // Keep active usage status in sync with table actions
      queryClient.invalidateQueries({ queryKey: ['active_usage_logs'] })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      // Notify listeners that rely on event-driven invalidation
      window.dispatchEvent(new CustomEvent('equipment-cache-invalidated'))

      toast({
        title: "Thành công",
        description: "Xóa thiết bị thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa thiết bị",
        variant: "destructive",
      })
    },
  })
} 
