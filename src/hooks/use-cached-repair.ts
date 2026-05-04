import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { normalizeRpcError } from '@/lib/error-utils'
import { callRpc } from '@/lib/rpc-client'

type RepairRequestMutationInput = Record<string, unknown>
type RepairRequestDetailRecord = Record<string, unknown> | null
type UpdateRepairRequestParams = {
  id: string
  data: RepairRequestMutationInput
}
type AssignRepairRequestParams = {
  id: string
  nguoi_xu_ly: string
}
type CompleteRepairRequestParams = {
  id: string
  ket_qua?: string
  ghi_chu?: string
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized ? normalized : null
}

function toRequiredString(value: unknown, fieldName: string): string {
  const normalized = toNullableString(value)
  if (!normalized) {
    throw new Error(`Thiếu trường ${fieldName}`)
  }
  return normalized
}

function toIntegerId(value: unknown, fieldName: string): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`ID không hợp lệ cho ${fieldName}`)
  }
  return parsed
}

// Query keys for caching
export const repairKeys = {
  all: ['repair'] as const,
  lists: () => [...repairKeys.all, 'list'] as const,
  details: () => [...repairKeys.all, 'detail'] as const,
  detail: (id: string) => [...repairKeys.details(), id] as const,
}

// Fetch single repair request details
export function useRepairRequestDetail(id: string | null) {
  return useQuery({
    queryKey: repairKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null

      return callRpc<RepairRequestDetailRecord>({
        fn: 'repair_request_get',
        args: {
          p_id: toIntegerId(id, 'id'),
        },
      })
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Create repair request mutation
export function useCreateRepairRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: RepairRequestMutationInput) => {
      return callRpc<number>({
        fn: 'repair_request_create',
        args: {
          p_thiet_bi_id: toIntegerId(data.thiet_bi_id, 'thiet_bi_id'),
          p_mo_ta_su_co: toRequiredString(data.mo_ta_su_co, 'mo_ta_su_co'),
          p_hang_muc_sua_chua: toNullableString(data.hang_muc_sua_chua),
          p_ngay_mong_muon_hoan_thanh: toNullableString(data.ngay_mong_muon_hoan_thanh),
          p_nguoi_yeu_cau: toNullableString(data.nguoi_yeu_cau),
          p_don_vi_thuc_hien: toNullableString(data.don_vi_thuc_hien),
          p_ten_don_vi_thue: toNullableString(data.ten_don_vi_thue),
        },
      })
    },
    onSuccess: () => {
      // Invalidate all repair queries
      queryClient.invalidateQueries({ queryKey: repairKeys.all })
      queryClient.invalidateQueries({ queryKey: ['repair_request_overdue_summary'] })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Tạo yêu cầu sửa chữa thành công",
      })
    },
    onError: (error: unknown) => {
      toast({
        title: "Lỗi",
        description: normalizeRpcError(error, "Không thể tạo yêu cầu sửa chữa"),
        variant: "destructive",
      })
    },
  })
}

// Update repair request mutation
export function useUpdateRepairRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: UpdateRepairRequestParams) => {
      await callRpc<void>({
        fn: 'repair_request_update',
        args: {
          p_id: toIntegerId(params.id, 'id'),
          p_mo_ta_su_co: toRequiredString(params.data.mo_ta_su_co, 'mo_ta_su_co'),
          p_hang_muc_sua_chua: toNullableString(params.data.hang_muc_sua_chua),
          p_ngay_mong_muon_hoan_thanh: toNullableString(params.data.ngay_mong_muon_hoan_thanh),
          p_don_vi_thuc_hien: toNullableString(params.data.don_vi_thuc_hien),
          p_ten_don_vi_thue: toNullableString(params.data.ten_don_vi_thue),
        },
      })
    },
    onSuccess: (_data, _variables) => {
      // Invalidate the entire repair query family so any subscriber under
      // repairKeys.all (lists, detail(id), and future sub-keys such as
      // active(equipmentId)) refetches fresh data after an update. This aligns
      // useUpdateRepairRequest with create/approve/complete/delete mutations,
      // which all invalidate the same prefix.
      queryClient.invalidateQueries({ queryKey: repairKeys.all })
      queryClient.invalidateQueries({ queryKey: ['repair_request_overdue_summary'] })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Cập nhật yêu cầu sửa chữa thành công",
      })
    },
    onError: (error: unknown) => {
      toast({
        title: "Lỗi",
        description: normalizeRpcError(error, "Không thể cập nhật yêu cầu sửa chữa"),
        variant: "destructive",
      })
    },
  })
}

// Assign repair request mutation
export function useAssignRepairRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: AssignRepairRequestParams) => {
      await callRpc<void>({
        fn: 'repair_request_approve',
        args: {
          p_id: toIntegerId(params.id, 'id'),
          p_nguoi_duyet: toRequiredString(params.nguoi_xu_ly, 'nguoi_xu_ly'),
          p_don_vi_thuc_hien: 'noi_bo',
          p_ten_don_vi_thue: null,
        },
      })
    },
    onSuccess: () => {
      // Invalidate repair queries
      queryClient.invalidateQueries({ queryKey: repairKeys.all })
      queryClient.invalidateQueries({ queryKey: ['repair_request_overdue_summary'] })
      
      toast({
        title: "Thành công",
        description: "Phân công sửa chữa thành công",
      })
    },
    onError: (error: unknown) => {
      toast({
        title: "Lỗi",
        description: normalizeRpcError(error, "Không thể phân công sửa chữa"),
        variant: "destructive",
      })
    },
  })
}

// Complete repair request mutation
export function useCompleteRepairRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: CompleteRepairRequestParams) => {
      await callRpc<void>({
        fn: 'repair_request_complete',
        args: {
          p_id: toIntegerId(params.id, 'id'),
          p_completion: toNullableString(params.ket_qua),
          p_reason: toNullableString(params.ghi_chu),
        },
      })
    },
    onSuccess: () => {
      // Invalidate repair queries
      queryClient.invalidateQueries({ queryKey: repairKeys.all })
      queryClient.invalidateQueries({ queryKey: ['repair_request_overdue_summary'] })
      
      toast({
        title: "Thành công",
        description: "Hoàn thành sửa chữa thành công",
      })
    },
    onError: (error: unknown) => {
      toast({
        title: "Lỗi",
        description: normalizeRpcError(error, "Không thể hoàn thành sửa chữa"),
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
      await callRpc<void>({
        fn: 'repair_request_delete',
        args: {
          p_id: toIntegerId(id, 'id'),
        },
      })
    },
    onSuccess: () => {
      // Invalidate all repair queries
      queryClient.invalidateQueries({ queryKey: repairKeys.all })
      queryClient.invalidateQueries({ queryKey: ['repair_request_overdue_summary'] })
      // Invalidate dashboard stats to update KPI cards
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })

      toast({
        title: "Thành công",
        description: "Xóa yêu cầu sửa chữa thành công",
      })
    },
    onError: (error: unknown) => {
      toast({
        title: "Lỗi",
        description: normalizeRpcError(error, "Không thể xóa yêu cầu sửa chữa"),
        variant: "destructive",
      })
    },
  })
} 
