"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"

type DecisionInput = {
  so_quyet_dinh: string
  ngay_ban_hanh: string
  ngay_hieu_luc: string
  ngay_het_hieu_luc: string | null
  nguoi_ky: string
  chuc_vu_nguoi_ky: string
  ghi_chu: string | null
}


export function useCreateMutation(
  toast: ReturnType<typeof useToast>["toast"]
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: DecisionInput & { thay_the_cho_id: number | null }) => {
      return callRpc({
        fn: 'dinh_muc_quyet_dinh_create',
        args: {
          p_so_quyet_dinh: data.so_quyet_dinh,
          p_ngay_ban_hanh: data.ngay_ban_hanh,
          p_ngay_hieu_luc: data.ngay_hieu_luc,
          p_ngay_het_hieu_luc: data.ngay_het_hieu_luc,
          p_nguoi_ky: data.nguoi_ky,
          p_chuc_vu_nguoi_ky: data.chuc_vu_nguoi_ky,
          p_ghi_chu: data.ghi_chu,
          p_thay_the_cho_id: data.thay_the_cho_id,
        }
      })
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Quyết định đã được tạo."
      })
      queryClient.invalidateQueries({ queryKey: ['dinh_muc_quyet_dinh_list'] })
      queryClient.invalidateQueries({ queryKey: ['dinh_muc_compliance_summary'] })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Tạo quyết định thất bại",
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
    mutationFn: async (data: DecisionInput & { id: number }) => {
      return callRpc({
        fn: 'dinh_muc_quyet_dinh_update',
        args: {
          p_id: data.id,
          p_so_quyet_dinh: data.so_quyet_dinh,
          p_ngay_ban_hanh: data.ngay_ban_hanh,
          p_ngay_hieu_luc: data.ngay_hieu_luc,
          p_ngay_het_hieu_luc: data.ngay_het_hieu_luc,
          p_nguoi_ky: data.nguoi_ky,
          p_chuc_vu_nguoi_ky: data.chuc_vu_nguoi_ky,
          p_ghi_chu: data.ghi_chu,
        }
      })
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Đã cập nhật quyết định."
      })
      queryClient.invalidateQueries({ queryKey: ['dinh_muc_quyet_dinh_list'] })
      queryClient.invalidateQueries({ queryKey: ['dinh_muc_compliance_summary'] })
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

export function useActivateMutation(
  toast: ReturnType<typeof useToast>["toast"]
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      return callRpc({
        fn: 'dinh_muc_quyet_dinh_activate',
        args: { p_id: id }
      })
    },
    onSuccess: () => {
      toast({
        title: "Thành công",
        description: "Quyết định đã được kích hoạt."
      })
      queryClient.invalidateQueries({ queryKey: ['dinh_muc_quyet_dinh_list'] })
      queryClient.invalidateQueries({ queryKey: ['dinh_muc_compliance_summary'] })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi kích hoạt quyết định",
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
      return callRpc({
        fn: 'dinh_muc_quyet_dinh_delete',
        args: { p_id: id }
      })
    },
    onSuccess: () => {
      toast({
        title: "Đã xóa",
        description: "Quyết định đã được xóa thành công."
      })
      queryClient.invalidateQueries({ queryKey: ['dinh_muc_quyet_dinh_list'] })
      queryClient.invalidateQueries({ queryKey: ['dinh_muc_compliance_summary'] })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi xóa quyết định",
        description: error.message
      })
    },
  })
}
