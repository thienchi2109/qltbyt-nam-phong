"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"

export function useLinkEquipmentMutation(
  toast: ReturnType<typeof useToast>["toast"],
  clearSelection: () => void,
  donViId: number | null
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { thiet_bi_ids: number[]; nhom_id: number }) => {
      return callRpc({
        fn: 'dinh_muc_thiet_bi_link',
        args: {
          p_thiet_bi_ids: data.thiet_bi_ids,
          p_nhom_id: data.nhom_id,
          p_don_vi: donViId,
        }
      })
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Thành công",
        description: `Đã gán ${variables.thiet_bi_ids.length} thiết bị vào nhóm định mức.`
      })
      clearSelection()
      queryClient.invalidateQueries({ queryKey: ['dinh_muc_thiet_bi_unassigned'] })
      queryClient.invalidateQueries({ queryKey: ['dinh_muc_thiet_bi_unassigned_filter_options'] })
      queryClient.invalidateQueries({ queryKey: ['dinh_muc_nhom_list'] })
      queryClient.invalidateQueries({ queryKey: ['dinh_muc_compliance_summary'] })
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi gán thiết bị",
        description: error.message
      })
    },
  })
}
