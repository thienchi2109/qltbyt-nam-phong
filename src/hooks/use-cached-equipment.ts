import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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

      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      let query = supabase
        .from('thiet_bi')
        .select(`
          *,
          phong_ban:phong_ban(ten_phong_ban),
          loai_thiet_bi:loai_thiet_bi(ten_loai)
        `)

      // Phase 3: Apply department filter based on cache scope
      if (cacheScope.scope === 'department' && userDepartment) {
        query = query.eq('khoa_phong_quan_ly', userDepartment)
      }

      // Apply other filters with optimized order (most selective first)
      if (filters?.trang_thai) {
        query = query.eq('trang_thai', filters.trang_thai)
      }
      if (filters?.loai_thiet_bi) {
        query = query.eq('loai_thiet_bi_id', filters.loai_thiet_bi)
      }
      if (filters?.phong_ban) {
        query = query.eq('phong_ban_id', filters.phong_ban)
      }
      if (filters?.search) {
        query = query.or(`ten_thiet_bi.ilike.%${filters.search}%,ma_thiet_bi.ilike.%${filters.search}%`)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

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
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }
      
      const { data, error } = await supabase
        .from('thiet_bi')
        .select(`
          *,
          phong_ban:phong_ban(ten_phong_ban),
          loai_thiet_bi:loai_thiet_bi(ten_loai),
          yeu_cau_luan_chuyen(
            *,
            phong_ban_gui:phong_ban!yeu_cau_luan_chuyen_phong_ban_gui_fkey(ten_phong_ban),
            phong_ban_nhan:phong_ban!yeu_cau_luan_chuyen_phong_ban_nhan_fkey(ten_phong_ban)
          )
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

// Update equipment mutation with cache invalidation
export function useUpdateEquipment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; data: any }) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('thiet_bi')
        .update(params.data)
        .eq('id', params.id)
        .select()
        .single()

      if (error) throw error
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
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data: newEquipment, error } = await supabase
        .from('thiet_bi')
        .insert(data)
        .select()
        .single()

      if (error) throw error
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
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { error } = await supabase
        .from('thiet_bi')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      // Invalidate all equipment queries
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

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