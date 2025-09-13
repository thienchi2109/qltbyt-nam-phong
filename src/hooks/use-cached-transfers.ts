import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'

// Query keys for caching
export const transferKeys = {
  all: ['transfers'] as const,
  lists: () => [...transferKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...transferKeys.lists(), { filters }] as const,
  details: () => [...transferKeys.all, 'detail'] as const,
  detail: (id: string) => [...transferKeys.details(), id] as const,
}

// Fetch all transfer requests with filters
export function useTransferRequests(filters?: {
  search?: string
  trang_thai?: string
  phong_ban_gui?: string
  phong_ban_nhan?: string
  dateFrom?: string
  dateTo?: string
}) {
  return useQuery({
    queryKey: transferKeys.list(filters || {}),
    queryFn: async () => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      let query = supabase
        .from('yeu_cau_luan_chuyen')
        .select(`
          *,
          thiet_bi(ma_thiet_bi, ten_thiet_bi)
        `)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters?.search) {
        query = query.or(`ly_do.ilike.%${filters.search}%,ghi_chu.ilike.%${filters.search}%`)
      }
      if (filters?.trang_thai) {
        query = query.eq('trang_thai', filters.trang_thai)
      }
      if (filters?.phong_ban_gui) {
        query = query.eq('phong_ban_gui', filters.phong_ban_gui)
      }
      if (filters?.phong_ban_nhan) {
        query = query.eq('phong_ban_nhan', filters.phong_ban_nhan)
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
    gcTime: 8 * 60 * 1000, // 8 minutes
  })
}

// Fetch single transfer request details
export function useTransferRequestDetail(id: string | null) {
  return useQuery({
    queryKey: transferKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }
      
      const { data, error } = await supabase
        .from('yeu_cau_luan_chuyen')
        .select(`
          *,
          thiet_bi:thiet_bi(*),
          phong_ban_gui:phong_ban!yeu_cau_luan_chuyen_phong_ban_gui_fkey(*),
          phong_ban_nhan:phong_ban!yeu_cau_luan_chuyen_phong_ban_nhan_fkey(*),
          nguoi_yeu_cau:profiles!yeu_cau_luan_chuyen_nguoi_yeu_cau_fkey(*),
          nguoi_duyet:profiles!yeu_cau_luan_chuyen_nguoi_duyet_fkey(*)
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

// Create transfer request mutation
export function useCreateTransferRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: any) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data: newTransfer, error } = await supabase
        .from('yeu_cau_luan_chuyen')
        .insert(data)
        .select()
        .single()

      if (error) throw error
      return newTransfer
    },
    onSuccess: () => {
      // Invalidate all transfer queries to refetch data
      queryClient.invalidateQueries({ queryKey: transferKeys.all })
      
      toast({
        title: "Thành công",
        description: "Tạo yêu cầu luân chuyển thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo yêu cầu luân chuyển",
        variant: "destructive",
      })
    },
  })
}

// Update transfer request mutation
export function useUpdateTransferRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; data: any }) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('yeu_cau_luan_chuyen')
        .update(params.data)
        .eq('id', params.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      // Invalidate and refetch transfer lists
      queryClient.invalidateQueries({ queryKey: transferKeys.lists() })
      // Update specific transfer detail cache
      queryClient.setQueryData(transferKeys.detail(data.id), data)
      
      toast({
        title: "Thành công",
        description: "Cập nhật yêu cầu luân chuyển thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật yêu cầu luân chuyển",
        variant: "destructive",
      })
    },
  })
}

// Approve transfer request mutation
export function useApproveTransferRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; nguoi_duyet: string; ghi_chu?: string }) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('yeu_cau_luan_chuyen')
        .update({
          trang_thai: 'da_duyet',
          nguoi_duyet: params.nguoi_duyet,
          ngay_duyet: new Date().toISOString(),
          ghi_chu: params.ghi_chu || null
        })
        .eq('id', params.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      // Invalidate transfer queries
      queryClient.invalidateQueries({ queryKey: transferKeys.all })
      
      toast({
        title: "Thành công",
        description: "Phê duyệt yêu cầu luân chuyển thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể phê duyệt yêu cầu",
        variant: "destructive",
      })
    },
  })
}

// Complete transfer request mutation
export function useCompleteTransferRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; nguoi_ban_giao: string }) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data, error } = await supabase
        .from('yeu_cau_luan_chuyen')
        .update({
          trang_thai: 'hoan_thanh',
          nguoi_ban_giao: params.nguoi_ban_giao,
          ngay_ban_giao: new Date().toISOString()
        })
        .eq('id', params.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      // Invalidate transfer and equipment queries
      queryClient.invalidateQueries({ queryKey: transferKeys.all })
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      
      toast({
        title: "Thành công",
        description: "Hoàn thành luân chuyển thiết bị thành công",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể hoàn thành luân chuyển",
        variant: "destructive",
      })
    },
  })
} 