import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { toast } from '@/hooks/use-toast'
import { useSession } from 'next-auth/react'
import type { TransferRequest } from '@/types/database'

// Query keys for caching
export const transferKeys = {
  all: ['transfers'] as const,
  lists: () => [...transferKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...transferKeys.lists(), { filters }] as const,
  details: () => [...transferKeys.all, 'detail'] as const,
  detail: (id: string) => [...transferKeys.details(), id] as const,
}

// Fetch all transfer requests with filters using enhanced RPC (server-side filtering)
export function useTransferRequests(filters?: {
  search?: string
  trang_thai?: string
  phong_ban_gui?: string
  phong_ban_nhan?: string
  dateFrom?: string
  dateTo?: string
  don_vi?: number | null
  dia_ban?: number | null
  khoa_phong?: string | null
}) {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role?.toLowerCase() ?? ''
  
  return useQuery<TransferRequest[]>({
    queryKey: transferKeys.list(filters || {}),
    queryFn: async () => {
      // SECURITY: Only global users can specify don_vi filter
      // For other roles (including regional_leader), server enforces via allowed_don_vi_for_session()
      // Server-side facility filtering reduces payload from 5000 → 20 records
      const data = await callRpc<any[]>({
        fn: 'transfer_request_list_enhanced',
        args: {
          p_q: filters?.search ?? null,
          p_status: filters?.trang_thai ?? null,
          p_page: 1,
          p_page_size: 5000,
          p_don_vi: filters?.don_vi ?? null, // ✅ Pass facility filter to server
          p_date_from: filters?.dateFrom ?? null,
          p_date_to: filters?.dateTo ?? null,
          p_khoa_phong: filters?.khoa_phong ?? null,
        },
      })
      return (data || []) as TransferRequest[]
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 8 * 60 * 1000,
  })
}

// Fetch single transfer request details
export function useTransferRequestDetail(id: string | null) {
  return useQuery<TransferRequest | null>({
    queryKey: transferKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null
      const data = await callRpc<any[]>({ fn: 'transfer_request_list', args: { p_q: null, p_status: null, p_page: 1, p_page_size: 5000 } })
      const item = (data || []).find((x: any) => String(x.id) === String(id))
      return (item as TransferRequest) ?? null
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
  })
}

// Create transfer request mutation
export function useCreateTransferRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: any) => {
      await callRpc({ fn: 'transfer_request_create', args: { p_data: data } })
      return true
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
      await callRpc({ fn: 'transfer_request_update', args: { p_id: Number(params.id), p_data: params.data } })
      return { id: Number(params.id) }
    },
    onSuccess: (data) => {
      // Invalidate and refetch transfer lists
      queryClient.invalidateQueries({ queryKey: transferKeys.lists() })
      // Update specific transfer detail cache
      queryClient.invalidateQueries({ queryKey: transferKeys.detail(String((data as any).id)) })
      
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
      await callRpc({ fn: 'transfer_request_update_status', args: { p_id: Number(params.id), p_status: 'da_duyet', p_payload: { nguoi_duyet_id: params.nguoi_duyet } } })
      return true
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
      await callRpc({ fn: 'transfer_request_complete', args: { p_id: Number(params.id) } })
      return true
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