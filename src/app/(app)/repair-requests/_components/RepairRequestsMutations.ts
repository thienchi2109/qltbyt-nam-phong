"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import type { AuthUser, RepairUnit } from "../types"


export function useCreateMutation(
  toast: ReturnType<typeof useToast>["toast"]
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      thiet_bi_id: number
      mo_ta_su_co: string
      hang_muc_sua_chua: string | null
      ngay_mong_muon_hoan_thanh: string | null
      nguoi_yeu_cau: string
      don_vi_thuc_hien: RepairUnit | null
      ten_don_vi_thue: string | null
    }) => {
      return callRpc({
        fn: 'repair_request_create',
        args: {
          p_thiet_bi_id: data.thiet_bi_id,
          p_mo_ta_su_co: data.mo_ta_su_co,
          p_hang_muc_sua_chua: data.hang_muc_sua_chua,
          p_ngay_mong_muon_hoan_thanh: data.ngay_mong_muon_hoan_thanh,
          p_nguoi_yeu_cau: data.nguoi_yeu_cau,
          p_don_vi_thuc_hien: data.don_vi_thuc_hien,
          p_ten_don_vi_thue: data.ten_don_vi_thue,
        }
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Yêu cầu sửa chữa đã được gửi." })
      queryClient.invalidateQueries({ queryKey: ['repair_request_list'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_facilities'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_status_counts'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_change_history'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Gửi yêu cầu thất bại",
        description: error.message
      })
    },
  })
}

export function useUpdateMutation(
  toast: ReturnType<typeof useToast>["toast"]
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      id: number
      mo_ta_su_co: string
      hang_muc_sua_chua: string
      ngay_mong_muon_hoan_thanh: string | null
      don_vi_thuc_hien?: RepairUnit
      ten_don_vi_thue: string | null
    }) => {
      return callRpc({
        fn: 'repair_request_update',
        args: {
          p_id: data.id,
          p_mo_ta_su_co: data.mo_ta_su_co,
          p_hang_muc_sua_chua: data.hang_muc_sua_chua,
          p_ngay_mong_muon_hoan_thanh: data.ngay_mong_muon_hoan_thanh,
          p_don_vi_thuc_hien: data.don_vi_thuc_hien,
          p_ten_don_vi_thue: data.ten_don_vi_thue,
        }
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã cập nhật yêu cầu." })
      queryClient.invalidateQueries({ queryKey: ['repair_request_list'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_facilities'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_status_counts'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_change_history'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: error.message
      })
    },
  })
}

export function useDeleteMutation(
  toast: ReturnType<typeof useToast>["toast"]
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      return callRpc({ fn: 'repair_request_delete', args: { p_id: id } })
    },
    onSuccess: () => {
      toast({ title: "Đã xóa", description: "Yêu cầu đã được xóa thành công." })
      queryClient.invalidateQueries({ queryKey: ['repair_request_list'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_facilities'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_status_counts'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_change_history'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi xóa yêu cầu",
        description: error.message
      })
    },
  })
}

export function useApproveMutation(
  toast: ReturnType<typeof useToast>["toast"],
  user: AuthUser | null
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      id: number
      don_vi_thuc_hien: RepairUnit
      ten_don_vi_thue: string | null
    }) => {
      return callRpc({
        fn: 'repair_request_approve',
        args: {
          p_id: data.id,
          p_nguoi_duyet: user?.full_name || user?.username || '',
          p_don_vi_thuc_hien: data.don_vi_thuc_hien,
          p_ten_don_vi_thue: data.ten_don_vi_thue,
        }
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã duyệt yêu cầu." })
      queryClient.invalidateQueries({ queryKey: ['repair_request_list'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_facilities'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_status_counts'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_change_history'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi phê duyệt",
        description: error.message
      })
    },
  })
}

export function useCompleteMutation(
  toast: ReturnType<typeof useToast>["toast"]
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      id: number
      completion: string | null
      reason: string | null
      repairCost: number | null
    }) => {
      const completion = data.completion?.trim() ?? ""
      const reason = data.reason?.trim() ?? ""

      if (completion.length === 0 && reason.length === 0) {
        throw new Error("Phải nhập kết quả sửa chữa hoặc lý do không hoàn thành")
      }

      return callRpc({
        fn: 'repair_request_complete',
        args: {
          p_id: data.id,
          p_completion: completion.length > 0 ? completion : null,
          p_reason: reason.length > 0 ? reason : null,
          p_chi_phi_sua_chua: data.repairCost,
        }
      })
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã cập nhật trạng thái yêu cầu." })
      queryClient.invalidateQueries({ queryKey: ['repair_request_list'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_facilities'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_status_counts'] })
      queryClient.invalidateQueries({ queryKey: ['repair_request_change_history'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật yêu cầu",
        description: error.message
      })
    },
  })
}
