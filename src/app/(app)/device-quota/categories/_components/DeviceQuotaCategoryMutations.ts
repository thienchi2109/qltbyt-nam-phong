"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useToast } from "@/hooks/use-toast"
import { translateRpcError } from "@/lib/error-translations"
import { refreshCategoryEmbeddings } from "@/lib/refresh-category-embeddings"
import { callRpc } from "@/lib/rpc-client"
import type { CategoryFormInput } from "../_types/categories"

export function useCreateMutation(
  toast: ReturnType<typeof useToast>["toast"],
  closeDialog: () => void,
  donViId: number | null
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CategoryFormInput) => {
      if (!donViId) {
        throw new Error("Thiếu thông tin đơn vị (don_vi)")
      }
      return callRpc({
        fn: "dinh_muc_nhom_upsert",
        args: {
          p_id: null,
          p_don_vi: donViId,
          p_parent_id: data.parent_id,
          p_ma_nhom: data.ma_nhom,
          p_ten_nhom: data.ten_nhom,
          p_phan_loai: data.phan_loai,
          p_don_vi_tinh: data.don_vi_tinh,
          p_thu_tu_hien_thi: data.thu_tu_hien_thi,
          p_mo_ta: data.mo_ta,
        },
      })
    },
    onSuccess: (result: unknown) => {
      toast({
        title: "Thành công",
        description: "Đã tạo danh mục thiết bị.",
      })
      closeDialog()
      queryClient.invalidateQueries({ queryKey: ["dinh_muc_nhom_list"] })
      queryClient.invalidateQueries({ queryKey: ["dinh_muc_compliance_summary"] })

      const categoryId = typeof result === 'number' ? result : null
      if (categoryId) {
        refreshCategoryEmbeddings([categoryId])
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Tạo danh mục thất bại",
        description: translateRpcError(error.message),
      })
    },
  })
}

export function useUpdateMutation(
  toast: ReturnType<typeof useToast>["toast"],
  closeDialog: () => void,
  setMutatingCategoryId: (id: number | null) => void,
  donViId: number | null
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CategoryFormInput & { id: number }) => {
      if (!donViId) {
        throw new Error("Thiếu thông tin đơn vị (don_vi)")
      }
      return callRpc({
        fn: "dinh_muc_nhom_upsert",
        args: {
          p_id: data.id,
          p_don_vi: donViId,
          p_parent_id: data.parent_id,
          p_ma_nhom: data.ma_nhom,
          p_ten_nhom: data.ten_nhom,
          p_phan_loai: data.phan_loai,
          p_don_vi_tinh: data.don_vi_tinh,
          p_thu_tu_hien_thi: data.thu_tu_hien_thi,
          p_mo_ta: data.mo_ta,
        },
      })
    },
    onMutate: (data) => {
      setMutatingCategoryId(data.id)
    },
    onSuccess: (_result: unknown, variables) => {
      toast({
        title: "Thành công",
        description: "Đã cập nhật danh mục.",
      })
      closeDialog()
      queryClient.invalidateQueries({ queryKey: ["dinh_muc_nhom_list"] })
      queryClient.invalidateQueries({ queryKey: ["dinh_muc_compliance_summary"] })
      refreshCategoryEmbeddings([variables.id])
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: translateRpcError(error.message),
      })
    },
    onSettled: () => {
      setMutatingCategoryId(null)
    },
  })
}

export function useDeleteMutation(
  toast: ReturnType<typeof useToast>["toast"],
  closeDeleteDialog: () => void,
  setMutatingCategoryId: (id: number | null) => void,
  donViId: number | null
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      if (!donViId) {
        throw new Error("Thiếu thông tin đơn vị (don_vi)")
      }
      return callRpc({
        fn: "dinh_muc_nhom_delete",
        args: {
          p_id: id,
          p_don_vi: donViId,
        },
      })
    },
    onMutate: (id) => {
      setMutatingCategoryId(id)
    },
    onSuccess: () => {
      toast({
        title: "Đã xóa",
        description: "Danh mục đã được xóa.",
      })
      closeDeleteDialog()
      queryClient.invalidateQueries({ queryKey: ["dinh_muc_nhom_list"] })
      queryClient.invalidateQueries({ queryKey: ["dinh_muc_compliance_summary"] })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Xóa danh mục thất bại",
        description: translateRpcError(error.message),
      })
    },
    onSettled: () => {
      setMutatingCategoryId(null)
    },
  })
}
