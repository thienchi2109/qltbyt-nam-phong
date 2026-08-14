"use client"

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query"

import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"

export type LinkEquipmentVariables = {
  thiet_bi_ids: number[]
  nhom_id: number
}

/** Calls the existing tenant-scoped manual-link RPC. */
export function linkDeviceQuotaEquipment(data: LinkEquipmentVariables, donViId: number | null) {
  return callRpc<number>({
    fn: "dinh_muc_thiet_bi_link",
    args: {
      p_thiet_bi_ids: data.thiet_bi_ids,
      p_nhom_id: data.nhom_id,
      p_don_vi: donViId,
    },
  })
}

/** Invalidates every cache affected by a successful manual link. */
export function invalidateDeviceQuotaLinkQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["dinh_muc_thiet_bi_unassigned"] }),
    queryClient.invalidateQueries({
      queryKey: ["dinh_muc_thiet_bi_unassigned_filter_options"],
    }),
    queryClient.invalidateQueries({ queryKey: ["dinh_muc_nhom_list"] }),
    queryClient.invalidateQueries({ queryKey: ["dinh_muc_compliance_summary"] }),
  ])
}

/** Preserves the legacy Mapping mutation behavior on its fallback route. */
export function useLinkEquipmentMutation(
  toast: ReturnType<typeof useToast>["toast"],
  clearSelection: () => void,
  donViId: number | null
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: LinkEquipmentVariables) => linkDeviceQuotaEquipment(data, donViId),
    onSuccess: (_, variables) => {
      toast({
        title: "Thành công",
        description: `Đã gán ${variables.thiet_bi_ids.length} thiết bị vào nhóm định mức.`,
      })
      clearSelection()
      void invalidateDeviceQuotaLinkQueries(queryClient)
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Lỗi gán thiết bị",
        description: error.message,
      })
    },
  })
}
