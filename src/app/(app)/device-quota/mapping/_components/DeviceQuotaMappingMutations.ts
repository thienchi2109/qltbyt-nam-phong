"use client"

import type { QueryClient } from "@tanstack/react-query"

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
