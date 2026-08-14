import { queryOptions } from "@tanstack/react-query"

import { callRpc } from "@/lib/rpc-client"
import type { EquipmentPreviewItem } from "../../_components/mapping-preview/MappingPreviewPrimitives"

/** Returns the exact assigned-equipment cache key for a category and tenant. */
export function deviceQuotaCategoryAssignedEquipmentQueryKey(
  nhomId: number,
  donViId: number | null
) {
  return ["dinh_muc_thiet_bi_by_nhom", { nhomId, donViId }] as const
}

/** Builds the shared assigned-equipment query used by detail and reconciliation. */
export function deviceQuotaCategoryAssignedEquipmentQueryOptions(
  nhomId: number,
  donViId: number | null
) {
  return queryOptions({
    queryKey: deviceQuotaCategoryAssignedEquipmentQueryKey(nhomId, donViId),
    queryFn: () =>
      callRpc<EquipmentPreviewItem[]>({
        fn: "dinh_muc_thiet_bi_by_nhom",
        args: { p_nhom_id: nhomId, p_don_vi: donViId },
      }),
    enabled: donViId !== null,
  })
}
